import { getLocalData, saveScrapedData, saveLeads } from './storage.js';
import { extractContactDetails, fetchVcfText, findProfileLinks } from './api.js';
import { renderLeads, renderCode } from './ui.js';

document.addEventListener('DOMContentLoaded', async () => {
  const scanBtn = document.getElementById('scan-btn');
  const deepScanBtn = document.getElementById('deep-scan-btn');
  const stopScanBtn = document.getElementById('stop-scan-btn');
  const statusMsg = document.getElementById('status-msg');
  const codeContainer = document.getElementById('code-container');
  const leadsContainer = document.getElementById('leads-container');
  
  let isDeepScanning = false;

  // Display already stored data on load
  const loadStoredData = async () => {
    const data = await getLocalData();
    if (data.leads && data.leads.length > 0) {
      statusMsg.textContent = 'Showing previously extracted leads.';
      renderLeads(data.leads, leadsContainer);
    }
    if (data.scrapedData) {
      renderCode(data.scrapedData, codeContainer);
    }
  };
  await loadStoredData();

  scanBtn.addEventListener('click', async () => {
    try {
      scanBtn.disabled = true;
      deepScanBtn.disabled = true;
      leadsContainer.innerHTML = '';
      codeContainer.innerHTML = '';

      statusMsg.textContent = 'Step 1/3: Scraping page content...';

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) throw new Error('No active tab found.');

      // Send message to service worker to inject content.js and get text
      const response = await chrome.runtime.sendMessage({ type: 'SCAN_PAGE', tabId: tab.id });
      if (response?.error) throw new Error(response.error);
      if (!response?.data?.markdown) throw new Error('Could not extract markdown from page.');

      let finalMarkdown = response.data.markdown;
      const vcfs = response.data.vcfs || [];

      if (vcfs.length > 0) {
        statusMsg.textContent = `Step 2/3: Fetching ${vcfs.length} vCard(s)...`;
        for (const vcfUrl of vcfs) {
          const vcfText = await fetchVcfText(vcfUrl);
          if (vcfText) {
            finalMarkdown += `\n\n### vCard Contact Data:\n\`\`\`vcard\n${vcfText}\n\`\`\``;
          }
        }
      } else {
        statusMsg.textContent = 'Step 2/3: No vCards found. Proceeding...';
      }

      const scrapedData = {
        url: response.data.url,
        markdown: finalMarkdown,
        timestamp: new Date().toISOString()
      };

      // Store scraped content
      await saveScrapedData(scrapedData);
      renderCode(scrapedData, codeContainer);

      statusMsg.textContent = 'Step 3/3: Analyzing data with AI...';

      const leads = await extractContactDetails(finalMarkdown, response.data.url);

      if (!leads || leads.length === 0) {
        statusMsg.textContent = 'No contact details found on this page.';
      } else {
        statusMsg.textContent = `Success! Found ${leads.length} lead(s).`;
        await saveLeads(leads);
        renderLeads(leads, leadsContainer);
      }

    } catch (error) {
      console.error(error);
      statusMsg.textContent = error.message;
    } finally {
      scanBtn.disabled = false;
      deepScanBtn.disabled = false;
    }
  });

  // --- DEEP SCAN LOGIC ---
  stopScanBtn.addEventListener('click', () => {
    isDeepScanning = false;
    stopScanBtn.textContent = 'Stopping...';
    stopScanBtn.disabled = true;
  });

  deepScanBtn.addEventListener('click', async () => {
    try {
      isDeepScanning = true;
      scanBtn.disabled = true;
      deepScanBtn.style.display = 'none';
      stopScanBtn.style.display = 'inline-block';
      stopScanBtn.textContent = 'Stop Scan';
      stopScanBtn.disabled = false;
      
      leadsContainer.innerHTML = '';
      codeContainer.innerHTML = '';
      let existingLeads = [];

      statusMsg.textContent = 'Step 1/4: Finding all links on current page...';

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) throw new Error('No active tab found.');

      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const links = Array.from(document.querySelectorAll('a'))
            .map(a => ({ text: a.innerText.replace(/\s+/g, ' ').trim(), href: a.href }))
            .filter(a => a.href.startsWith('http') && a.text.length > 0);
          
          const unique = [];
          const seen = new Set();
          for (const l of links) {
            if (!seen.has(l.href)) {
              seen.add(l.href);
              unique.push(l);
            }
          }
          return unique;
        }
      });
      
      const allLinks = results[0]?.result || [];
      if (allLinks.length === 0) throw new Error('No links found on this page.');

      if (!isDeepScanning) throw new Error('Scan stopped by user.');
      statusMsg.textContent = `Step 2/4: Using AI to identify profile pages among ${allLinks.length} links...`;
      
      const profileUrls = await findProfileLinks(allLinks, tab.url);
      if (!profileUrls || profileUrls.length === 0) {
        throw new Error('AI could not identify any lawyer profile links on this page.');
      }

      const totalProfiles = profileUrls.length;
      let profilesProcessed = 0;
      let totalLeadsFound = 0;
      
      statusMsg.textContent = `Step 3/4: Found ${totalProfiles} profile(s). Starting deep extraction...`;
      
      for (const url of profileUrls) {
        if (!isDeepScanning) break;
        
        profilesProcessed++;
        statusMsg.textContent = `Scanning ${profilesProcessed}/${totalProfiles}: ${new URL(url).pathname}...`;
        
        try {
          // Fetch raw HTML
          const res = await fetch(url);
          if (!res.ok) throw new Error(`Fetch failed: ${res.statusText}`);
          const html = await res.text();
          
          // Parse HTML inside sidepanel
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, 'text/html');
          
          // Inject a base tag so relative URLs resolve properly
          const baseNode = doc.createElement('base');
          baseNode.href = url;
          doc.head.appendChild(baseNode);
          
          // Extract hard contact links
          const links = Array.from(doc.querySelectorAll('a[href^="mailto:"], a[href^="tel:"]'));
          const contacts = [...new Set(links.map(a => a.href.trim()))];
          
          // Cleanup doc before turndown
          const elementsToRemove = doc.querySelectorAll('script, style, noscript, svg, canvas, iframe, picture, video, audio, source, track');
          elementsToRemove.forEach(el => el.remove());
          
          // Ensure window.TurndownService is loaded from main.html script inclusion
          if (typeof TurndownService === 'undefined') {
            throw new Error("TurndownService is not loaded. Please restart panel.");
          }
          
          const turndownService = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
          turndownService.keep(['a']);
          let markdown = turndownService.turndown(doc.body.innerHTML);
          
          if (contacts.length > 0) {
            markdown += '\n\n### Scraped Contact Links\n' + contacts.map(c => `- ${c}`).join('\n');
          }
          markdown = markdown.replace(/\n{3,}/g, '\n\n').trim();
          
          const vcfNodes = Array.from(doc.querySelectorAll('a[href$=".vcf"]'));
          const vcfs = [...new Set(vcfNodes.map(a => a.href.trim()))];
          for (const vcfUrl of vcfs) {
            const vcfText = await fetchVcfText(vcfUrl);
            if (vcfText) {
              markdown += `\n\n### vCard Contact Data:\n\`\`\`vcard\n${vcfText}\n\`\`\``;
            }
          }
          
          // Extract via AI
          if (!isDeepScanning) break;
          const leads = await extractContactDetails(markdown, url);
          
          if (leads && leads.length > 0) {
            existingLeads = [...existingLeads, ...leads];
            totalLeadsFound += leads.length;
            
            // Re-render leads with new data incrementally
            leadsContainer.innerHTML = '';
            renderLeads(existingLeads, leadsContainer);
            await saveLeads(existingLeads);
          }
          
        } catch (subErr) {
          console.warn(`Failed to process profile ${url}:`, subErr);
        }
        
        // Minor delay to let UI breathe and prevent immediate max concurrent
        await new Promise(r => setTimeout(r, 500));
      }

      if (!isDeepScanning) {
        statusMsg.textContent = `Deep Scan halted. Processed ${profilesProcessed}/${totalProfiles} and found ${totalLeadsFound} lead(s).`;
      } else {
        statusMsg.textContent = `Deep Scan complete! Found ${totalLeadsFound} lead(s) across ${totalProfiles} profiles.`;
      }

    } catch (error) {
      console.error(error);
      statusMsg.textContent = error.message;
    } finally {
      scanBtn.disabled = false;
      deepScanBtn.style.display = 'inline-block';
      deepScanBtn.disabled = false;
      stopScanBtn.style.display = 'none';
      isDeepScanning = false;
    }
  });

  // Bind Global Send/Reset Actions
  const sendAllBtn = document.getElementById('send-all-btn');
  sendAllBtn?.addEventListener('click', () => {
    const originalValue = sendAllBtn.value;
    sendAllBtn.value = 'Sending All...';
    sendAllBtn.disabled = true;

    // Trigger submit on every individual lead form
    document.querySelectorAll('.lead-form').forEach(form => {
      form.dispatchEvent(new Event('submit'));
    });

    // Provide visual success feedback on the global button
    setTimeout(() => {
      sendAllBtn.value = 'All Sent!';
      sendAllBtn.classList.add('contrast');
      setTimeout(() => {
        sendAllBtn.value = originalValue;
        sendAllBtn.disabled = false;
        sendAllBtn.classList.remove('contrast');
      }, 2500);
    }, 500);
  });

  document.getElementById('reset-all-btn')?.addEventListener('click', async () => {
    // Clear the forms
    document.querySelectorAll('.lead-form').forEach(form => {
      form.reset();
    });
    // Clear storage and UI
    await saveLeads([]);
    await saveScrapedData(null);
    leadsContainer.innerHTML = '';
    codeContainer.innerHTML = '';
    statusMsg.textContent = 'Data cleared.';
    document.getElementById('leads-wrapper').style.display = 'none';
  });
});