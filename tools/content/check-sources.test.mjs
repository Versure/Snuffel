import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { isRealDate } from './rules/sources.mjs';
import { assertClean, assertIssue, assertNoIssue, fixtureRoot } from './test-helpers.mjs';

// In the fixture: steps[0].blocks[1] is the signal-cards block, steps[0].blocks[5] the tip that
// cites the low Decathlon source together with a high one.
const firstCardRefs = 'steps[0].blocks[1].cards[0].sourceRefs';

describe('sourceRefs exist', () => {
  test('source removed from course.json gives source-ref-missing', (t) => {
    const fixture = fixtureRoot(t);
    fixture.mutateCourse((course) => {
      course.sources = course.sources.filter((source) => source.id !== 'svnl-roofvis-9303');
    });
    const result = fixture.check();
    const error = assertIssue(
      result,
      'source-ref-missing',
      `${firstCardRefs}[0]`,
      fixture.lessonFile,
    );
    assert.match(
      error.message,
      /bron "svnl-roofvis-9303" staat niet in de bronnen van course\.json/,
    );
  });

  test('typo in a sourceRef gives source-ref-missing', (t) => {
    const fixture = fixtureRoot(t);
    fixture.mutateLesson((lesson) => {
      lesson.steps[2].questions[1].sourceRefs = ['svnl-visblad-streetfisihng'];
    });
    assertIssue(fixture.check(), 'source-ref-missing', 'steps[2].questions[1].sourceRefs[0]');
  });

  test('unknown furtherReading source gives source-ref-missing', (t) => {
    const fixture = fixtureRoot(t);
    fixture.mutateLesson((lesson) => {
      lesson.furtherReading[0].sourceRef = 'onbekende-bron';
    });
    assertIssue(fixture.check(), 'source-ref-missing', 'furtherReading[0].sourceRef');
  });

  test('refs on items, interaction steps and blocks are all checked', (t) => {
    const fixture = fixtureRoot(t);
    fixture.mutateLesson((lesson) => {
      lesson.steps[0].blocks[2].sourceRefs = ['weg'];
      lesson.steps[1].sourceRefs = ['weg'];
      lesson.steps[3].items[0].sourceRefs = ['weg'];
    });
    const result = fixture.check();
    assertIssue(result, 'source-ref-missing', 'steps[0].blocks[2].sourceRefs[0]');
    assertIssue(result, 'source-ref-missing', 'steps[1].sourceRefs[0]');
    assertIssue(result, 'source-ref-missing', 'steps[3].items[0].sourceRefs[0]');
  });
});

describe('every source has reliability and accessedOn', () => {
  test('the fixture sources all have reliability and a real accessedOn', (t) => {
    const fixture = fixtureRoot(t);
    for (const source of fixture.readCourse().sources) {
      assert.ok(['high', 'medium', 'low'].includes(source.reliability), source.id);
      assert.ok(isRealDate(source.accessedOn), source.id);
    }
    assertClean(fixture.check());
  });

  test('source without reliability is a schema error', (t) => {
    const fixture = fixtureRoot(t);
    fixture.mutateCourse((course) => {
      delete course.sources[1].reliability;
    });
    const error = assertIssue(
      fixture.check(),
      'schema',
      'sources[1].reliability',
      fixture.courseFile,
    );
    assert.match(error.message, /verplicht veld "reliability" ontbreekt/);
  });

  test('source without accessedOn is a schema error', (t) => {
    const fixture = fixtureRoot(t);
    fixture.mutateCourse((course) => {
      delete course.sources[1].accessedOn;
    });
    assertIssue(fixture.check(), 'schema', 'sources[1].accessedOn', fixture.courseFile);
  });

  test('impossible accessedOn gives source-date-invalid', (t) => {
    const fixture = fixtureRoot(t);
    fixture.mutateCourse((course) => {
      course.sources[0].accessedOn = '2026-02-30';
    });
    assertIssue(
      fixture.check(),
      'source-date-invalid',
      'sources[0].accessedOn',
      fixture.courseFile,
    );
  });

  test('future accessedOn gives source-date-future', (t) => {
    const fixture = fixtureRoot(t);
    fixture.mutateCourse((course) => {
      course.sources[0].accessedOn = '2026-10-23';
    });
    const result = fixture.check({ today: '2026-10-22' });
    const error = assertIssue(result, 'source-date-future', 'sources[0].accessedOn');
    assert.match(error.message, /2026-10-22/);
    assertNoIssue(fixture.check({ today: '2026-10-23' }), 'source-date-future');
  });

  test('isRealDate knows month lengths and leap years', () => {
    assert.equal(isRealDate('2024-02-29'), true);
    assert.equal(isRealDate('2026-02-29'), false);
    assert.equal(isRealDate('2026-13-01'), false);
    assert.equal(isRealDate('2026-04-31'), false);
    assert.equal(isRealDate('26-04-01'), false);
  });
});

describe('no claim rests on low sources only', () => {
  test('card citing only a low source gives source-only-low', (t) => {
    const fixture = fixtureRoot(t);
    fixture.mutateLesson((lesson) => {
      lesson.steps[0].blocks[1].cards[0].sourceRefs = ['decathlon-snoekkunstaas'];
    });
    const error = assertIssue(
      fixture.check(),
      'source-only-low',
      firstCardRefs,
      fixture.lessonFile,
    );
    assert.match(error.message, /decathlon-snoekkunstaas/);
  });

  test('low plus medium source is fine', (t) => {
    const fixture = fixtureRoot(t);
    fixture.mutateLesson((lesson) => {
      lesson.steps[0].blocks[1].cards[0].sourceRefs = ['decathlon-snoekkunstaas', 'vispas-check'];
    });
    assertClean(fixture.check());
    // The fixture itself shows the rule: the tip cites the low source together with a high one.
    const tip = fixture.readLesson().steps[0].blocks[5];
    assert.equal(tip.type, 'tip');
    assert.deepEqual(tip.sourceRefs, ['decathlon-snoekkunstaas', 'svnl-roofvis-9303']);
  });

  test('an empty list is allowed (the reviewer judges it)', (t) => {
    const fixture = fixtureRoot(t);
    fixture.mutateLesson((lesson) => {
      lesson.steps[0].blocks[1].cards[0].sourceRefs = [];
    });
    assertClean(fixture.check());
  });
});

describe('glossary references', () => {
  test('unknown [[term]] gives glossary-term-unknown', (t) => {
    const fixture = fixtureRoot(t);
    fixture.mutateLesson((lesson) => {
      lesson.steps[0].blocks[4].text += ' Gebruik een [[onbekend]] als dat helpt.';
    });
    const error = assertIssue(fixture.check(), 'glossary-term-unknown', 'steps[0].blocks[4].text');
    assert.match(error.message, /\[\[onbekend\]\]/);
  });

  test('[[term|form]] matches the glossary case-insensitively', (t) => {
    const fixture = fixtureRoot(t);
    fixture.mutateLesson((lesson) => {
      lesson.faq[0].a = 'Sla aan, [[Aanslaan|zo]] dus.';
    });
    assertClean(fixture.check());
  });
});
