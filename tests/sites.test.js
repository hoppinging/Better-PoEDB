const test = require('node:test');
const assert = require('node:assert/strict');
const sites = require('../shared/sites.js');

test('traditional pages map onto the english path', () => {
  assert.equal(sites.englishPageUrl('https://poedb.tw/tw/Fireball'), 'https://poedb.tw/us/Fireball');
  assert.equal(sites.englishPageUrl('https://poe2db.tw/tw/Fireball?q=1#stats'), 'https://poe2db.tw/us/Fireball?q=1');
  assert.equal(sites.englishPageUrl('https://www.poedb.tw/tw/'), 'https://www.poedb.tw/us/');
  assert.equal(sites.englishPageUrl('https://poedb.tw/tw'), 'https://poedb.tw/us');
});

test('other languages and hosts are left alone', () => {
  assert.equal(sites.englishPageUrl('https://poedb.tw/us/Fireball'), '');
  assert.equal(sites.englishPageUrl('https://poedb.tw/cn/Fireball'), '');
  assert.equal(sites.englishPageUrl('https://example.com/tw/Fireball'), '');
});

test('item links use the same key in both languages', () => {
  assert.equal(sites.hrefKey('/tw/Witch'), 'Witch');
  assert.equal(sites.hrefKey('https://poedb.tw/us/Witch'), 'Witch');
  assert.equal(sites.hrefKey('The_Twilight_Strand'), 'The_Twilight_Strand');
  assert.equal(sites.hrefKey('#top'), '');
});

test('page fetches stay on the project hosts', () => {
  assert.equal(sites.isAllowedFetchUrl('https://poedb.tw/us/Fireball'), true);
  assert.equal(sites.isAllowedFetchUrl('https://www.poe2db.tw/us/Fireball'), true);
  assert.equal(sites.isAllowedFetchUrl('http://poedb.tw/us/Fireball'), true);
  assert.equal(sites.isAllowedFetchUrl('https://cdn.poedb.tw/cache1/us/File/abc'), false);
  assert.equal(sites.isAllowedFetchUrl('https://cdn.poe2db.tw/cache1/us/File/abc'), false);
  assert.equal(sites.isAllowedFetchUrl('https://example.com/us/Fireball'), false);
  assert.equal(sites.resolveHoverUrl, undefined);
});
