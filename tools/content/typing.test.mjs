import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { schemaDir } from './schema.mjs';
import { DEAD_KEYS, deadKeySequences, keyForChar, keysOfLine } from './typing.mjs';

// The same cases as web/src/app/interactions/typing-drill/keyboard-layout.spec.ts.
const cases = JSON.parse(readFileSync(join(schemaDir, 'typing-keyboard.cases.json'), 'utf8'));
const schema = JSON.parse(readFileSync(join(schemaDir, 'lesson.schema.json'), 'utf8'));

const FINGERS = [
  'left-pinky',
  'left-ring',
  'left-middle',
  'left-index',
  'right-index',
  'right-middle',
  'right-ring',
  'right-pinky',
];

describe('typing keyboard', () => {
  test('maps every char in typing-keyboard.cases.json to its key and shift side', () => {
    assert.equal(cases.chars.length, 95);
    for (let code = 0x20; code <= 0x7e; code++) {
      const char = String.fromCharCode(code);
      const item = cases.chars.find((entry) => entry.char === char);
      assert.ok(item, `case for ${char}`);
      assert.deepEqual(keyForChar(char), { key: item.key, shift: item.shift }, char);
    }
    assert.equal(keyForChar('é'), null);
    assert.equal(keyForChar('\t'), null);
  });

  test('every key in the enum has a finger', () => {
    const keyIds = schema.$defs.typingKey.enum;
    assert.equal(keyIds.length, 49);
    for (const key of keyIds) {
      const item = cases.keys.find((entry) => entry.key === key);
      assert.ok(item, `case for key ${key}`);
      if (key === 'space') {
        assert.deepEqual([item.finger, item.hand], ['thumb', 'both']);
      } else if (key === 'shift') {
        assert.deepEqual([item.finger, item.hand], ['pinky', 'both']);
      } else {
        assert.ok(FINGERS.includes(item.finger), `${key}: ${item.finger}`);
        assert.equal(item.hand, item.finger.split('-')[0], key);
        assert.deepEqual(keyForChar(item.base), { key, shift: null });
        assert.equal(keyForChar(item.shift)?.key, key);
      }
    }
  });

  test('the shift of a char is on the other hand than its key', () => {
    for (const item of cases.chars.filter((entry) => entry.shift !== null)) {
      const key = cases.keys.find((entry) => entry.key === item.key);
      assert.notEqual(item.shift, key.hand, item.char);
    }
  });

  test('a line uses the keys of its chars and shift for a capital', () => {
    assert.deepEqual(keysOfLine('asdf jkl;'), ['a', 's', 'd', 'f', 'space', 'j', 'k', 'l', ';']);
    assert.deepEqual(keysOfLine('Al:'), ['a', 'shift', 'l', ';']);
  });

  test('finds every dead-key sequence in the cases and none in the allowed lines', () => {
    assert.deepEqual(
      DEAD_KEYS,
      Object.fromEntries(
        cases.deadKeySequences.deadKeys.map((item) => [item.deadKey, item.composes]),
      ),
    );
    const { cases: lines } = cases.deadKeySequences;
    assert.ok(lines.some((item) => item.found.length === 0));
    assert.ok(lines.some((item) => item.found.length > 0));
    for (const { name, line, found } of lines) {
      assert.deepEqual(deadKeySequences(line), found, name);
    }
  });
});
