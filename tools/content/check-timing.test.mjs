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
    assert.deepEqual(Object.keys(interactionCatalog).sort(), ['stepped-exercise', 'trace-game']);
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
