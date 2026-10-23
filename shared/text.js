(function () {
  function hasHan(text) {
    return /[\u3400-\u9fff]/.test(text);
  }

  function hasLatin(text) {
    return /[A-Za-z]/.test(text);
  }

  function hanCount(text) {
    return (String(text).match(/[\u3400-\u9fff]/g) || []).length;
  }

  function latinCount(text) {
    return (String(text).match(/[A-Za-z]/g) || []).length;
  }

  function normalizeBlock(text) {
    return String(text || '')
      .replace(/\u00a0/g, ' ')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n')
      .map((line) => line.replace(/[^\S\n]+/g, ' ').trim())
      .filter((line, index, lines) => line || (index > 0 && lines[index - 1]))
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function foldPunct(text) {
    return String(text || '')
      .replace(/[：﹕]/g, ':')
      .replace(/[，、﹐]/g, ',')
      .replace(/[（]/g, '(')
      .replace(/[）]/g, ')')
      .replace(/[％]/g, '%')
      .replace(/[－–—−]/g, '-')
      .replace(/[～~]/g, '~')
      .replace(/[×xX]/g, 'x');
  }

  function skeleton(text) {
    const folded = foldPunct(normalizeBlock(text));
    const numbers = folded.match(/\d+(?:[.,]\d+)*/g) || [];
    return numbers.map((value) => value.replace(/,/g, '')).join(',');
  }

  function adjacentCopyText(button) {
    let node = button && button.previousElementSibling;
    while (node) {
      const classes = node.classList;
      const named = typeof node.className === 'string' ? node.className.split(/\s+/) : [];
      if ((classes && classes.contains && classes.contains('bp-entext')) || named.indexOf('bp-entext') !== -1) {
        return String(node.textContent || '');
      }
      node = node.previousElementSibling;
    }
    return '';
  }

  function shouldAnnotate(zh, en) {
    const source = normalizeBlock(zh);
    const target = normalizeBlock(en);
    if (!source || !target || source === target) return false;
    if (!hasHan(source) || !hasLatin(target)) return false;
    if (hanCount(target) > latinCount(target)) return false;
    if (skeleton(source) !== skeleton(target)) return false;
    if (target.length > 1500) return false;
    return true;
  }

  const api = { hasHan, hasLatin, hanCount, latinCount, normalizeBlock, foldPunct, skeleton, shouldAnnotate, adjacentCopyText };
  globalThis.__BP = Object.assign(globalThis.__BP || {}, api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
