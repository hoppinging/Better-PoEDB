(function () {
  const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);

  function decode(text) {
    return String(text)
      .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
      .replace(/&#(\d+);/g, (_, num) => String.fromCodePoint(parseInt(num, 10)))
      .replace(/&nbsp;/gi, '\u00a0')
      .replace(/&quot;/gi, '"')
      .replace(/&apos;/gi, "'")
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&amp;/gi, '&');
  }

  function makeEl(tag, attrs) {
    return {
      nodeType: 1,
      tagName: String(tag || 'div').toUpperCase(),
      className: attrs.class || '',
      attrs: attrs,
      getAttribute(name) {
        return Object.prototype.hasOwnProperty.call(this.attrs, name) ? this.attrs[name] : null;
      },
      childNodes: []
    };
  }

  function parseStart(raw) {
    const source = String(raw || '').trim();
    if (!source || source.charAt(0) === '!' || source.charAt(0) === '?') return null;
    let i = 0;
    while (i < source.length && !/\s/.test(source.charAt(i))) i += 1;
    const tag = source.slice(0, i).toLowerCase();
    const attrs = {};
    while (i < source.length) {
      while (i < source.length && /\s/.test(source.charAt(i))) i += 1;
      if (i >= source.length) break;
      let nameStart = i;
      while (i < source.length && source.charAt(i) !== '=' && !/\s/.test(source.charAt(i))) i += 1;
      const name = source.slice(nameStart, i).toLowerCase();
      if (!name) break;
      while (i < source.length && /\s/.test(source.charAt(i))) i += 1;
      if (source.charAt(i) !== '=') {
        attrs[name] = '';
        continue;
      }
      i += 1;
      while (i < source.length && /\s/.test(source.charAt(i))) i += 1;
      let quote = source.charAt(i);
      if (quote === '"' || quote === "'") {
        i += 1;
        const end = source.indexOf(quote, i);
        const value = source.slice(i, end < 0 ? source.length : end);
        attrs[name] = decode(value);
        i = end < 0 ? source.length : end + 1;
      } else {
        const start = i;
        while (i < source.length && !/\s/.test(source.charAt(i))) i += 1;
        attrs[name] = decode(source.slice(start, i));
      }
    }
    return { tag: tag, attrs: attrs };
  }

  function findTagEnd(source, start) {
    let quote = '';
    for (let i = start; i < source.length; i += 1) {
      const ch = source.charAt(i);
      if (quote) {
        if (ch === quote) quote = '';
        continue;
      }
      if (ch === '"' || ch === "'") {
        quote = ch;
        continue;
      }
      if (ch === '>') return i;
    }
    return -1;
  }

  function closeTag(stack, tag) {
    for (let i = stack.length - 1; i > 0; i -= 1) {
      if (stack[i].tagName.toLowerCase() === tag) {
        stack.length = i;
        return;
      }
    }
  }

  function parseHtml(html) {
    const root = makeEl('document', {});
    const stack = [root];
    const source = String(html || '');
    let i = 0;
    while (i < source.length) {
      if (source.startsWith('<!--', i)) {
        const end = source.indexOf('-->', i + 4);
        i = end < 0 ? source.length : end + 3;
        continue;
      }
      if (source.charAt(i) === '<') {
        if (source.startsWith('</', i)) {
          const end = source.indexOf('>', i + 2);
          const name = source.slice(i + 2, end < 0 ? source.length : end).trim().split(/\s+/)[0].toLowerCase();
          if (end < 0) break;
          i = end + 1;
          closeTag(stack, name);
          continue;
        }
        const end = findTagEnd(source, i + 1);
        if (end < 0) break;
        let raw = source.slice(i + 1, end).trim();
        i = end + 1;
        const selfClose = /\/$/.test(raw);
        if (selfClose) raw = raw.replace(/\/$/, '').trim();
        const parsed = parseStart(raw);
        if (!parsed || !parsed.tag) continue;
        const node = makeEl(parsed.tag, parsed.attrs);
        stack[stack.length - 1].childNodes.push(node);
        if (!selfClose && !VOID.has(parsed.tag)) {
          stack.push(node);
          if (parsed.tag === 'script' || parsed.tag === 'style') {
            const closer = new RegExp('<\\/' + parsed.tag + '\\s*>', 'i');
            const rest = source.slice(i);
            const match = closer.exec(rest);
            const text = match ? rest.slice(0, match.index) : rest;
            if (text) node.childNodes.push({ nodeType: 3, nodeValue: text });
            i += match ? match.index + match[0].length : rest.length;
            stack.pop();
          }
        }
        continue;
      }
      const next = source.indexOf('<', i);
      const text = source.slice(i, next < 0 ? source.length : next);
      i = next < 0 ? source.length : next;
      if (text) stack[stack.length - 1].childNodes.push({ nodeType: 3, nodeValue: decode(text) });
    }
    return root;
  }

  const api = { parseHtml, decode };
  globalThis.__BP = Object.assign(globalThis.__BP || {}, api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
