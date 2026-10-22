import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { sentenceStats, termPattern } from './rules/language.mjs';
import { assertClean, assertIssue, assertNoIssue, fixtureRoot } from './test-helpers.mjs';

describe('sentence length', () => {
  test('the fixture stays at or below 15 words per sentence', (t) => {
    const { average } = sentenceStats(fixtureRoot(t).readLesson());
    assert.ok(average > 0 && average <= 15, String(average));
  });

  test('long sentences give sentence-length', (t) => {
    const fixture = fixtureRoot(t);
    // Every counted text becomes one sentence of 20 words: the average is exactly 20.
    const twenty =
      'een twee drie vier vijf zes zeven acht negen tien elf twaalf dertien veertien vijftien zestien zeventien achttien negentien twintig.';
    fixture.mutateLesson((lesson) => {
      const visit = (value, key) => {
        if (Array.isArray(value)) return value.map((item) => visit(item));
        if (value && typeof value === 'object') {
          return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, visit(v, k)]));
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
          ? twenty
          : value;
      };
      const changed = visit(lesson);
      changed.ted = lesson.ted;
      changed.ted.intro.text = twenty;
      return changed;
    });
    const { average } = sentenceStats(fixture.readLesson());
    assert.equal(average, 20);
    const error = assertIssue(fixture.check(), 'sentence-length', '');
    assert.match(error.message, /gemiddeld 20,0 woorden per zin/);
  });
});

describe('subject terms', () => {
  function withoutGlossaryTerm(fixture, term) {
    fixture.mutateLesson((lesson) => {
      lesson.glossary = lesson.glossary.filter((entry) => entry.term !== term);
      // Also drop [[term]] references, so only the plain occurrences remain.
      const strip = (value) => {
        if (typeof value === 'string') {
          return value
            .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
            .replace(/\[\[([^\]]+)\]\]/g, '$1');
        }
        if (Array.isArray(value)) return value.map(strip);
        if (value && typeof value === 'object') {
          return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, strip(v)]));
        }
        return value;
      };
      return strip(lesson);
    });
  }

  test('a term from terms.json missing in the glossary gives term-not-in-glossary', (t) => {
    const fixture = fixtureRoot(t);
    withoutGlossaryTerm(fixture, 'aanslaan');
    const error = assertIssue(fixture.check(), 'term-not-in-glossary');
    assert.match(error.message, /vakterm "aanslaan"/);
  });

  test('an inflected form also counts', (t) => {
    const fixture = fixtureRoot(t);
    withoutGlossaryTerm(fixture, 'aanslaan');
    fixture.mutateLesson((lesson) => {
      // Only the forms "sla aan" and "slaat aan" are left in the text.
      const replace = (value) => {
        if (typeof value === 'string') return value.replace(/aanslaan/gi, 'binnenhalen');
        if (Array.isArray(value)) return value.map(replace);
        if (value && typeof value === 'object') {
          return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, replace(v)]));
        }
        return value;
      };
      const changed = replace(lesson);
      changed.steps[3].items[3].text = 'Wie iets voelt, roept tik en slaat aan.';
      return changed;
    });
    assert.doesNotMatch(JSON.stringify(fixture.readLesson()), /aanslaan/i);
    const error = assertIssue(fixture.check(), 'term-not-in-glossary');
    assert.match(error.message, /vakterm "aanslaan" \(gevonden als "(sla aan|slaat aan)"\)/i);
  });

  test('a term in the glossary is fine', (t) => {
    const fixture = fixtureRoot(t);
    withoutGlossaryTerm(fixture, 'aanslaan');
    fixture.mutateLesson((lesson) => {
      lesson.glossary.push({ term: 'Aanslaan', definition: 'de hengel kort omhoog halen' });
    });
    const result = fixture.check();
    assertNoIssue(result, 'term-not-in-glossary');
    assertClean(result);
  });

  test('terms match whole words only, case-insensitively, across spaces', () => {
    assert.ok(termPattern('VISpas').test('Neem je vispas mee.'));
    assert.ok(!termPattern('VISpas').test('Neem je JeugdVISpas mee.'));
    assert.ok(termPattern('gevlochten lijn').test('Een gevlochten\nlijn rekt niet.'));
    assert.ok(termPattern('shad').test('Een shad-achtig ding.'));
    assert.ok(!termPattern('shad').test('Een shadow.'));
  });
});
