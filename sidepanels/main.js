document.addEventListener('DOMContentLoaded', async () => {
  const scanBtn = document.getElementById('scan-btn');
  const statusMsg = document.getElementById('status-msg');
  const codeContainer = document.getElementById('code-container');
  const leadsContainer = document.getElementById('leads-container');

  // Display already stored data on load
  const loadStoredData = async () => {
    const data = await chrome.storage.local.get(['scrapedData', 'leads']);
    if (data.leads && data.leads.length > 0) {
      statusMsg.textContent = 'Showing previously extracted leads.';
      renderLeads(data.leads);
    }
    if (data.scrapedData) {
      renderCode(data.scrapedData);
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
      if (response.error) throw new Error(response.error);
      if (!response.data || !response.data.markdown) throw new Error('Could not extract markdown from page.');

      let finalMarkdown = response.data.markdown;
      const vcfs = response.data.vcfs || [];

      if (vcfs.length > 0) {
        statusMsg.textContent = `Step 2/3: Fetching ${vcfs.length} vCard(s)...`;
        for (const vcfUrl of vcfs) {
          try {
            const vcfRes = await fetch(vcfUrl);
            if (vcfRes.ok) {
              const vcfText = await vcfRes.text();
              finalMarkdown += `\n\n### vCard Contact Data:\n\`\`\`vcard\n${vcfText}\n\`\`\``;
            }
          } catch (e) {
            console.warn("Failed to fetch vcard:", vcfUrl);
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
      await chrome.storage.local.set({ scrapedData });
      renderCode(scrapedData);

      statusMsg.textContent = 'Step 3/3: Analyzing data with AI...';

      const leads = await extractContactDetails(finalMarkdown, response.data.url);

      if (!leads || leads.length === 0) {
        statusMsg.textContent = 'No contact details found on this page.';
      } else {
        statusMsg.textContent = `Success! Found ${leads.length} lead(s).`;
        await chrome.storage.local.set({ leads });
        renderLeads(leads);
      }

    } catch (error) {
      console.error(error);
      statusMsg.textContent = error.message;
    } finally {
      scanBtn.disabled = false;
    }
  });

  async function extractContactDetails(markdownText, url) {
    const storageData = await chrome.storage.sync.get(['openRouterApiKey']);
    if (!storageData.openRouterApiKey) {
      throw new Error("Missing OpenRouter API Key. Please click 'Settings' to add your key.");
    }

    const prompt = `
You are an expert data extractor. Extract lawyer contact details from the following webpage markdown text.
Return the result as a JSON array of objects, where each object has these exact fields:
- FirmName
- LawyerName
- Title
- Phone
- Mail
- Practice Area
- Country
- City
- Url (use ${url} if not found in text)

IMPORTANT: The "Practice Area" and "Title" fields MUST be translated into English, regardless of the original website language.
If you can't find a field, leave it as an empty string "". Only return the raw JSON array, without markdown formatting or code blocks. Do not add any conversational text.

Webpage Markdown:
${markdownText.substring(0, 100000)}
`;

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${storageData.openRouterApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        "model": "openai/gpt-4o-mini",
        "messages": [
          { "role": "user", "content": prompt }
        ]
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`AI API Error: ${res.status} - ${errText}`);
    }

    const data = await res.json();
    let content = data.choices[0].message.content.trim();

    // Clean up potential markdown formatting
    if (content.startsWith('\`\`\`json')) {
      content = content.replace(/^\`\`\`json\n/, '').replace(/\n\`\`\`$/, '');
    } else if (content.startsWith('\`\`\`')) {
      content = content.replace(/^\`\`\`\n/, '').replace(/\n\`\`\`$/, '');
    }

    try {
      return JSON.parse(content);
    } catch (e) {
      console.error("Failed to parse JSON:", content);
      throw new Error("AI returned invalid JSON.");
    }
  }

  function renderLeads(leads) {
    leadsContainer.innerHTML = '';
    const arr = Array.isArray(leads) ? leads : [leads];
    arr.forEach(lead => {
      const details = document.createElement('details');
      const lawyerName = lead.LawyerName || 'Unknown Lawyer';
      const titleSpan = lead.Title ? ` - ${lead.Title}` : '';

      details.innerHTML = `<summary role="button" class="outline contrast">${lawyerName}</summary>
        <form class="lead-form" style="margin-top: 1rem;">
          <fieldset>
            <label>Lawyer Name
              <input type="text" name="lawyerName" value="${lead.LawyerName || ''}" placeholder="Lawyer Name" aria-label="Lawyer Name">
            </label>
            <label>Email
              <input type="email" name="email" value="${lead.Mail || ''}" placeholder="Email" aria-label="Email" autocomplete="email">
            </label>
            <label>Phone
              <input type="tel" name="tel" value="${lead.Phone || ''}" placeholder="Phone" aria-label="Phone" autocomplete="tel">
            </label>
            <label>Firm Name
              <input type="text" name="firmName" value="${lead.FirmName || ''}" placeholder="Firm Name" aria-label="Firm Name">
            </label>
            <label>Title
              <input type="text" name="title" value="${lead.Title || ''}" placeholder="Title" aria-label="Title">
            </label>
            <label>Practice Area
              <input type="text" name="practiceArea" value="${lead['Practice Area'] || ''}" placeholder="Practice Area" aria-label="Practice Area">
            </label>
            <div role="group">
              <label>City
                <input type="text" name="city" value="${lead.City || ''}" placeholder="City" aria-label="City">
              </label>
              <label>Country
                <input type="text" name="country" value="${lead.Country || ''}" placeholder="Country" aria-label="Country">
              </label>
            </div>
            <label>Profile URL
              <input type="url" name="url" value="${lead.Url || ''}" placeholder="Profile URL" aria-label="Profile URL">
            </label>
          </fieldset>
          <input type="submit" value="Send this Lead" />
        </form>`;

      const form = details.querySelector('form');
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = form.querySelector('input[type="submit"]');
        const originalValue = submitBtn.value;
        
        submitBtn.value = 'Sending...';
        submitBtn.disabled = true;
        submitBtn.classList.add('secondary');

        try {
          const formData = new FormData(form);
          
          const storageData = await chrome.storage.sync.get(['appScriptUrl']);
          if (!storageData.appScriptUrl) {
            throw new Error("Missing Google Apps Script Webhook. Please add it in Settings.");
          }

          // Google Sheets evaluates '+' as a formula. Prefix phone numbers with a single quote.
          const tel = formData.get('tel');
          if (tel && tel.trim().startsWith('+')) {
            formData.set('tel', "'" + tel.trim());
          }

          // Send to the Google Apps Script webhook
          await fetch(storageData.appScriptUrl, {
            method: 'POST',
            mode: 'no-cors', // Bypass CORS restrictions
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams(formData).toString()
          });

          submitBtn.value = 'Sent!';
          submitBtn.classList.remove('secondary');
          submitBtn.classList.add('contrast'); // Show success visually
        } catch (error) {
          console.error('Failed to send lead:', error);
          submitBtn.value = 'Error!';
        } finally {
          setTimeout(() => {
            submitBtn.value = originalValue;
            submitBtn.disabled = false;
            submitBtn.classList.remove('secondary', 'contrast');
          }, 2500);
        }
      });

      leadsContainer.appendChild(details);
    });

    const leadsWrapper = document.getElementById('leads-wrapper');
    if (leadsWrapper) {
      leadsWrapper.style.display = arr.length > 0 ? 'block' : 'none';
    }
  }

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

  document.getElementById('reset-all-btn')?.addEventListener('click', () => {
    document.querySelectorAll('.lead-form').forEach(form => {
      form.reset();
    });
  });

  function renderCode(data) {
    codeContainer.innerHTML = '';
    const content = data.markdown || data.text || data.code || '';

    const stats = document.createElement('p');
    stats.innerHTML = `<small><strong>URL:</strong> ${data.url}<br>
                         <strong>Scraped at:</strong> ${new Date(data.timestamp).toLocaleString()}<br>
                         <strong>Content Length:</strong> ${content.length} characters</small>`;
    codeContainer.appendChild(stats);

    const pre = document.createElement('pre');
    const code = document.createElement('code');
    code.textContent = content.substring(0, 2000) + (content.length > 2000 ? '\n... [TRUNCATED]' : '');
    pre.appendChild(code);
    codeContainer.appendChild(pre);
  }
});