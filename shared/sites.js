(function () {
  const HOSTS = new Set(['poedb.tw', 'www.poedb.tw', 'poe2db.tw', 'www.poe2db.tw']);
  const LANGS = new Set(['tw', 'us', 'cn', 'kr', 'ru', 'pt', 'fr', 'de', 'sp', 'es', 'th', 'jp', 'en']);

  function parseUrl(href) {
    try {
      return new URL(href, 'https://poedb.tw');
    } catch (error) {
      return null;
    }
  }

  function isProjectHost(hostname) {
    return HOSTS.has(String(hostname || '').toLowerCase());
  }

  function englishPageUrl(href) {
    const url = parseUrl(href);
    if (!url || !isProjectHost(url.hostname)) return '';
    const parts = url.pathname.split('/');
    if ((parts[1] || '').toLowerCase() !== 'tw') return '';
    parts[1] = 'us';
    url.pathname = parts.join('/') || '/us/';
    url.hash = '';
    return url.toString();
  }

  function hrefKey(href) {
    const raw = String(href || '').trim();
    if (!raw || raw.charAt(0) === '#' || /^javascript:/i.test(raw)) return '';
    let path = raw;
    if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) {
      const url = parseUrl(raw);
      if (!url) return '';
      path = url.pathname;
    }
    path = path.split('#')[0].split('?')[0];
    const parts = path.split('/').filter(Boolean);
    if (parts.length && LANGS.has(parts[0].toLowerCase())) parts.shift();
    return decodeURIComponentSafe(parts.join('/'));
  }

  function decodeURIComponentSafe(value) {
    try {
      return decodeURIComponent(value);
    } catch (error) {
      return value;
    }
  }

  function isAllowedFetchUrl(href) {
    const url = parseUrl(href);
    if (!url || (url.protocol !== 'https:' && url.protocol !== 'http:')) return false;
    return isProjectHost(url.hostname);
  }

  const api = { englishPageUrl, hrefKey, isAllowedFetchUrl, isProjectHost };
  globalThis.__BP = Object.assign(globalThis.__BP || {}, api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
