const defaults = { enabled: true };

const enabled = document.querySelector('#enabled');
const status = document.querySelector('#status');
chrome.storage.local.get(defaults, (items) => {
  enabled.checked = items.enabled !== false;
});

enabled.addEventListener('change', save);
refresh();

function save() {
  const settings = { enabled: enabled.checked };
  chrome.storage.local.set(settings, () => send({ type: 'bp-apply', settings: settings }));
}

function refresh() {
  currentTab((tab) => {
    if (!tab || !/^https:\/\/(?:www\.)?poe2?db\.tw\/tw(?:\/|$)/.test(tab.url || '')) {
      status.textContent = '打开 poedb.tw/tw 或 poe2db.tw/tw 的页面后才会对照英文。';
      return;
    }
    chrome.tabs.sendMessage(tab.id, { type: 'bp-status' }, (response) => {
      if (chrome.runtime.lastError || !response) {
        status.textContent = '刷新这个繁体页面后再打开面板。';
        return;
      }
      if (response.error) status.textContent = response.error;
      else if (!response.enabled) status.textContent = '英文原文已隐藏。';
      else status.textContent = response.count ? ('本页已标出 ' + response.count + ' 处英文。') : '这个页面没有找到可对照的正文。';
    });
  });
}

function send(message) {
  currentTab((tab) => {
    if (!tab) return;
    chrome.tabs.sendMessage(tab.id, message, () => refresh());
  });
}

function currentTab(callback) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => callback(tabs && tabs[0]));
}
