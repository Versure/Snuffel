import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, renameSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { externalReferences, isValidAssetPath } from './rules/assets.mjs';
import { courseTexts } from './rules/links.mjs';
import { trackerReason } from './trackers.mjs';
import { assertClean, assertIssue, codes, fixtureRoot } from './test-helpers.mjs';

// In the fixture, steps[0].blocks[4] is a text block and steps[0].blocks[6] the figure.
const textPath = 'steps[0].blocks[4].text';
const figurePath = 'steps[0].blocks[6]';

describe('links', () => {
  test('http source gives link-not-https', (t) => {
    const fixture = fixtureRoot(t);
    fixture.mutateCourse((course) => {
      course.sources[1].url = 'http://www.sportvisserijnederland.nl/files/rvnl_5997.pdf';
    });
    assertIssue(fixture.check(), 'link-not-https', 'sources[1].url', fixture.courseFile);
  });

  test('http link on a checklist item gives link-not-https', (t) => {
    const fixture = fixtureRoot(t);
    fixture.mutateLesson((lesson) => {
      lesson.steps[3].items[0].links[0].url = 'http://www.sportvisunie.nl/';
    });
    assertIssue(fixture.check(), 'link-not-https', 'steps[3].items[0].links[0].url');
  });

  test('javascript link in text gives link-not-https', (t) => {
    const fixture = fixtureRoot(t);
    fixture.mutateLesson((lesson) => {
      lesson.steps[0].blocks[4].text += ' [Klik hier](javascript:alert(1)).';
    });
    assertIssue(fixture.check(), 'link-not-https', textPath, fixture.lessonFile);
  });

  test('data and relative links in text give link-not-https', (t) => {
    const fixture = fixtureRoot(t);
    fixture.mutateLesson((lesson) => {
      lesson.faq[0].a += ' [plaatje](data:text/html,hoi) of [daar](/leren/proefcursus).';
    });
    const result = fixture.check();
    assert.equal(
      result.errors.filter((error) => error.code === 'link-not-https' && error.path === 'faq[0].a')
        .length,
      2,
    );
  });

  test('a https link in text is fine', (t) => {
    const fixture = fixtureRoot(t);
    fixture.mutateLesson((lesson) => {
      lesson.faq[0].a +=
        ' Lees ook [Hét Visblad](https://www.sportvisserijnederland.nl/files/rvnl_5997.pdf).';
    });
    assertClean(fixture.check());
  });

  test('javascript link in course goal gives link-not-https', (t) => {
    const fixture = fixtureRoot(t);
    fixture.mutateCourse((course) => {
      course.goal += ' [Klik hier](javascript:alert(1))';
    });
    assertIssue(fixture.check(), 'link-not-https', 'goal', fixture.courseFile);
  });

  test('http link in a course source note and lesson title gives link-not-https', (t) => {
    const fixture = fixtureRoot(t);
    fixture.mutateCourse((course) => {
      course.sources[0].note = 'Zie ook [deze pagina](http://www.sportvisunie.nl/).';
      course.ted.greeting += ' [Hoi](/leren)';
    });
    const result = fixture.check();
    assertIssue(result, 'link-not-https', 'sources[0].note', fixture.courseFile);
    assertIssue(result, 'link-not-https', 'ted.greeting', fixture.courseFile);
  });

  test('javascript link and html in a source publisher are reported', (t) => {
    const fixture = fixtureRoot(t);
    fixture.mutateCourse((course) => {
      course.sources[0].publisher = '[SVNL](javascript:alert(1))';
      course.sources[1].publisher = '<b>SVNL</b>';
    });
    const result = fixture.check();
    assertIssue(result, 'link-not-https', 'sources[0].publisher', fixture.courseFile);
    assertIssue(result, 'markup-html', 'sources[1].publisher', fixture.courseFile);
  });

  test('every text field in course.schema.json is checked', () => {
    const schema = JSON.parse(
      readFileSync(new URL('../../content/schema/v1/course.schema.json', import.meta.url), 'utf8'),
    );
    const schemaFields = new Set();
    const walk = (node) => {
      if (!node || typeof node !== 'object') return;
      for (const [name, value] of Object.entries(node.properties ?? {})) {
        if (value?.$ref === '#/$defs/text') schemaFields.add(name);
      }
      for (const value of Object.values(node)) walk(value);
    };
    walk(schema);
    const course = {
      title: 't',
      audience: 't',
      goal: 't',
      successCriterion: 't',
      subject: 't',
      schoolLevel: 't',
      method: 't',
      chapter: 't',
      ted: { greeting: 't' },
      lessons: [{ title: 't' }],
      sources: [{ title: 't', publisher: 't', note: 't' }],
    };
    const checked = new Set(courseTexts(course).map(({ path }) => path.split('.').pop()));
    assert.deepEqual([...schemaFields].sort(), [...checked].sort());
  });

  test('url shortener in course audience gives link-tracker', (t) => {
    const fixture = fixtureRoot(t);
    fixture.mutateCourse((course) => {
      course.audience += ' [info](https://bit.ly/abc123)';
    });
    assertIssue(fixture.check(), 'link-tracker', 'audience', fixture.courseFile);
  });

  test('a https link in course.json text is fine', (t) => {
    const fixture = fixtureRoot(t);
    fixture.mutateCourse((course) => {
      course.goal += ' [VISpas](https://www.sportvisunie.nl/)';
    });
    assertClean(fixture.check());
  });

  test('a [[term]] in course.json gives course-term-not-allowed', (t) => {
    const fixture = fixtureRoot(t);
    fixture.mutateCourse((course) => {
      course.lessons[0].title = 'Wanneer [[aanslaan]]?';
    });
    const result = fixture.check();
    const error = assertIssue(
      result,
      'course-term-not-allowed',
      'lessons[0].title',
      fixture.courseFile,
    );
    assert.match(error.message, /glossary/);
    assert.equal(result.errors.length, 1);
  });

  test('html and links in stepped-exercise answers are checked', (t) => {
    const fixture = fixtureRoot(t);
    const exercise = (id, answer, commonMistakes = []) => ({
      id,
      prompt: 'Hoeveel is 1/2 + 1/4?',
      answer,
      hints: [],
      steps: [],
      commonMistakes,
      workedSolution: '1/2 = 2/4, en 2/4 + 1/4 = 3/4.',
    });
    fixture.mutateLesson((lesson) => {
      lesson.steps[1].interaction = {
        id: 'breuken',
        kind: 'stepped-exercise',
        config: {
          exercises: [
            exercise(
              'som-1',
              { type: 'number', value: 0.75, tolerance: 0.001, unit: '[taart](http://x.nl/)' },
              [{ answer: '<i>2/6</i>', feedback: 'Tellers en noemers tel je niet los op.' }],
            ),
            exercise('som-2', { type: 'text', accepted: ['3/4', '<b>drie kwart</b>'] }),
          ],
        },
      };
    });
    const result = fixture.check();
    const base = 'steps[1].interaction.config.exercises';
    assertIssue(result, 'link-not-https', `${base}[0].answer.unit`);
    assertIssue(result, 'markup-html', `${base}[0].commonMistakes[0].answer`);
    assertIssue(result, 'markup-html', `${base}[1].answer.accepted[1]`);
    assert.equal(result.errors.length, 3, codes(result).join('\n'));
  });

  test('utm parameter gives link-tracker', (t) => {
    const fixture = fixtureRoot(t);
    fixture.mutateCourse((course) => {
      course.sources[0].url += '?utm_source=nieuwsbrief';
    });
    const error = assertIssue(fixture.check(), 'link-tracker', 'sources[0].url');
    assert.match(error.message, /utm_source/);
  });

  test('url shortener gives link-tracker', (t) => {
    const fixture = fixtureRoot(t);
    fixture.mutateLesson((lesson) => {
      lesson.steps[0].blocks[4].text += ' Zie [deze video](https://bit.ly/abc123).';
    });
    assertIssue(fixture.check(), 'link-tracker', textPath);
  });

  test('trackerReason knows hosts, subdomains, paths and parameters', () => {
    const reason = (url) => trackerReason(new URL(url));
    assert.match(reason('https://www.google-analytics.com/collect'), /google-analytics\.com/);
    assert.match(reason('https://stats.g.doubleclick.net/x'), /doubleclick\.net/);
    assert.match(reason('https://t.co/abc'), /t\.co/);
    assert.match(reason('https://www.googletagmanager.com/gtm.js'), /googletagmanager\.com/);
    assert.match(reason('https://bit.ly/abc'), /bit\.ly/);
    assert.match(reason('https://tinyurl.com/abc'), /tinyurl\.com/);
    assert.match(reason('https://www.facebook.com/tr?id=1'), /facebook\.com\/tr/);
    assert.match(reason('https://example.org/?fbclid=1'), /fbclid/);
    assert.match(reason('https://example.org/?gclid=1'), /gclid/);
    assert.match(reason('https://example.org/?mc_eid=1'), /mc_eid/);
    assert.equal(reason('https://www.facebook.com/sportvisserij'), null);
    assert.equal(reason('https://www.microsoft.com/'), null);
    assert.equal(reason('https://example.org/?page=2'), null);
  });

  test('html in text gives markup-html', (t) => {
    const fixture = fixtureRoot(t);
    fixture.mutateLesson((lesson) => {
      lesson.steps[0].blocks[4].text = 'Zit je echt vast? Blijf dan <b>niet</b> rukken.';
    });
    const error = assertIssue(fixture.check(), 'markup-html', textPath);
    assert.match(error.message, /\*\*vet\*\*/);
  });

  test('html in course.json gives markup-html; a lone < is fine', (t) => {
    const fixture = fixtureRoot(t);
    fixture.mutateCourse((course) => {
      course.goal = 'Vissen <script>alert(1)</script>';
    });
    fixture.mutateLesson((lesson) => {
      lesson.faq[0].a = 'Een snoek < 45 cm zet je altijd terug, en 3 > 2.';
    });
    const result = fixture.check();
    assertIssue(result, 'markup-html', 'goal', fixture.courseFile);
    assert.equal(result.errors.length, 1);
  });
});

