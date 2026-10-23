(function () {
  function splitLines(html) {
    return String(html || '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .split('\n')
      .map((line) => line.replace(/\u00a0/g, ' ').replace(/[^\S\n]+/g, ' ').trim())
      .filter(Boolean);
  }

  function patternLine(line) {
    return String(line || '')
      .replace(/(\d+(?:\.\d+)?)\s*[—–\-−]\s*(\d+(?:\.\d+)?)/g, '#')
      .replace(/\d+(?:\.\d+)?/g, '#')
      .replace(/[（(]\s*#\s*[）)]/g, '#')
      .replace(/\+#/g, '#')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function formatNumber(value) {
    if (Number.isInteger(value)) return String(value);
    return String(Math.round(value * 10) / 10);
  }

  function boundValues(line) {
    const ranges = [];
    const rangePattern = /(\d+(?:\.\d+)?)\s*[—–\-−]\s*(\d+(?:\.\d+)?)/g;
    let match;
    while ((match = rangePattern.exec(String(line || '')))) {
      ranges.push({ low: Number(match[1]), high: Number(match[2]) });
    }
    if (ranges.length) {
      const low = formatNumber(ranges.reduce((sum, item) => sum + item.low, 0) / ranges.length);
      const high = formatNumber(ranges.reduce((sum, item) => sum + item.high, 0) / ranges.length);
      return low === high ? [low] : [low, high];
    }
    const singles = [];
    const numberPattern = /\d+(?:\.\d+)?/g;
    while ((match = numberPattern.exec(String(line || '')))) singles.push(formatNumber(Number(match[0])));
    return singles;
  }

  function summarize(mods) {
    const patterns = [];
    const tiers = [];
    (mods || []).forEach((mod) => {
      const lines = splitLines(mod && mod.str);
      if (!lines.length) return;
      lines.forEach((line) => {
        const pattern = patternLine(line);
        if (pattern && patterns.indexOf(pattern) === -1) patterns.push(pattern);
      });
      tiers.push(lines.map(boundValues).filter((values) => values.length));
    });
    return { patterns: patterns, tiers: tiers };
  }

  function extractModsViewJson(html) {
    const source = String(html || '');
    const marker = 'new ModsView(';
    const at = source.indexOf(marker);
    if (at < 0) return null;
    let start = at + marker.length;
    while (start < source.length && source.charAt(start) !== '{') start += 1;
    if (source.charAt(start) !== '{') return null;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = start; index < source.length; index += 1) {
      const char = source.charAt(index);
      if (inString) {
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === '"') inString = false;
        continue;
      }
      if (char === '"') {
        inString = true;
        continue;
      }
      if (char === '{') depth += 1;
      else if (char === '}') {
        depth -= 1;
        if (depth === 0) {
          try {
            return JSON.parse(source.slice(start, index + 1));
          } catch (error) {
            return null;
          }
        }
      }
    }
    return null;
  }

  function groupId(mod) {
    const family = mod && mod.ModFamilyList && mod.ModFamilyList[0] ? mod.ModFamilyList[0] : '';
    return String(mod && mod.ModGenerationTypeID || '') + family;
  }

  function modCatalog(data) {
    const grouped = new Map();
    if (!data || typeof data !== 'object') return grouped;
    Object.keys(data).forEach((category) => {
      const list = data[category];
      if (!Array.isArray(list)) return;
      list.forEach((mod) => {
        const id = groupId(mod);
        if (!id) return;
        const key = category + '\n' + id;
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key).push(mod);
      });
    });
    const catalog = new Map();
    grouped.forEach((mods, key) => catalog.set(key, summarize(mods)));
    return catalog;
  }

  function identifyCategory(className) {
    const names = String(className || '').split(/\s+/);
    const found = names.find((name) => name.indexOf('identify') === 0 && name !== 'identifyBlock');
    return found ? found.slice('identify'.length) : '';
  }

  function lookupGroup(category, genGroup, catalog) {
    if (!catalog || !genGroup) return null;
    if (category && catalog.has(category + '\n' + genGroup)) return catalog.get(category + '\n' + genGroup);
    const found = [];
    catalog.forEach((entry, key) => {
      if (key.slice(key.indexOf('\n') + 1) === genGroup) found.push(entry);
    });
    return found.length === 1 ? found[0] : null;
  }

  function lookupModEnglish(category, genGroup, catalog) {
    const entry = lookupGroup(category, genGroup, catalog);
    return entry && entry.patterns.length ? entry.patterns.join('\n') : '';
  }

  function lookupModTiers(category, genGroup, catalog) {
    const entry = lookupGroup(category, genGroup, catalog);
    return entry && entry.tiers ? entry.tiers.map((lines) => lines.slice()) : [];
  }

  const TRADE_POPUPS = new Set(['uniquepopup', 'normalpopup', 'magicpopup', 'rarepopup', 'newitempopup']);
  const ITEM_LINK_CLASSES = new Set(['uniqueitem', 'uniqueitems', 'whiteitem', 'rareitem', 'magicitem', 'item_unique']);

  function classTokens(el) {
    if (!el || el.nodeType !== 1) return [];
    if (typeof el.className === 'string') return el.className.split(/\s+/).filter(Boolean);
    if (el.classList) {
      const list = [];
      for (let i = 0; i < el.classList.length; i += 1) list.push(el.classList[i]);
      return list;
    }
    return [];
  }

  function hasClass(el, name) {
    return classTokens(el).indexOf(name) !== -1;
  }

  function hasClassFold(el, name) {
    const target = String(name || '').toLowerCase();
    return classTokens(el).some((token) => token.toLowerCase() === target);
  }

  function tagOf(el) {
    return el && el.tagName ? String(el.tagName).toLowerCase() : '';
  }

  function parentEl(el) {
    const parent = el && (el.parentElement || (el.parentNode && el.parentNode.nodeType === 1 ? el.parentNode : null));
    return parent && parent.nodeType === 1 ? parent : null;
  }

  function elementKids(el) {
    if (!el) return [];
    if (el.children) return Array.from(el.children);
    return (el.childNodes || []).filter((node) => node && node.nodeType === 1);
  }

  function walkElements(el, visit) {
    if (!el || el.nodeType !== 1) return;
    visit(el);
    elementKids(el).forEach((kid) => walkElements(kid, visit));
  }

  function isInside(node, ancestor) {
    let current = node;
    while (current) {
      if (current === ancestor) return true;
      current = parentEl(current);
    }
    return false;
  }

  function excludedTradeHost(el) {
    let node = el;
    while (node) {
      if (hasClassFold(node, 'GemPopup') || hasClassFold(node, 'identifyBlock') || hasClass(node, 'bp-mod-english') || hasClass(node, 'bp-enline') || hasClass(node, 'bp-dock')) return true;
      node = parentEl(node);
    }
    return false;
  }

  function insideTable(el) {
    let node = parentEl(el);
    while (node) {
      if (tagOf(node) === 'table') return true;
      node = parentEl(node);
    }
    return false;
  }

  function insideModifiersCalc(el) {
    let node = el;
    while (node) {
      if (node.id === 'ModifiersCalc') return true;
      node = parentEl(node);
    }
    return false;
  }

  function insideModal(el) {
    let node = el;
    while (node) {
      if (hasClass(node, 'modal')) return true;
      node = parentEl(node);
    }
    return false;
  }

  function isModText(el) {
    return hasClass(el, 'explicitMod') || hasClass(el, 'implicitMod') || hasClass(el, 'item_magic');
  }

  function isCardTitle(el) {
    if (hasClass(el, 'mod-title')) return true;
    const tag = tagOf(el);
    if (!hasClass(el, 'card-header') && tag !== 'h5') return false;
    let found = false;
    walkElements(el, (node) => {
      if (node !== el && (isModText(node) || hasClass(node, 'mod-value'))) found = true;
    });
    return found;
  }

  function isItemAnchor(el) {
    if (tagOf(el) !== 'a') return false;
    if (hasClassFold(el, 'KeywordPopups') || hasClassFold(el, 'GemTags')) return false;
    return classTokens(el).some((name) => ITEM_LINK_CLASSES.has(name.toLowerCase()));
  }

  function entryHasItemLink(el) {
    let node = parentEl(el);
    let entry = null;
    while (node) {
      if (tagOf(node) === 'body' || tagOf(node) === 'table' || node.id === 'ModifiersCalc' || hasClass(node, 'modal')) break;
      if (tagOf(node) === 'tr' || tagOf(node) === 'li' || hasClass(node, 'col') || hasClass(node, 'd-flex') || hasClass(node, 'card')) {
        entry = node;
        if (tagOf(node) === 'tr' || tagOf(node) === 'li' || hasClass(node, 'col')) break;
      }
      node = parentEl(node);
    }
    if (!entry) return false;
    let hit = false;
    walkElements(entry, (node) => {
      if (hit || node === el || isInside(node, el)) return;
      if (isItemAnchor(node)) hit = true;
    });
    return hit;
  }

  function insideTradePopup(el) {
    let node = parentEl(el);
    while (node) {
      if (classTokens(node).some((name) => TRADE_POPUPS.has(name.toLowerCase()))) return true;
      node = parentEl(node);
    }
    return false;
  }

  function shouldHashTradeNode(el) {
    if (!el || el.nodeType !== 1) return false;
    if (excludedTradeHost(el)) return false;
    const modText = isModText(el);
    const cardTitle = isCardTitle(el);
    if (!modText && !cardTitle) return false;
    if (insideTable(el) || insideModal(el) || insideModifiersCalc(el)) {
      return hasClass(el, 'mod-title') && !insideTable(el) && !insideModal(el);
    }
    if (insideTradePopup(el)) return modText || cardTitle;
    if (cardTitle) return true;
    return modText && entryHasItemLink(el);
  }

  const api = {
    splitLines: splitLines,
    patternLine: patternLine,
    extractModsViewJson: extractModsViewJson,
    modCatalog: modCatalog,
    identifyCategory: identifyCategory,
    lookupModEnglish: lookupModEnglish,
    lookupModTiers: lookupModTiers,
    shouldHashTradeNode: shouldHashTradeNode
  };
  globalThis.__BP = Object.assign(globalThis.__BP || {}, api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
