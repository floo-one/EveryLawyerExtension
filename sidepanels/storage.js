export async function getSettings() {
  const data = await chrome.storage.sync.get(['openRouterApiKey', 'appScriptUrl']);
  return data;
}

export async function saveSettings(openRouterApiKey, appScriptUrl) {
  await chrome.storage.sync.set({ openRouterApiKey, appScriptUrl });
}

export async function getLocalData() {
  const data = await chrome.storage.local.get(['scrapedData', 'leads']);
  return data;
}

export async function saveScrapedData(scrapedData) {
  await chrome.storage.local.set({ scrapedData });
}

export async function saveLeads(leads) {
  await chrome.storage.local.set({ leads });
}
