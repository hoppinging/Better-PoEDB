(function () {
  const BP = globalThis.__BP;
  const DEFAULTS = { enabled: true };
  const state = {
    settings: Object.assign({}, DEFAULTS),
    englishRoot: null,
    englishUrl: '',
    modCatalog: null,
    pageTimer: 0,
    applying: false,
    ready: false
  };

  if (!BP || !BP.englishPageUrl(location.href) || !document.body) return;

  injectBridge();
  bindUi();
  loadSettings().then((settings) => {
    state.settings = settings;
    renderDock();
    if (settings.enabled) start();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.enabled) state.settings.enabled = !!changes.enabled.newValue;
    renderDock();
    if (state.settings.enabled) start();
    else clearAnnotations();
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || !message.type) return;
    if (message.type === 'bp-status') {
      sendResponse(status());
      return;
    }
    if (message.type === 'bp-apply') {
      state.settings = Object.assign({}, state.settings, message.settings || {});
      renderDock();
      if (state.settings.enabled) start();
      else clearAnnotations();
      sendResponse(status());
      return;
    }
if (message.type === 'bp-toggle') {
      const enabled = !state.settings.enabled;
      state.settings.enabled = enabled;
      chrome.storage.local.set({ enabled: enabled });
      renderDock();
      if (enabled) start();
      else clearAnnotations();
      sendResponse(status());
    }
  });

  function status() {
    return {
      ok: true,
      enabled: !!state.settings.enabled,
      count: document.querySelectorAll('.bp-entext').length,
      url: location.href,
      englishUrl: state.englishUrl,
      ready: state.ready,
      error: state.error || ''
    };
  }

  function loadSettings() {
    return new Promise((resolve) => {
      if (!chrome.storage || !chrome.storage.local) {
        resolve(Object.assign({}, DEFAULTS));
        return;
      }
      chrome.storage.local.get(DEFAULTS, (items) => {
        resolve({
          enabled: !items || items.enabled !== false,
        });
      });
    });
  }

  function start() {
    state.englishUrl = BP.englishPageUrl(location.href);
    if (!state.englishUrl) return;
    if (state.englishRoot) {
      applyPage();
      return;
    }
    if (state.loading) return;
    state.loading = true;
    state.error = '';
    renderDock('正在读取英文…');
    fetchText(state.englishUrl).then((html) => {
      state.loading = false;
      if (!html || html.length < 400 || /<title>\s*403/.test(html)) {
        state.error = '英文页面没有加载成功';
        renderDock(state.error);
        return;
      }
      state.modCatalog = BP.modCatalog(BP.extractModsViewJson(html));
      state.englishRoot = new DOMParser().parseFromString(html, 'text/html').body;
      state.ready = true;
      applyPage();
      observe();
    }).catch(() => {
      state.loading = false;
      state.error = '英文页面没有加载成功';
      renderDock(state.error);
    });
  }

  function observe() {
    if (state.observer || !document.body) return;
    state.observer = new MutationObserver((records) => {
      if (state.applying || !state.settings.enabled) return;
      let structural = false;
      records.forEach((record) => {
        Array.from(record.addedNodes).forEach((node) => {
          if (!node || node.nodeType !== 1) return;
          if (isOwn(node) || isTooltip(node)) return;
          structural = true;
        });
      });
      if (structural) schedulePage();
    });
    state.observer.observe(document.body, { childList: true, subtree: true });
  }

  function isTooltip(node) {
    if (node.classList && (node.classList.contains('tippy-box') || node.classList.contains('tippy-content'))) return true;
    return !!(node.closest && node.closest('.tippy-box, .tippy-content'));
  }

  function isOwn(node) {
    if (!node.classList) return false;
    if (node.classList.contains('bp-enline') || node.classList.contains('bp-dock')) return true;
    return !!(node.closest && node.closest('.bp-enline, .bp-dock'));
  }

  function schedulePage() {
    clearTimeout(state.pageTimer);
    state.pageTimer = setTimeout(applyPage, 180);
  }

  function applyPage() {
    if (!state.settings.enabled || !state.englishRoot) return;
    state.applying = true;
    try {
      const pairs = BP.annotationPairs(document.body, state.englishRoot);
      paint(pairs, document.body);
      annotateMods(document.body);
      renderDock();
    } finally {
      state.applying = false;
    }
  }

  function paint(pairs, root) {
    const scope = root && root.querySelectorAll ? root : document;
    const existing = scope.querySelectorAll('[data-bp-annotated]');
    if (!pairs.length && existing.length && (!root || root === document.body)) return;
    const keep = new Set();
    pairs.forEach((pair) => {
      if (!pair.node || !pair.node.isConnected) return;
      upsert(pair.node, pair.enText);
      pair.node.setAttribute('data-bp-annotated', '1');
      keep.add(pair.node);
    });
    scope.querySelectorAll('[data-bp-annotated]').forEach((el) => {
      if (keep.has(el) || el.getAttribute('data-bp-kind') === 'mod') return;
      if ((!root || root === document.body) && el.closest && el.closest('.tippy-content')) return;
      el.removeAttribute('data-bp-annotated');
      const line = el.querySelector(':scope > .bp-enline');
      if (line) line.remove();
    });
  }

  function upsert(el, text) {
    let line = null;
    Array.from(el.children).forEach((child) => {
      if (child.classList && child.classList.contains('bp-enline')) line = child;
    });
    if (!line) {
      line = document.createElement('span');
      line.className = 'bp-enline';
      const value = document.createElement('span');
      value.className = 'bp-entext';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'bp-copy';
      button.textContent = '复制';
      line.appendChild(value);
      line.appendChild(button);
      el.appendChild(line);
    }
    const span = line.querySelector('.bp-entext');
    if (span && span.textContent !== text) span.textContent = text;
    line.classList.toggle('bp-enblock', text.indexOf('\n') !== -1);
    line.title = '英文原文，可选中复制';
  }

  function modLines(lines) {
    const wrap = document.createElement('div');
    wrap.className = 'bp-mod-english';
    (lines || []).forEach((line) => {
      const row = document.createElement('span');
      row.className = 'bp-enline';
      const text = document.createElement('span');
      text.className = 'bp-entext';
      text.textContent = line;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'bp-copy';
      button.textContent = '复制';
      row.appendChild(text);
      row.appendChild(button);
      wrap.appendChild(row);
    });
    return wrap;
  }

  function modValueLines(lines) {
    const wrap = document.createElement('div');
    wrap.className = 'bp-mod-english';
    (lines || []).forEach((values) => {
      const row = document.createElement('span');
      row.className = 'bp-enline';
      (values || []).forEach((value) => {
        const text = document.createElement('span');
        text.className = 'bp-entext';
        text.textContent = value;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'bp-copy';
        button.textContent = '复制';
        row.appendChild(text);
        row.appendChild(button);
      });
      wrap.appendChild(row);
    });
    return wrap;
  }

  function placeModNote(anchor, note, mode) {
    if (mode === 'after') {
      const next = anchor.nextElementSibling;
      if (next && next.classList.contains('bp-mod-english')) next.replaceWith(note);
      else anchor.insertAdjacentElement('afterend', note);
      return;
    }
    const current = anchor.querySelector(':scope > .bp-mod-english');
    if (current) current.replaceWith(note);
    else anchor.appendChild(note);
  }

  function annotateMods(root) {
    if (!state.modCatalog || !state.modCatalog.size) return;
    const scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll('.mod-title[data-gengroup]').forEach((el) => {
      const block = el.closest ? el.closest('.identifyBlock') : null;
      const category = BP.identifyCategory(block ? block.className : '');
      const group = el.getAttribute('data-gengroup') || '';
            const pattern = BP.lookupModEnglish(category, group, state.modCatalog);
      const tiers = BP.lookupModTiers(category, group, state.modCatalog);
      if (pattern) {
        placeModNote(el, modLines(pattern.split('\n')), 'after');
        el.setAttribute('data-bp-annotated', '1');
        el.setAttribute('data-bp-kind', 'mod');
      }
      const target = el.getAttribute('data-bs-target');
      const modal = target ? document.querySelector(target) : null;
      const rows = modal ? modal.querySelectorAll('table tbody tr') : [];
      tiers.forEach((lines, index) => {
        const row = rows[index];
        if (!row || !lines.length) return;
        const host = row.querySelector('td .d-flex > div') || row;
        placeModNote(host, modValueLines(lines), 'inside');
      });
    });
  }

  function clearAnnotations() {
    document.querySelectorAll('.bp-enline, .bp-mod-english, .bp-mod-summary').forEach((node) => node.remove());
    document.querySelectorAll('[data-bp-annotated]').forEach((node) => node.removeAttribute('data-bp-annotated'));
    renderDock();
  }

  function renderDock(message) {
    let dock = document.querySelector('.bp-dock');
    if (!dock) {
      dock = document.createElement('div');
      dock.className = 'bp-dock';
      dock.innerHTML = '<span class="bp-dock-text"></span><button type="button" class="bp-dock-toggle"></button>';
      document.body.appendChild(dock);
    }
    const text = dock.querySelector('.bp-dock-text');
    const toggle = dock.querySelector('.bp-dock-toggle');
    const count = document.querySelectorAll('.bp-entext').length;
    if (!state.settings.enabled) {
      text.textContent = '英文原文已隐藏';
      toggle.textContent = '显示';
    } else if (message) {
      text.textContent = message;
      toggle.textContent = '隐藏';
    } else if (state.error) {
      text.textContent = state.error;
      toggle.textContent = '重试';
    } else {
      text.textContent = count ? ('英文 ' + count) : '没有可对照的英文';
      toggle.textContent = '隐藏';
    }
  }

  function copyTextFor(button) {
    let node = button.previousElementSibling;
    while (node && !(node.classList && node.classList.contains('bp-entext'))) node = node.previousElementSibling;
    return node ? node.textContent : '';
  }

  function bindUi() {
    document.addEventListener('click', (event) => {
      const copy = event.target.closest && event.target.closest('.bp-copy');
      const gloss = event.target.closest && event.target.closest('.bp-mod-english, .bp-mod-summary');
      const toggle = event.target.closest && event.target.closest('.bp-dock-toggle');
      if (gloss) {
        event.preventDefault();
        event.stopPropagation();
      }
      if (copy) {
        event.preventDefault();
        event.stopPropagation();
        const text = copyTextFor(copy);
        writeClipboard(text).then(() => flash(copy));
      }
      if (toggle) {
        event.preventDefault();
        event.stopPropagation();
        if (state.error && state.settings.enabled) {
          state.englishRoot = null;
          state.ready = false;
          start();
          return;
        }
        const enabled = !state.settings.enabled;
        state.settings.enabled = enabled;
        chrome.storage.local.set({ enabled: enabled });
        if (enabled) start();
        else clearAnnotations();
        renderDock();
      }
    }, true);
  }

  function flash(button) {
    const previous = button.textContent;
    button.textContent = '已复制';
    setTimeout(() => {
      button.textContent = previous === '已复制' ? '复制' : previous;
    }, 900);
  }

  function writeClipboard(text) {
    const value = String(text || '');
    if (!value) return Promise.resolve();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(value).catch(() => legacyCopy(value));
    }
    legacyCopy(value);
    return Promise.resolve();
  }

  function legacyCopy(text) {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.left = '-9999px';
    document.body.appendChild(area);
    area.select();
    try { document.execCommand('copy'); } catch (error) {}
    area.remove();
  }

  function fetchText(url) {
    if (!BP.isAllowedFetchUrl(url)) return Promise.reject(new Error('blocked'));
    let host = '';
    try { host = new URL(url).hostname; } catch (error) { return Promise.reject(error); }
    if (host.indexOf('cdn.') === 0) return fetchFromPage(url);
    return fetch(url, { credentials: 'omit', cache: 'default' }).then((response) => {
      if (!response.ok) throw new Error(String(response.status));
      return response.text();
    }).catch(() => fetchFromPage(url));
  }

  function fetchFromPage(url) {
    return requestPage(url).then((result) => {
      if (result && result.ok && result.text) return result.text;
      throw new Error((result && result.error) || 'fetch failed');
    });
  }

  const pending = new Map();
  let seq = 0;
  window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data || event.data.source !== 'bp-response') return;
    const waiter = pending.get(event.data.id);
    if (!waiter) return;
    pending.delete(event.data.id);
    waiter(event.data);
  });

  function requestPage(url) {
    return new Promise((resolve) => {
      const id = 'bp-' + (++seq);
      const timer = setTimeout(() => {
        pending.delete(id);
        resolve({ ok: false, error: 'timeout' });
      }, 8000);
      pending.set(id, (data) => {
        clearTimeout(timer);
        resolve(data);
      });
      window.postMessage({ source: 'bp-request', id: id, url: url }, '*');
    });
  }

  function injectBridge() {
    if (document.documentElement.dataset.bpBridge) return;
    document.documentElement.dataset.bpBridge = '1';
    try { chrome.runtime.sendMessage({ type: 'bp-inject' }); } catch (error) {}
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('page-bridge.js');
    script.onload = function () { script.remove(); };
    (document.head || document.documentElement).appendChild(script);
  }
})();
