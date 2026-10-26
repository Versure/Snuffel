import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { inlineFractionProblems } from './text.mjs';
import { assertClean, assertIssue, codes, fixtureRoot } from './test-helpers.mjs';

// In the fixture, steps[0].blocks[4] is a text block.
const textPath = 'steps[0].blocks[4].text';
const code = 'markup-fraction-invalid';

/** A fixture with `text` in the text block; returns the check result. */
function checkText(t, text) {
  const fixture = fixtureRoot(t);
  fixture.mutateLesson((lesson) => {
    lesson.steps[0].blocks[4].text = text;
  });
  return fixture.check();
}

/** Asserts exactly one markup-fraction-invalid error at the text block, with `message` in it. */
function assertFractionIssue(result, message, path = textPath) {
  const error = assertIssue(result, code, path);
  assert.ok(error.message.includes(message), error.message);
  assert.deepEqual(
    result.errors.filter((issue) => issue.code === code).length,
    1,
    codes(result).join('\n'),
  );
  return error;
}

describe('inlineFractionProblems', () => {
  test('gives a reason per {{ or }} that is not a valid fraction', () => {
    const reasons = (text) => inlineFractionProblems(text).map(({ reason }) => reason);
    assert.deepEqual(reasons('{{1/5}} en {{1 1/4}} en **{{5/4}}** en −{{1/2}} en 1/5'), []);
    assert.deepEqual(reasons('{{1,5/2}} {{1.5/2}}'), ['not-whole', 'not-whole']);
    assert.deepEqual(reasons('{{1/0}}'), ['zero-denominator']);
    assert.deepEqual(reasons('{{-1/2}} {{−1/2}}'), ['minus', 'minus']);
    assert.deepEqual(reasons('{{ 1/5 }} {{1 / 5}} {{1  1/4}}'), ['spaces', 'spaces', 'spaces']);
    assert.deepEqual(reasons('{{1 5/4}} {{0 1/4}} {{1 0/4}}'), [
      'mixed-improper',
      'mixed-improper',
      'mixed-improper',
    ]);
    assert.deepEqual(reasons('{{}} {{x/2}} {{1/2/3}} {{01/5}} {{**1/2**}}'), [
      'invalid',
      'invalid',
      'invalid',
      'invalid',
      'invalid',
    ]);
    assert.deepEqual(reasons('{{1/2}}} {{{1/2}} {{{1 1/4}}} a{{{3/4}}b'), [
      'stray-brace',
      'stray-brace',
      'stray-brace',
      'stray-brace',
    ]);
    assert.deepEqual(reasons('{{1/5 en verder'), ['unclosed']);
    assert.deepEqual(reasons('1/5}} en'), ['unopened']);
    assert.deepEqual(reasons('[{{1/2}}](https://example.org/a) en [[term|{{1/2}}]]'), [
      'inside-link-or-term',
      'inside-link-or-term',
    ]);
  });

  test('suggests a valid form for a minus and an improper mixed number', () => {
    assert.deepEqual(inlineFractionProblems('{{-1/2}}'), [
      { snippet: '{{-1/2}}', reason: 'minus', suggestion: '−{{1/2}}' },
    ]);
    assert.deepEqual(inlineFractionProblems('{{1 5/4}}'), [
      { snippet: '{{1 5/4}}', reason: 'mixed-improper', suggestion: '{{2 1/4}} of {{9/4}}' },
    ]);
    assert.deepEqual(inlineFractionProblems('{{0 1/4}}')[0].suggestion, '{{1/4}}');
    assert.deepEqual(inlineFractionProblems('Neem {{1/2}}} liter'), [
      { snippet: '{{1/2}}}', reason: 'stray-brace', suggestion: '{{1/2}}' },
    ]);
    assert.deepEqual(inlineFractionProblems('Neem {{{1/2}} liter'), [
      { snippet: '{{{1/2}}', reason: 'stray-brace', suggestion: '{{1/2}}' },
    ]);
    assert.deepEqual(inlineFractionProblems('{{{1 1/4}}}'), [
      { snippet: '{{{1 1/4}}}', reason: 'stray-brace', suggestion: '{{1 1/4}}' },
    ]);
  });
});

