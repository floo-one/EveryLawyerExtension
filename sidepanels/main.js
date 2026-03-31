import { getLocalData, saveScrapedData, saveLeads } from './storage.js';
import { extractContactDetails, fetchVcfText } from './api.js';
import { renderLeads, renderCode } from './ui.js';

document.addEventListener('DOMContentLoaded', async () => {
  const scanBtn = document.getElementById('scan-btn');
  const statusMsg = document.getElementById('status-msg');
  const codeContainer = document.getElementById('code-container');
  const leadsContainer = document.getElementById('leads-container');

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