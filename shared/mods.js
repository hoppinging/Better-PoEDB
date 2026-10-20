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

  function slotsOf(line) {
    const found = [];
    const pattern = /(\d+(?:\.\d+)?)(?:\s*[—–\-−]\s*(\d+(?:\.\d+)?))?/g;
    let match;
    while ((match = pattern.exec(String(line || '')))) {
      const low = Number(match[1]);
      const high = match[2] == null ? low : Number(match[2]);
      found.push({ low: low, high: high });
    }
    return found;
  }

  function mean(values) {
    const total = values.reduce((sum, value) => sum + value, 0);
    const average = total / values.length;
    if (values.every((value) => Number.isInteger(value))) return String(Math.round(average));
    return String(Math.round(average * 10) / 10);
  }

  function applyAverages(template, stats) {
    let index = 0;
    return String(template).replace(/(\d+(?:\.\d+)?)(\s*[—–\-−]\s*)(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)/g, (full, low, separator, high) => {
      const stat = stats[index];
      index += 1;
      if (!stat) return full;
      if (high != null) return stat.low === stat.high ? stat.low : stat.low + separator + stat.high;
      return stat.low;
    });
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

  const api = {
    splitLines: splitLines,
    patternLine: patternLine,
    extractModsViewJson: extractModsViewJson,
    modCatalog: modCatalog,
    identifyCategory: identifyCategory,
    lookupModEnglish: lookupModEnglish,
    lookupModTiers: lookupModTiers
  };
  globalThis.__BP = Object.assign(globalThis.__BP || {}, api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
