(function () {
  if (window.__BP_PAGE_BRIDGE) return;
  window.__BP_PAGE_BRIDGE = true;
  const HOSTS = {
    'poedb.tw': true,
    'www.poedb.tw': true,
    'poe2db.tw': true,
    'www.poe2db.tw': true
  };

  window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data || event.data.source !== 'bp-request') return;
    const id = event.data.id;
    const url = String(event.data.url || '');
    let parsed;
    try {
      parsed = new URL(url);
    } catch (error) {
      reply(id, false, '', 'bad url');
      return;
    }
    if ((parsed.protocol !== 'https:' && parsed.protocol !== 'http:') || !HOSTS[parsed.hostname]) {
      reply(id, false, '', 'blocked');
      return;
    }
    fetch(parsed.href, { credentials: 'omit', mode: 'cors', cache: 'default' })
      .then((response) => response.text().then((text) => reply(id, response.ok, text, response.ok ? '' : String(response.status))))
      .catch((error) => reply(id, false, '', String(error && error.message || error)));
  });

  function reply(id, ok, text, error) {
    window.postMessage({ source: 'bp-response', id: id, ok: ok, text: text || '', error: error || '' }, '*');
  }
})();
