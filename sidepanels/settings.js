import { getSettings, saveSettings } from './storage.js';

document.addEventListener('DOMContentLoaded', async () => {
  const apiKeyInput = document.getElementById('api-key');
  const appScriptInput = document.getElementById('app-script');
  const settingsForm = document.getElementById('settings-form');
  const msg = document.getElementById('settings-msg');
  const saveBtn = document.getElementById('save-btn');

  // Load existing key
  const data = await getSettings();
  if (data.openRouterApiKey) {
    apiKeyInput.value = data.openRouterApiKey;
  }
  if (data.appScriptUrl) {
    appScriptInput.value = data.appScriptUrl;
  }

  settingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    saveBtn.disabled = true;
    saveBtn.value = 'Saving...';
    
    const newKey = apiKeyInput.value.trim();
    const newScript = appScriptInput.value.trim();
    
    await saveSettings(newKey, newScript);
    
    saveBtn.value = 'Save Settings';
    saveBtn.disabled = false;
    
    msg.style.display = 'block';
    setTimeout(() => {
      msg.style.display = 'none';
    }, 2500);
  });
});
