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
