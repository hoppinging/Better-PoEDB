const test = require('node:test');
const assert = require('node:assert/strict');
const text = require('../shared/text.js');

test('numbers and punctuation line up across languages', () => {
  assert.equal(text.skeleton('造成 (9—1883) 至 (14—2825) 火焰傷害'), text.skeleton('Deals (9-1883) to (14-2825) Fire Damage'));
  assert.equal(text.skeleton('（點燃持續 4 秒）'), text.skeleton('(Ignite for 4 seconds)'));
  assert.equal(text.skeleton('等級: (1—20)'), text.skeleton('Level: (1-20)'));
});

test('a copy button reads the english immediately before it', () => {
  function piece(className, value) {
    return {
      className: className,
      classList: { contains(name) { return className.split(/\s+/).indexOf(name) !== -1; } },
      textContent: value,
      previousElementSibling: null
    };
  }
  const first = piece('bp-entext', '24.5');
  const firstButton = piece('bp-copy', '复制');
  const second = piece('bp-entext', '34.5');
  const secondButton = piece('bp-copy', '复制');
  [first, firstButton, second, secondButton].reduce((previous, item) => {
    item.previousElementSibling = previous;
    return item;
  }, null);
  assert.equal(text.adjacentCopyText(firstButton), '24.5');
  assert.equal(text.adjacentCopyText(secondButton), '34.5');
  assert.equal(text.adjacentCopyText(first), '');
});

test('chinese lines are annotated only when the english line is actually english', () => {
  assert.equal(text.shouldAnnotate('火球', 'Fireball'), true);
  assert.equal(text.shouldAnnotate('火球', '火球'), false);
  assert.equal(text.shouldAnnotate('Fireball', 'Fireball'), false);
  assert.equal(text.shouldAnnotate('10.4 metres per Second', '10.4 metres per Second'), false);
  assert.equal(text.shouldAnnotate('造成 9 至 14 火焰傷害', 'Deals 9 to 14 Fire Damage'), true);
  assert.equal(text.shouldAnnotate('造成 9 至 14 火焰傷害', 'Deals 10 to 14 Fire Damage'), false);
  assert.equal(text.shouldAnnotate('任務 /2', 'Quest /2'), true);
});
