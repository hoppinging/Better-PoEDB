const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

require('../shared/sites.js');
require('../shared/text.js');
const html = require('../shared/html.js');
const align = require('../shared/align.js');

function el(tag, attrs, children) {
  return {
    nodeType: 1,
    tagName: tag.toUpperCase(),
    className: (attrs && attrs.class) || '',
    attrs: attrs || {},
    getAttribute(name) {
      return Object.prototype.hasOwnProperty.call(this.attrs, name) ? this.attrs[name] : null;
    },
    childNodes: children || []
  };
}

function text(value) {
  return { nodeType: 3, nodeValue: value };
}

test('an inserted line does not shift the surrounding mods', () => {
  const zh = el('div', { class: 'Stats' }, [
    el('div', { class: 'explicitMod' }, [text('造成 (9—20) 火焰傷害')]),
    el('div', { class: 'explicitMod' }, [text('額外 99% 機率')]),
    el('div', { class: 'explicitMod' }, [text('基礎範圍為 (1—2) 米')])
  ]);
  const en = el('div', { class: 'Stats' }, [
    el('div', { class: 'explicitMod' }, [text('Deals (9-20) Fire Damage')]),
    el('div', { class: 'explicitMod' }, [text('Base radius is (1-2) metres')])
  ]);
  const pairs = align.annotationPairs(zh, en).map((pair) => [pair.zhText, pair.enText]);
  assert.deepEqual(pairs, [
    ['造成 (9—20) 火焰傷害', 'Deals (9-20) Fire Damage'],
    ['基礎範圍為 (1—2) 米', 'Base radius is (1-2) metres']
  ]);
});

test('navigation is ignored and links keep their own line', () => {
  const zh = el('body', {}, [
    el('nav', { class: 'navbar' }, [el('a', { href: '/tw/Gem' }, [text('寶石')])]),
    el('div', { class: 'card' }, [el('h5', { class: 'card-header' }, [text('任務 /2')])])
  ]);
  const en = el('body', {}, [
    el('nav', { class: 'navbar' }, [el('a', { href: '/us/Gem' }, [text('Gems')])]),
    el('div', { class: 'card' }, [el('h5', { class: 'card-header' }, [text('Quest /2')])])
  ]);
  const pairs = align.annotationPairs(zh, en);
  assert.deepEqual(pairs.map((pair) => pair.enText), ['Quest /2']);
});

test('the fireball item box copies whole english lines', () => {
  const zh = html.parseHtml(fs.readFileSync(path.join(__dirname, 'fixtures/item-zh.html'), 'utf8'));
  const en = html.parseHtml(fs.readFileSync(path.join(__dirname, 'fixtures/item-en.html'), 'utf8'));
  const pairs = align.annotationPairs(zh, en);
  const map = new Map(pairs.map((pair) => [pair.zhText, pair.enText]));
  assert.equal(map.get('火球'), 'Fireball');
  assert.equal(map.get('投射物'), 'Projectile');
  assert.equal(map.get('法術'), 'Spell');
  assert.equal(map.get('範圍效果'), 'AoE');
  assert.equal(map.get('火焰'), 'Fire');
  assert.equal(map.has('投射物, 法術, 範圍效果, 火焰'), false);
  assert.equal(map.get('釋放一顆球型火焰向前飛射，接觸到怪物時會爆炸並對周圍敵人造成傷害'), 'Unleashes a ball of fire towards a target which explodes, damaging nearby foes.');
  assert.match(map.get('造成 (9—1883) 至 (14—2825) 火焰傷害') || '', /^Deals /);
  assert.match(map.get('25% 機率點燃敵人') || '', /Ignite enemies$/);
  assert.match(map.get('將其放置於物品上的插槽來獲得這項技能。點擊右鍵從插槽中取出。') || '', /^Place into an item socket/);
  assert.equal(map.has('Fireball'), false);
  assert.equal(pairs.some((pair) => pair.zhText === '米' || pair.enText === 'metre'), false);
});


test('a keyword list keeps each term with its own english', () => {
  const zh = el('div', {}, [
    el('a', { href: '/tw/Physical_damage' }, [text('物理傷害')]),
    text(' · '),
    el('a', { href: '/tw/Fire_damage' }, [text('火焰傷害')]),
    text(' · '),
    el('a', { href: '/tw/Cold_damage' }, [text('冰冷傷害')])
  ]);
  const en = el('div', {}, [
    el('a', { href: '/us/Physical_damage' }, [text('Physical damage')]),
    text(' · '),
    el('a', { href: '/us/Fire_damage' }, [text('Fire damage')]),
    text(' · '),
    el('a', { href: '/us/Cold_damage' }, [text('Cold damage')])
  ]);
  assert.deepEqual(align.annotationPairs(zh, en).map((pair) => [pair.zhText, pair.enText]), [
    ['物理傷害', 'Physical damage'],
    ['火焰傷害', 'Fire damage'],
    ['冰冷傷害', 'Cold damage']
  ]);
});

test('html and body wrappers still reach the article', () => {
  const zh = el('html', {}, [
    el('head', {}, [el('title', {}, [text('火球')])]),
    el('body', {}, [el('h1', {}, [text('火球')])])
  ]);
  const en = el('html', {}, [
    el('head', {}, [el('title', {}, [text('Fireball')])]),
    el('body', {}, [el('h1', {}, [text('Fireball')])])
  ]);
  assert.deepEqual(align.annotationPairs(zh, en).map((pair) => [pair.zhText, pair.enText]), [['火球', 'Fireball']]);
});

test('tablesorter classes still leave each mod paired', () => {
  const zh = el('table', { class: 'table filters tablesorter' }, [
    el('tbody', {}, [
      el('tr', { class: 'odd' }, [
        el('td', {}, [text('尊師之')]),
        el('td', {}, [el('span', { class: 'explicitMod' }, [text('增加 (15—20)% 傷害')])])
      ])
    ])
  ]);
  const en = el('table', { class: 'table filters' }, [
    el('tbody', {}, [
      el('tr', {}, [
        el('td', {}, [text('of the Elder')]),
        el('td', {}, [el('span', { class: 'explicitMod' }, [text('Adds (15-20)% damage')])])
      ])
    ])
  ]);
  assert.deepEqual(align.annotationPairs(zh, en).map((pair) => [pair.zhText, pair.enText]), [
    ['尊師之', 'of the Elder'],
    ['增加 (15—20)% 傷害', 'Adds (15-20)% damage']
  ]);
});
