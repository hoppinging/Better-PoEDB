chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle-english') return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return;
  chrome.tabs.sendMessage(tab.id, { type: 'bp-toggle' });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== 'bp-inject' || !sender.tab || !sender.tab.id) return;
  chrome.scripting.executeScript({
    target: { tabId: sender.tab.id },
    world: 'MAIN',
    files: ['page-bridge.js']
  }).then(() => sendResponse({ ok: true })).catch((error) => {
    sendResponse({ ok: false, error: String(error) });
  });
  return true;
});
