import { getSettings } from './storage.js';

export async function fetchVcfText(vcfUrl) {
  try {
    const res = await fetch(vcfUrl);
    if (!res.ok) return null;
    return await res.text();
  } catch (e) {
    console.warn("Failed to fetch vcard:", vcfUrl);
    return null;
  }
}

export async function extractContactDetails(markdownText, url) {
  const settings = await getSettings();
  if (!settings.openRouterApiKey) {
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
      "Authorization": `Bearer ${settings.openRouterApiKey}`,
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

export async function sendLeadToWebhook(formData) {
  const settings = await getSettings();
  if (!settings.appScriptUrl) {
    throw new Error("Missing Google Apps Script Webhook. Please add it in Settings.");
  }

  // Google Sheets evaluates '+' as a formula. Prefix phone numbers with a single quote.
  const tel = formData.get('tel');
  if (tel && tel.trim().startsWith('+')) {
    formData.set('tel', "'" + tel.trim());
  }

  await fetch(settings.appScriptUrl, {
    method: 'POST',
    mode: 'no-cors', // Bypass CORS restrictions
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams(formData).toString()
  });
}

export async function sendBulkLeadsToWebhook(leadsArray) {
  const settings = await getSettings();
  if (!settings.appScriptUrl) {
    throw new Error("Missing Google Apps Script Webhook. Please add it in Settings.");
  }

  // Handle Google Sheet "+" formula evaluation
  const processedLeads = leadsArray.map(lead => {
    let newLead = { ...lead };
    if (newLead.tel && newLead.tel.trim().startsWith('+')) {
      newLead.tel = "'" + newLead.tel.trim();
    }
    return newLead;
  });

  const payload = new URLSearchParams();
  payload.append('bulk_data', JSON.stringify(processedLeads));

  await fetch(settings.appScriptUrl, {
    method: 'POST',
    mode: 'no-cors',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: payload.toString()
  });
}

export async function findProfileLinks(linksArray, url) {
  const settings = await getSettings();
  if (!settings.openRouterApiKey) {
    throw new Error("Missing OpenRouter API Key. Please click 'Settings' to add your key.");
  }

  const prompt = `
You are helping an automated scraper navigate a law firm's team directory page located at: ${url}

Here is a list of links found on that page, provided as JSON:
${JSON.stringify(linksArray, null, 2)}

Your task is to identify which of those URLs specifically point to individual lawyer/attorney profile pages.
Exclude generic pages (like 'Contact', 'About', 'Careers', 'Practice Areas') and any other non-profile links.
Include any link that seems to belong to a specific person's profile on the team.

Return ONLY a JSON array of absolute URL strings. Do not include any other markdown formatting like \`\`\`json.
Example output: ["https://www.firma.ch/team/john-doe", "https://www.firma.ch/team/jane-smith"]
If no profile pages are found, return exactly [].
`;

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${settings.openRouterApiKey}`,
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
    console.error("Failed to parse JSON for links:", content);
    throw new Error("AI returned invalid JSON for link extraction.");
  }
}
