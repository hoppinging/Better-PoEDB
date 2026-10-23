const test = require('node:test');
const assert = require('node:assert/strict');
require('../shared/text.js');
const mods = require('../shared/mods.js');

test('a to-range copies the lower-bound mean and the upper-bound mean', () => {
  const catalog = mods.modCatalog(mods.extractModsViewJson('new ModsView(' + JSON.stringify({
    normal: [
      { ModGenerationTypeID: '1', ModFamilyList: ['FireDamage'], str: 'Adds (19—27) to (30—42) Fire Damage' }
    ]
  }) + ')'));
  assert.equal(mods.lookupModEnglish('normal', '1FireDamage', catalog), 'Adds # to # Fire Damage');
  assert.deepEqual(mods.lookupModTiers('normal', '1FireDamage', catalog), [
    [['24.5', '34.5']]
  ]);
});

test('compound mods keep each line copyable', () => {
  const catalog = mods.modCatalog(mods.extractModsViewJson('new ModsView(' + JSON.stringify({
    normal: [
      { ModGenerationTypeID: '1', ModFamilyList: ['LocalDamage'], str: '(15—19)% increased Physical Damage<br>+(16—20) to Accuracy Rating' }
    ]
  }) + ')'));
  assert.deepEqual(mods.lookupModTiers('normal', '1LocalDamage', catalog), [
    [['15', '19'], ['16', '20']]
  ]);
});

test('unique mod numbers become trade-site hashes', () => {
  assert.equal(mods.patternLine('(300—400)% increased Physical Damage'), '#% increased Physical Damage');
  assert.equal(mods.patternLine('Adds (10—20) to (30—40) Fire Damage'), 'Adds # to # Fire Damage');
  assert.equal(mods.patternLine('Your Physical Damage can Shock'), 'Your Physical Damage can Shock');
  assert.equal(mods.slotsOf, undefined);
  assert.equal(mods.applyAverages, undefined);
});

function dom(tag, attrs, children) {
  const el = {
    nodeType: 1,
    tagName: String(tag || 'div').toUpperCase(),
    id: (attrs && attrs.id) || '',
    className: (attrs && attrs.class) || '',
    parentElement: null,
    childNodes: []
  };
  (children || []).forEach((child) => {
    child.parentElement = el;
    el.childNodes.push(child);
  });
  Object.defineProperty(el, 'children', {
    get() { return this.childNodes.filter((node) => node.nodeType === 1); }
  });
  return el;
}

function textNode(value) {
  return { nodeType: 3, nodeValue: value, textContent: value, parentElement: null };
}

test('trade hashes stay on item mods and mod titles', () => {
  const uniqueMod = dom('div', { class: 'explicitMod' }, [textNode('增加物理傷害')]);
  dom('div', { class: 'newItemPopup UniquePopup' }, [dom('div', { class: 'Stats' }, [uniqueMod])]);
  const gemMod = dom('div', { class: 'explicitMod' }, [textNode('造成火焰傷害')]);
  dom('div', { class: 'newItemPopup gemPopup' }, [dom('div', { class: 'Stats' }, [gemMod])]);
  const normalMod = dom('div', { class: 'implicitMod' }, [textNode('增加護甲')]);
  dom('div', { class: 'newItemPopup normalPopup' }, [normalMod]);
  const listed = dom('div', { class: 'explicitMod' }, [textNode('減少閃避值')]);
  dom('div', { class: 'col' }, [
    dom('div', { class: 'd-flex border-top' }, [
      dom('a', { class: 'UniqueItem', href: '/tw/Bristleboar' }, [textNode('鬃豬')]),
      dom('div', { class: 'flex-grow-1' }, [listed])
    ])
  ]);
  const keywordOnly = dom('div', { class: 'explicitMod' }, [
    dom('a', { class: 'KeywordPopups', href: 'Evasion' }, [textNode('閃避')])
  ]);
  dom('div', { class: 'card' }, [keywordOnly]);
  const enchant = dom('span', { class: 'explicitMod' }, [textNode('增加 8%')]);
  dom('table', {}, [dom('tbody', {}, [dom('tr', {}, [dom('td', {}, [enchant])])])]);
  const title = dom('div', { class: 'mod-title explicitMod', id: '' }, [textNode('火焰傷害')]);
  dom('div', { id: 'ModifiersCalc' }, [title]);
  const tier = dom('div', { class: 'explicitMod' }, [textNode('Adds 10 to 20')]);
  dom('div', { id: 'ModifiersCalc' }, [
    dom('div', { class: 'modal' }, [
      dom('table', {}, [dom('tr', {}, [dom('td', {}, [tier])])])
    ])
  ]);
  const identified = dom('div', { class: 'explicitMod' }, [textNode('識別區塊')]);
  dom('div', { class: 'identifyBlock identifynormal' }, [identified]);
  const header = dom('h5', { class: 'card-header' }, [
    dom('span', { class: 'item_magic' }, [textNode('減少 50% 閃避')])
  ]);
  dom('div', { class: 'card' }, [header]);
  const property = dom('div', { class: 'property' }, [textNode('等級 1')]);
  dom('div', { class: 'UniquePopup' }, [property]);

  assert.equal(mods.shouldHashTradeNode(uniqueMod), true);
  assert.equal(mods.shouldHashTradeNode(gemMod), false);
  assert.equal(mods.shouldHashTradeNode(normalMod), true);
  assert.equal(mods.shouldHashTradeNode(listed), true);
  assert.equal(mods.shouldHashTradeNode(keywordOnly), false);
  assert.equal(mods.shouldHashTradeNode(enchant), false);
  assert.equal(mods.shouldHashTradeNode(title), true);
  assert.equal(mods.shouldHashTradeNode(tier), false);
  assert.equal(mods.shouldHashTradeNode(identified), false);
  assert.equal(mods.shouldHashTradeNode(header), true);
  assert.equal(mods.shouldHashTradeNode(property), false);
});
