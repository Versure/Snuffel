import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { interactionCatalog } from './catalog.mjs';
import { computeMinutes } from './rules/timing.mjs';
import { assertClean, assertIssue, assertNoIssue, fixtureRoot } from './test-helpers.mjs';

const sentence = 'De vis trekt kort aan je lijn en dan sla je meteen aan. ';

describe('reading time', () => {
  test('the fixture is between 8 and 12 minutes and close to estimatedMinutes', (t) => {
    const fixture = fixtureRoot(t);
    const lesson = fixture.readLesson();
    const { minutes, words, interactionMinutes, questionMinutes } = computeMinutes(lesson);
    assert.equal(interactionMinutes, 2);
    assert.equal(questionMinutes, 4);
    assert.equal(minutes, Math.round((words / 130 + 6) * 10) / 10);
    assert.ok(minutes >= 8 && minutes <= 12, String(minutes));
    assert.ok(Math.abs(lesson.estimatedMinutes - minutes) <= 2);
    assertClean(fixture.check());
  });

  test('every interaction in the catalogue counts 2 minutes', () => {
    assert.deepEqual(Object.keys(interactionCatalog).sort(), [
      'stepped-exercise',
      'trace-game',
      'typing-drill',
    ]);
    for (const { minutes } of Object.values(interactionCatalog)) assert.equal(minutes, 2);
  });

  test('feedback, hints and the FAQ do not count', (t) => {
    const fixture = fixtureRoot(t);
    const before = computeMinutes(fixture.readLesson()).minutes;
    fixture.mutateLesson((lesson) => {
      lesson.steps[2].questions[0].options[0].feedback += ` ${sentence.repeat(50)}`;
      lesson.steps[2].questions[0].hints.push(sentence.repeat(50));
      lesson.faq[0].a += ` ${sentence.repeat(50)}`;
    });
    assert.equal(computeMinutes(fixture.readLesson()).minutes, before);
  });

  test('too short lesson gives duration-out-of-range', (t) => {
    const fixture = fixtureRoot(t);
    fixture.mutateLesson((lesson) => {
      lesson.steps[0].blocks = lesson.steps[0].blocks.slice(0, 1);
      lesson.steps[0].blocks[0].text = 'Kort.';
      lesson.steps = lesson.steps.filter((step) => step.type === 'explain' || step.type === 'quiz');
    });
    const error = assertIssue(fixture.check(), 'duration-out-of-range', 'estimatedMinutes');
    assert.match(error.message, /berekende tijd is \d+,\d minuten/);
  });

  test('too long lesson gives duration-out-of-range', (t) => {
    const fixture = fixtureRoot(t);
    fixture.mutateLesson((lesson) => {
      lesson.estimatedMinutes = 12;
      lesson.steps[0].blocks[0].text += ` ${sentence.repeat(40)}`;
    });
    assertIssue(fixture.check(), 'duration-out-of-range', 'estimatedMinutes');
  });

  test('estimatedMinutes far from the computed time gives duration-mismatch', (t) => {
    const fixture = fixtureRoot(t);
    const { minutes } = computeMinutes(fixture.readLesson());
    // Three minutes off, within the schema range of 8 to 12.
    const estimate = minutes >= 10 ? Math.floor(minutes) - 3 : Math.ceil(minutes) + 3;
    assert.ok(estimate >= 8 && estimate <= 12, `fixture at ${minutes} min leaves no room`);
    fixture.mutateLesson((lesson) => {
      lesson.estimatedMinutes = estimate;
    });
    const result = fixture.check();
    const error = assertIssue(result, 'duration-mismatch', 'estimatedMinutes');
    assert.match(error.message, new RegExp(`estimatedMinutes is ${estimate}`));
    assertNoIssue(result, 'duration-out-of-range');
  });
});

describe('reading time: the boundaries', () => {
  /**
   * Shrinks every reading text to one word, then adds filler words to the objective until the
   * computed time is exactly `target` minutes. Other checks may report; only timing is asserted.
   */
  function tuneMinutes(fixture, target) {
    const shrink = (value, key) => {
      if (Array.isArray(value)) return value.map((item) => shrink(item));
      if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shrink(v, k)]));
      }
      return [
        'title',
        'text',
        'objective',
        'intro',
        'prompt',
        'caption',
        'successCriterion',
      ].includes(key)
        ? 'Kort.'
        : value;
    };
    fixture.mutateLesson((lesson) => {
      const changed = shrink(lesson);
      changed.ted = lesson.ted;
      changed.ted.intro.text = 'Kort.';
      for (let extra = 0; extra < 3000; extra += 1) {
        changed.objective = `Kort. ${'vis '.repeat(extra).trim()}`;
        if (computeMinutes(changed).minutes === target) return changed;
      }
      throw new Error(`cannot reach ${target} minutes`);
    });
    assert.equal(computeMinutes(fixture.readLesson()).minutes, target);
  }

  const setEstimate = (fixture, estimate) =>
    fixture.mutateLesson((lesson) => {
      lesson.estimatedMinutes = estimate;
    });

  test('exactly 8.0 and 12.0 minutes are fine, 7.9 and 12.1 are not', (t) => {
    for (const [target, fine] of [
      [8.0, true],
      [12.0, true],
      [7.9, false],
      [12.1, false],
    ]) {
      const fixture = fixtureRoot(t);
      tuneMinutes(fixture, target);
      setEstimate(fixture, Math.round(target) < 8 ? 8 : Math.round(target));
      const result = fixture.check();
      if (fine) assertNoIssue(result, 'duration-out-of-range');
      else assertIssue(result, 'duration-out-of-range', 'estimatedMinutes');
    }
  });

  test('a difference of exactly 2 minutes is fine, 2.1 gives duration-mismatch', (t) => {
    const fine = fixtureRoot(t);
    tuneMinutes(fine, 10.0);
    setEstimate(fine, 12);
    assertNoIssue(fine.check(), 'duration-mismatch');
    setEstimate(fine, 8);
    assertNoIssue(fine.check(), 'duration-mismatch');

    const off = fixtureRoot(t);
    tuneMinutes(off, 9.9);
    setEstimate(off, 12);
    assertIssue(off.check(), 'duration-mismatch', 'estimatedMinutes');

    const offLow = fixtureRoot(t);
    tuneMinutes(offLow, 10.1);
    setEstimate(offLow, 8);
    assertIssue(offLow.check(), 'duration-mismatch', 'estimatedMinutes');
  });
});
