import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { assertIssue, assertNoIssue, fixtureRoot } from './test-helpers.mjs';

/** The fixture lesson with a typing drill as an extra step after the explanation. */
function withDrill(t, config) {
  const fixture = fixtureRoot(t);
  fixture.mutateLesson((lesson) => {
    lesson.steps.splice(1, 0, {
      id: 'typen',
      type: 'interaction',
      title: 'Typen',
      intro: 'Typ de regels over.',
      interaction: { id: 'thuisrij', kind: 'typing-drill', config },
      sourceRefs: [],
    });
  });
  return fixture;
}

const base = 'steps[1].interaction.config';

describe('typing drill checks', () => {
  test('a drill whose new keys are all used has no typing issue', (t) => {
    const result = withDrill(t, {
      lines: ['asdf jkl;', 'als las'],
      newKeys: ['a', 's', 'd', 'f', 'j', 'k', 'l', ';', 'space'],
    }).check();
    assertNoIssue(result, 'typing-new-key-unused');
    assertNoIssue(result, 'typing-dead-key-sequence');
    assertNoIssue(result, 'schema');
  });

  test('a new key that no line uses gives typing-new-key-unused', (t) => {
    const result = withDrill(t, {
      lines: ['asdf jkl;'],
      newKeys: ['a', 'g', 'shift'],
    }).check();
    const error = assertIssue(result, 'typing-new-key-unused', `${base}.newKeys[1]`);
    assert.equal(error.message, 'toets "g" staat in newKeys maar in geen enkele regel');
    assertIssue(result, 'typing-new-key-unused', `${base}.newKeys[2]`);
    assert.equal(result.errors.filter((e) => e.code === 'typing-new-key-unused').length, 2);
  });

  test('shift counts as used by a capital', (t) => {
    for (const line of ['Als', 'jas:']) {
      const result = withDrill(t, { lines: [line], newKeys: ['shift', 'a'] }).check();
      assertNoIssue(result, 'typing-new-key-unused');
    }
  });

  test('a dead key before a vowel gives typing-dead-key-sequence', (t) => {
    const result = withDrill(t, {
      lines: ['asdf', "'en", 'zei "oei"'],
      newKeys: [],
    }).check();
    const error = assertIssue(result, 'typing-dead-key-sequence', `${base}.lines[1]`);
    assert.equal(
      error.message,
      "'e wordt op een US-International-toetsenbord é; zet er een spatie of een andere letter achter",
    );
    assert.match(
      assertIssue(result, 'typing-dead-key-sequence', `${base}.lines[2]`).message,
      /^"o wordt .* ö;/,
    );
  });

  test("auto's and zo'n are fine", (t) => {
    const result = withDrill(t, {
      lines: ["auto's", "zo'n", "'t is", 'zei "ja"', "auto' en"],
      newKeys: ["'"],
    }).check();
    assertNoIssue(result, 'typing-dead-key-sequence');
    assertNoIssue(result, 'typing-new-key-unused');
  });

  test('the lines of a drill are no lesson text', (t) => {
    // No markup or term check on what the child types.
    const result = withDrill(t, { lines: ['[[a]] {{1/0}} <b>'], newKeys: [] }).check();
    for (const code of ['glossary-term-unknown', 'markup-fraction-invalid', 'markup-html']) {
      assertNoIssue(result, code);
    }
  });
});