describe('markup-fraction-invalid', () => {
  test('a fraction with a decimal gives markup-fraction-invalid', (t) => {
    assertFractionIssue(
      checkText(t, 'Neem {{1,5/2}} liter.'),
      '"{{1,5/2}}" is geen geldige breuk: alleen hele getallen, zonder komma of punt.',
    );
  });

  test('a zero denominator gives markup-fraction-invalid', (t) => {
    assertFractionIssue(
      checkText(t, 'Neem {{1/0}} liter.'),
      '"{{1/0}}": de noemer van een breuk is nooit 0.',
    );
  });

  test('a minus inside the braces gives markup-fraction-invalid', (t) => {
    assertFractionIssue(
      checkText(t, 'Het is {{-1/2}} graden.'),
      '"{{-1/2}}": geen min binnen de haken; schrijf −{{1/2}}.',
    );
  });

  test('spaces inside the braces give markup-fraction-invalid', (t) => {
    assertFractionIssue(
      checkText(t, 'Neem {{ 1/5 }} liter.'),
      '"{{ 1/5 }}": geen spaties binnen de haken',
    );
    assertFractionIssue(checkText(t, 'Neem {{1 / 5}} liter.'), '"{{1 / 5}}": geen spaties');
  });

  test('an improper mixed number gives markup-fraction-invalid', (t) => {
    assertFractionIssue(
      checkText(t, 'Neem {{1 5/4}} liter.'),
      '"{{1 5/4}}": in een gemengd getal is het gehele getal minstens 1 en de teller kleiner dan de noemer; schrijf {{2 1/4}} of {{9/4}}.',
    );
    assertFractionIssue(checkText(t, 'Neem {{0 1/4}} liter.'), '"{{0 1/4}}": in een gemengd getal');
  });

  test('letters or nested markup give markup-fraction-invalid', (t) => {
    for (const snippet of ['{{x/2}}', '{{**1/2**}}', '{{1/2/3}}', '{{}}', '{{01/5}}']) {
      assertFractionIssue(
        checkText(t, `Neem ${snippet} liter.`),
        `"${snippet}" is geen geldige breuk. Schrijf {{teller/noemer}} of {{geheel teller/noemer}}, met hele getallen.`,
      );
    }
  });

  test('a lone { or } right next to a fraction gives markup-fraction-invalid', (t) => {
    assertFractionIssue(
      checkText(t, 'Neem {{1/2}}} liter.'),
      '"{{1/2}}}": een losse { of } direct naast een breuk; schrijf {{1/2}}.',
    );
    assertFractionIssue(
      checkText(t, 'Neem {{{1/2}} liter.'),
      '"{{{1/2}}": een losse { of } direct naast een breuk; schrijf {{1/2}}.',
    );
  });

  test('an unclosed {{ gives markup-fraction-invalid', (t) => {
    assertFractionIssue(checkText(t, 'Neem {{1/5 liter.'), '"{{1/5": {{ zonder }}.');
  });

  test('a lone }} gives markup-fraction-invalid', (t) => {
    assertFractionIssue(checkText(t, 'Neem 1/5}} liter.'), '"}}" zonder {{.');
  });

  test('a fraction in a link label or a term form gives markup-fraction-invalid', (t) => {
    assertFractionIssue(
      checkText(t, 'Lees [{{1/2}}](https://www.sportvisunie.nl/) eerst.'),
      '"{{1/2}}" mag niet in een link of in [[term|…]]: dat is platte tekst.',
    );
    const fixture = fixtureRoot(t);
    fixture.mutateLesson((lesson) => {
      const term = lesson.glossary[0].term;
      lesson.steps[0].blocks[4].text = `Dit is [[${term}|{{1/2}}]].`;
    });
    assertFractionIssue(fixture.check(), '"{{1/2}}" mag niet in een link of in [[term|…]]');
  });

  test('an invalid fraction in course.json gives markup-fraction-invalid', (t) => {
    const fixture = fixtureRoot(t);
    fixture.mutateCourse((course) => {
      course.goal = 'Breuken als {{1/0}} begrijpen';
    });
    const result = fixture.check();
    const error = assertIssue(result, code, 'goal', fixture.courseFile);
    assert.match(error.message, /de noemer van een breuk is nooit 0/);
  });

  test('an invalid fraction in an accepted answer gives markup-fraction-invalid', (t) => {
    const fixture = fixtureRoot(t);
    fixture.mutateLesson((lesson) => {
      lesson.steps[1].interaction = {
        id: 'breuken',
        kind: 'stepped-exercise',
        config: {
          exercises: [
            {
              id: 'som-1',
              prompt: 'Hoeveel is {{1/2}} + {{1/4}}?',
              answer: { type: 'text', accepted: ['3/4', '{{3/4'] },
              hints: [],
              steps: [],
              commonMistakes: [],
              workedSolution: '{{1/2}} is {{2/4}}, en {{2/4}} + {{1/4}} = {{3/4}}.',
            },
          ],
        },
      };
    });
    assertFractionIssue(
      fixture.check(),
      '"{{3/4": {{ zonder }}.',
      'steps[1].interaction.config.exercises[0].answer.accepted[1]',
    );
  });

  test('valid fractions are fine', (t) => {
    const fixture = fixtureRoot(t);
    fixture.mutateLesson((lesson) => {
      lesson.steps[0].blocks[4].text =
        'Neem {{1/5}}, {{1 1/4}} of {{5/4}} liter, **{{1/2}}** is veel en −{{1/2}} graden is koud.';
    });
    fixture.mutateCourse((course) => {
      course.goal = 'Breuken als {{1/5}} en {{1 1/4}} begrijpen';
    });
    assertClean(fixture.check());
  });
});
