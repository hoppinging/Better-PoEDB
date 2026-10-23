(function () {
  const SKIP_TAGS = new Set(['script', 'style', 'noscript', 'template', 'svg', 'canvas', 'iframe', 'form']);
  const BLOCK_TAGS = new Set(['html', 'body', 'head', 'main', 'aside', 'div', 'p', 'li', 'ul', 'ol', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'section', 'article', 'header', 'footer', 'nav', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'form', 'blockquote', 'dl', 'dt', 'dd', 'figure', 'figcaption', 'pre', 'address']);

  function bp() {
    return globalThis.__BP || {};
  }

  function nodeType(node) {
    return node && node.nodeType;
  }

  function isElement(node) {
    return nodeType(node) === 1;
  }

  function tagName(node) {
    return isElement(node) ? String(node.tagName || '').toLowerCase() : '';
  }

  const VOLATILE_CLASS = /^(?:tablesorter(?:-.*)?|odd|even|header|headerSort|headerSortUp|headerSortDown)$/;

  function classNames(node) {
    const names = rawClassNames(node).filter((name) => !VOLATILE_CLASS.test(name));
    return names;
  }

  function rawClassNames(node) {
    if (!isElement(node)) return [];
    if (typeof node.className === 'string') return node.className.split(/\s+/).filter(Boolean);
    if (node.classList && typeof node.classList.length === 'number') return Array.from(node.classList).filter(Boolean);
    return [];
  }

  function attr(node, name) {
    if (!isElement(node)) return '';
    if (typeof node.getAttribute === 'function') {
      const value = node.getAttribute(name);
      return value == null ? '' : String(value);
    }
    return '';
  }

  function childList(node) {
    if (!node || !node.childNodes) return [];
    return Array.from(node.childNodes);
  }

  function textData(node) {
    if (!node) return '';
    if (node.nodeValue != null) return String(node.nodeValue);
    if (node.textContent != null && nodeType(node) === 3) return String(node.textContent);
    return '';
  }

  function chromeSelf(node) {
    const tag = tagName(node);
    if (tag === 'nav' || tag === 'footer') return true;
    const id = attr(node, 'id');
    if (id === 'head_toolbar' || id === 'consent-box' || id === 'navautosearch') return true;
    const classes = classNames(node);
    return classes.indexOf('navbar') !== -1 || classes.indexOf('dropdown-menu') !== -1 || classes.indexOf('bp-dock') !== -1 || classes.indexOf('bp-enline') !== -1;
  }

  function hasBlockElementChild(node) {
    return childList(node).some((child) => isElement(child) && BLOCK_TAGS.has(tagName(child)) && classNames(child).indexOf('bp-enline') === -1);
  }

  function visibleText(node) {
    const parts = [];
    walk(node);
    return bp().normalizeBlock ? bp().normalizeBlock(parts.join('')) : parts.join('').trim();

    function walk(current) {
      if (!current) return;
      if (nodeType(current) === 3) {
        parts.push(textData(current));
        return;
      }
      if (!isElement(current)) return;
      const tag = tagName(current);
      if (SKIP_TAGS.has(tag) || classNames(current).indexOf('bp-enline') !== -1) return;
      if (tag === 'br') {
        parts.push('\n');
        return;
      }
      childList(current).forEach(walk);
    }
  }

  function isLineUnit(node) {
    if (!isElement(node)) return false;
    const tag = tagName(node);
    if (!tag || tag === 'document' || SKIP_TAGS.has(tag) || tag === 'button' || tag === 'input' || tag === 'textarea') return false;
    if (chromeSelf(node)) return false;
    if (hasBlockElementChild(node)) return false;
    const text = visibleText(node);
    if (!text) return false;
    const lib = bp();
    if (lib.hasHan && lib.hasLatin && !lib.hasHan(text) && !lib.hasLatin(text)) return false;
    return true;
  }

  function sameClasses(a, b) {
    const left = classNames(a).slice().sort().join(' ');
    const right = classNames(b).slice().sort().join(' ');
    return left === right;
  }

  function elementChildren(node) {
    return childList(node).filter((child) => {
      if (!isElement(child)) return false;
      const tag = tagName(child);
      if (!tag || SKIP_TAGS.has(tag) || tag === 'head' || tag === 'title' || tag === 'meta' || tag === 'link') return false;
      const classes = classNames(child);
      if (classes.indexOf('bp-enline') !== -1 || classes.indexOf('bp-dock') !== -1) return false;
      return true;
    });
  }

  function childKey(node) {
    const tag = tagName(node);
    const classes = classNames(node).slice().sort().join('.');
    const href = tag === 'a' ? (bp().hrefKey ? bp().hrefKey(attr(node, 'href')) : '') : '';
    const i18n = attr(node, 'data-i18n');
    const leaf = hasBlockElementChild(node) ? '' : (bp().skeleton ? bp().skeleton(visibleText(node)) : '');
    return [tag, classes, href, i18n, leaf].join('|');
  }

  function lcsPairs(a, b, keyOf) {
    const n = a.length;
    const m = b.length;
    if (!n || !m) return [];
    const ak = a.map(keyOf);
    const bk = b.map(keyOf);
    if (n === m && ak.every((key, index) => key === bk[index])) return a.map((item, index) => [item, b[index]]);
    if (n * m > 250000) return greedyPairs(a, b, ak, bk);
    const dp = new Array(n + 1);
    for (let i = 0; i <= n; i += 1) dp[i] = new Uint16Array(m + 1);
    for (let i = n - 1; i >= 0; i -= 1) {
      for (let j = m - 1; j >= 0; j -= 1) {
        if (ak[i] === bk[j]) dp[i][j] = dp[i + 1][j + 1] + 1;
        else dp[i][j] = dp[i + 1][j] >= dp[i][j + 1] ? dp[i + 1][j] : dp[i][j + 1];
      }
    }
    const pairs = [];
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
      if (ak[i] === bk[j]) {
        pairs.push([a[i], b[j]]);
        i += 1;
        j += 1;
      } else if (dp[i + 1][j] >= dp[i][j + 1]) i += 1;
      else j += 1;
    }
    return pairs;
  }

  function greedyPairs(a, b, ak, bk) {
    const pairs = [];
    let j = 0;
    for (let i = 0; i < a.length; i += 1) {
      let found = -1;
      const limit = Math.min(b.length, j + 40);
      for (let k = j; k < limit; k += 1) {
        if (ak[i] === bk[k]) {
          found = k;
          break;
        }
      }
      if (found >= 0) {
        pairs.push([a[i], b[found]]);
        j = found + 1;
      }
    }
    return pairs;
  }

  function lineUnitChildren(node) {
    return elementChildren(node).filter(isLineUnit);
  }

  function alignTree(zh, en, pairs, underUnit) {
    if (!isElement(zh) || !isElement(en)) return;
    if (tagName(zh) !== tagName(en) || !sameClasses(zh, en)) return;
    if (chromeSelf(zh) || chromeSelf(en)) return;
    const granular = !underUnit && lineUnitChildren(zh).length >= 2 && lineUnitChildren(en).length >= 2;
    let nested = underUnit;
    if (!underUnit && !granular && isLineUnit(zh) && isLineUnit(en)) {
      pairs.push({ node: zh, enNode: en, zhText: visibleText(zh), enText: visibleText(en) });
      nested = true;
    }
    const left = elementChildren(zh);
    const right = elementChildren(en);
    if (!left.length || !right.length) return;
    lcsPairs(left, right, childKey).forEach((pair) => alignTree(pair[0], pair[1], pairs, nested));
  }

  function alignRoots(zhRoot, enRoot) {
    const pairs = [];
    if (!zhRoot || !enRoot) return pairs;
    if (tagName(zhRoot) === tagName(enRoot) && sameClasses(zhRoot, enRoot)) {
      alignTree(zhRoot, enRoot, pairs, false);
      return pairs;
    }
    lcsPairs(elementChildren(zhRoot), elementChildren(enRoot), childKey).forEach((pair) => {
      alignTree(pair[0], pair[1], pairs, false);
    });
    return pairs;
  }

  function annotationPairs(zhRoot, enRoot) {
    const lib = bp();
    return alignRoots(zhRoot, enRoot).filter((pair) => !lib.shouldAnnotate || lib.shouldAnnotate(pair.zhText, pair.enText));
  }

  const api = {
    visibleText: visibleText,
    isLineUnit: isLineUnit,
    childKey: childKey,
    lcsPairs: lcsPairs,
    alignRoots: alignRoots,
    annotationPairs: annotationPairs
  };
  globalThis.__BP = Object.assign(globalThis.__BP || {}, api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
