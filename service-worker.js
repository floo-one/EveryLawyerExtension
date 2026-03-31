const mainPage = 'sidepanels/main.html';
const settingsPage = 'sidepanels/settings.html';

// Initial setup on installation
chrome.runtime.onInstalled.addListener(() => {
  // Set the global default page to main-sp.html
  chrome.sidePanel.setOptions({ path: mainPage });
  // Ensure the panel opens when the extension icon is clicked
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

/**
 * Updates the side panel path based on the tab's URL.
 */
async function updateSidePanel(url) {
  if (!url) return;

  const isExtensionsPage = url.startsWith('chrome://extensions');
  const targetPath = isExtensionsPage ? settingsPage : mainPage;

  try {
    // Set the global side panel path. This works universally and 
    // bypasses the restrictions of setting tabId-specific options on chrome:// URLs.
    await chrome.sidePanel.setOptions({
      path: targetPath,
      enabled: true
    });
  } catch (error) {
    console.error('Error updating side panel:', error);
  }
}

// Handle scan requests from the sidebar
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== 'SCAN_PAGE') return false;

  chrome.scripting
    .executeScript({ target: { tabId: message.tabId }, files: ['libs/readability.js', 'libs/turndown.js', 'content.js'] })
    .then((results) => {
      const data = results?.[0]?.result;
      sendResponse({ data: data });
    })
    .catch((err) => {
      const text = err.message || String(err);
      const friendly = text.includes('Cannot access')
        ? 'Cannot scan this page (access denied).'
        : `Scan failed: ${text}`;
      sendResponse({ error: friendly });
    });

  return true; // keep the message channel open for async sendResponse
});

// Listen for tab updates (like URL changes)
chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (info.url && tab.active) {
    await updateSidePanel(info.url);
  }
});

// Listen for tab switches
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    await updateSidePanel(tab.url);
  } catch (error) {
    console.error('Error getting tab on activation:', error);
  }
});