describe('figures', () => {
  test('missing figure file gives asset-missing', (t) => {
    const fixture = fixtureRoot(t);
    fixture.remove('assets/hengeltop.svg');
    assertIssue(fixture.check(), 'asset-missing', `${figurePath}.src`, fixture.lessonFile);
  });

  test('figure path with .. gives asset-path-invalid', (t) => {
    const fixture = fixtureRoot(t);
    fixture.mutateLesson((lesson) => {
      lesson.steps[0].blocks[6].src = 'assets/../course.svg';
    });
    assertIssue(fixture.check(), 'asset-path-invalid', `${figurePath}.src`);
    fixture.mutateLesson((lesson) => {
      lesson.steps[0].blocks[6].src = '../andere-cursus/assets/hengeltop.svg';
    });
    assertIssue(fixture.check(), 'asset-path-invalid', `${figurePath}.src`);
  });

  test('png figure gives asset-path-invalid', (t) => {
    const fixture = fixtureRoot(t);
    fixture.writeFile('assets/hengeltop.png', 'png');
    fixture.mutateLesson((lesson) => {
      lesson.steps[0].blocks[6].src = 'assets/hengeltop.png';
    });
    assertIssue(fixture.check(), 'asset-path-invalid', `${figurePath}.src`);
  });

  test('figure path with capitals, spaces or dots gives asset-path-invalid from the schema', (t) => {
    const fixture = fixtureRoot(t);
    for (const src of ['assets/Hengeltop.svg', 'assets/hengel top.svg', 'assets/hengel.top.svg']) {
      fixture.writeFile(src, '<svg xmlns="http://www.w3.org/2000/svg"/>\n');
      fixture.mutateLesson((lesson) => {
        lesson.steps[0].blocks[6].src = src;
      });
      const result = fixture.check();
      const error = assertIssue(result, 'asset-path-invalid', `${figurePath}.src`);
      assert.match(error.message, /kleine letters/, src);
      assert.equal(result.errors.length, 1, src);
    }
  });

  test('a symlinked figure gives asset-path-invalid', (t) => {
    const fixture = fixtureRoot(t);
    const outside = join(fixture.root, 'elders.svg');
    writeFileSync(outside, '<svg xmlns="http://www.w3.org/2000/svg"/>\n');
    fixture.remove('assets/hengeltop.svg');
    symlinkSync(outside, fixture.path('assets/hengeltop.svg'));
    const error = assertIssue(fixture.check(), 'asset-path-invalid', `${figurePath}.src`);
    assert.match(error.message, /symlink/);
  });

  test('a symlinked assets directory gives asset-path-invalid', (t) => {
    const fixture = fixtureRoot(t);
    const outside = join(fixture.root, 'elders');
    mkdirSync(outside);
    renameSync(fixture.path('assets/hengeltop.svg'), join(outside, 'hengeltop.svg'));
    renameSync(fixture.path('assets'), join(fixture.root, 'assets-oud'));
    symlinkSync(outside, fixture.path('assets'));
    assertIssue(fixture.check(), 'asset-path-invalid', `${figurePath}.src`);
  });

  test('a dangling symlink gives asset-path-invalid, not asset-missing', (t) => {
    const fixture = fixtureRoot(t);
    fixture.remove('assets/hengeltop.svg');
    symlinkSync(join(tmpdir(), 'bestaat-niet-snuffel.svg'), fixture.path('assets/hengeltop.svg'));
    const result = fixture.check();
    assertIssue(result, 'asset-path-invalid', `${figurePath}.src`);
    assert.equal(result.errors.length, 1);
  });

  test('svg with an external reference gives asset-external-ref', (t) => {
    const fixture = fixtureRoot(t);
    fixture.writeFile(
      'assets/hengeltop.svg',
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><image href="https://example.org/vis.png"/></svg>\n',
    );
    const error = assertIssue(fixture.check(), 'asset-external-ref', `${figurePath}.src`);
    assert.match(error.message, /https:\/\/example\.org\/vis\.png/);
    assert.doesNotMatch(error.message, /w3\.org/);
  });

  test('blank alt gives figure-alt-missing', (t) => {
    const fixture = fixtureRoot(t);
    fixture.mutateLesson((lesson) => {
      lesson.steps[0].blocks[6].alt = '  ';
    });
    assertIssue(fixture.check(), 'figure-alt-missing', `${figurePath}.alt`);
  });

  test('isValidAssetPath and externalReferences', () => {
    assert.equal(isValidAssetPath('assets/hengeltop.svg'), true);
    assert.equal(isValidAssetPath('assets/vissen/snoek.svg'), true);
    for (const invalid of [
      'hengeltop.svg',
      '/assets/a.svg',
      'assets//a.svg',
      'assets/./a.svg',
      'assets\\a.svg',
      'assets/a.SVG',
    ]) {
      assert.equal(isValidAssetPath(invalid), false, invalid);
    }
    assert.deepEqual(externalReferences('<svg xmlns="http://www.w3.org/2000/svg"/>'), []);
    assert.deepEqual(externalReferences('<use href="//cdn.example.org/a.svg#x"/>'), ['//…']);
  });
});
