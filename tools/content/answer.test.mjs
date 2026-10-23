import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { checkAnswer, normalizeText, parseNumber } from './answer.mjs';
import { schemaDir } from './schema.mjs';

// The same cases as web/src/app/interactions/stepped-exercise/answer.spec.ts.
const cases = JSON.parse(readFileSync(join(schemaDir, 'answer-matching.cases.json'), 'utf8'));

describe('answer matching', () => {
  test('reads every number in answer-matching.cases.json', () => {
    assert.ok(cases.numbers.length > 20);
    for (const { name, input, unit, value } of cases.numbers) {
      assert.equal(parseNumber(input, unit), value, name);
    }
  });

  test('normalizes every text in answer-matching.cases.json', () => {
    assert.ok(cases.texts.length > 5);
    for (const { name, input, normalized } of cases.texts) {
      assert.equal(normalizeText(input), normalized, name);
    }
  });

  test('gives the outcome of every answer in answer-matching.cases.json', () => {
    assert.ok(cases.answers.length > 15);
    for (const { name, answer, commonMistakes, input, outcome, feedback } of cases.answers) {
      const expected = feedback === undefined ? { outcome } : { outcome, feedback };
      assert.deepEqual(checkAnswer(answer, input, commonMistakes), expected, name);
    }
  });

  test('the cases cover every outcome and every answer type', () => {
    const outcomes = new Set(cases.answers.map((item) => item.outcome));
    assert.deepEqual([...outcomes].sort(), ['correct', 'empty', 'mistake', 'unreadable', 'wrong']);
    const types = new Set(cases.answers.map((item) => item.answer.type));
    assert.deepEqual([...types].sort(), ['choice', 'number', 'text']);
    for (const type of types) {
      assert.ok(
        cases.answers.some((item) => item.answer.type === type && item.outcome === 'mistake'),
        `a recognised mistake for ${type}`,
      );
    }
  });
});
