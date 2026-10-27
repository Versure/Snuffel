import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, renameSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { courseSvgs, externalReferences, isValidAssetPath } from './rules/assets.mjs';
import { courseTexts } from './rules/links.mjs';
import { trackerReason } from './trackers.mjs';
import { assertClean, assertIssue, codes, fixtureRoot } from './test-helpers.mjs';
import { repoRoot } from './check.mjs';

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
    // The html also makes the number mistake unreadable (M10).
    assertIssue(result, 'exercise-mistake-unreadable', `${base}[0].commonMistakes[0].answer`);
    assert.equal(result.errors.length, 4, codes(result).join('\n'));
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

// Fixture svgs with one kind of mistake each (content/fixtures/svg), and one that is fine.
const svgFixture = (name) =>
  readFileSync(join(repoRoot, 'content', 'fixtures', 'svg', name), 'utf8');

describe('svg style and safety', () => {
  /** The fixture course with `svg` as the figure of the lesson. */
  const withFigure = (t, svg) => {
    const fixture = fixtureRoot(t);
    fixture.writeFile('assets/hengeltop.svg', svg);
    return fixture;
  };

  test('a svg that follows the style guide is fine', (t) => {
    const fixture = withFigure(t, svgFixture('good.svg'));
    const result = fixture.check({ stability: false });
    assertClean(result);
    assert.deepEqual(result.warnings, []);
  });

  test('colours outside the palette, a gradient and transparency give asset-color-off-palette', (t) => {
    const fixture = withFigure(t, svgFixture('color-off-palette.svg'));
    const result = fixture.check();
    const error = assertIssue(result, 'asset-color-off-palette', `${figurePath}.src`);
    for (const finding of ['fill="#ff0000"', 'stroke="black"', 'stroke="rgb(20, 20, 20)"']) {
      assert.ok(error.message.includes(finding), `${finding} missing in: ${error.message}`);
    }
    assert.match(error.message, /linearGradient/);
    assert.match(error.message, /palette\.json/);
    assert.equal(result.errors.length, 1, codes(result).join('\n'));
  });

  test('opacity 0.5 is refused, 0, 1 and 100% are fine; short hex and currentColor are fine', (t) => {
    const svg = (extra) =>
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 100"><rect width="10" height="10" ${extra}/></svg>\n`;
    const fixture = withFigure(
      t,
      svg('opacity="0" fill-opacity="1" stroke-opacity="100%" fill="#FFF" stroke="currentColor"'),
    );
    assertClean(fixture.check());
    fixture.writeFile('assets/hengeltop.svg', svg('fill-opacity="0.5"'));
    const error = assertIssue(fixture.check(), 'asset-color-off-palette', `${figurePath}.src`);
    assert.match(error.message, /fill-opacity="0\.5"/);
  });

  test('a colour in a <style> element gives asset-color-off-palette', (t) => {
    const fixture = withFigure(
      t,
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 100"><style>.a { fill: hotpink }</style><rect class="a" width="10" height="10"/></svg>\n',
    );
    const error = assertIssue(fixture.check(), 'asset-color-off-palette', `${figurePath}.src`);
    assert.match(error.message, /hotpink/);
  });

  test('script, an embedded image, html, event handlers and javascript give asset-unsafe-content', (t) => {
    const fixture = withFigure(t, svgFixture('unsafe-content.svg'));
    const result = fixture.check();
    const error = assertIssue(result, 'asset-unsafe-content', `${figurePath}.src`);
    for (const finding of ['<script>', '<image>', '<foreignObject>', 'onload=', 'javascript:']) {
      assert.ok(error.message.includes(finding), `${finding} missing in: ${error.message}`);
    }
    assert.equal(
      result.errors.filter((issue) => issue.code !== 'asset-unsafe-content').length,
      0,
      codes(result).join('\n'),
    );
  });

  test('a DOCTYPE with entities and a link to another file give asset-unsafe-content', (t) => {
    const fixture = withFigure(
      t,
      '<?xml version="1.0"?>\n<!DOCTYPE svg [<!ENTITY a "aaaa">]>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 100"><use href="andere.svg#vis"/><use href="#eigen"/></svg>\n',
    );
    const error = assertIssue(fixture.check(), 'asset-unsafe-content', `${figurePath}.src`);
    assert.match(error.message, /<!DOCTYPE>/);
    assert.match(error.message, /andere\.svg#vis/);
    assert.doesNotMatch(error.message, /"#eigen"/);
  });

  test('a fixed size without viewBox gives asset-viewbox-missing', (t) => {
    const fixture = withFigure(t, svgFixture('viewbox-missing.svg'));
    const result = fixture.check();
    const error = assertIssue(result, 'asset-viewbox-missing', `${figurePath}.src`);
    assert.match(error.message, /geen viewBox/);
    assert.equal(result.errors.length, 1, codes(result).join('\n'));
  });

  test('a broken viewBox or no svg element gives asset-viewbox-missing', (t) => {
    const fixture = withFigure(t, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400"/>\n');
    assertIssue(fixture.check(), 'asset-viewbox-missing', `${figurePath}.src`);
    fixture.writeFile(
      'assets/hengeltop.svg',
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 0 100"/>\n',
    );
    assertIssue(fixture.check(), 'asset-viewbox-missing', `${figurePath}.src`);
    fixture.writeFile('assets/hengeltop.svg', 'geen tekening\n');
    const error = assertIssue(fixture.check(), 'asset-viewbox-missing', `${figurePath}.src`);
    assert.match(error.message, /geen <svg>/);
  });

  test('long text, another font and text without a font give asset-text-invalid', (t) => {
    const fixture = withFigure(t, svgFixture('text-invalid.svg'));
    const result = fixture.check();
    const error = assertIssue(result, 'asset-text-invalid', `${figurePath}.src`);
    assert.match(error.message, /is 34 tekens \(hoogstens 24\)/);
    assert.match(error.message, /Comic Sans MS/);
    assert.match(error.message, /"j" zonder font-family/);
    assert.equal(result.errors.length, 1, codes(result).join('\n'));
  });

  test('a font on a group, quoted, and 24 characters in tspans are fine; bold 900 is not', (t) => {
    const label = 'abcdefghij klmnopqrstuvw'; // 24 characters
    const fixture = withFigure(
      t,
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 100"><g font-family="'Atkinson Hyperlegible', Verdana, sans-serif" font-weight="bold"><text><tspan>${label.slice(0, 10)}</tspan><tspan>${label.slice(10)}</tspan></text></g></svg>\n`,
    );
    assertClean(fixture.check());
    fixture.writeFile(
      'assets/hengeltop.svg',
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 100"><text font-family="Atkinson Hyperlegible, Verdana, sans-serif" style="font-weight: 900">f</text></svg>\n',
    );
    const error = assertIssue(fixture.check(), 'asset-text-invalid', `${figurePath}.src`);
    assert.match(error.message, /font-weight="900"/);
  });

  test('a svg over 40 kB gives asset-too-large', (t) => {
    const good = svgFixture('good.svg');
    const padding = `<!-- ${'x'.repeat(41 * 1024)} -->`;
    const fixture = withFigure(t, good.replace('</svg>', `${padding}\n</svg>`));
    const result = fixture.check();
    const error = assertIssue(result, 'asset-too-large', `${figurePath}.src`);
    assert.match(error.message, /hoogstens 40 kB/);
    assert.equal(result.errors.length, 1, codes(result).join('\n'));
  });

  test('a svg of exactly 40 kB is fine', (t) => {
    const good = svgFixture('good.svg');
    const filler = 40 * 1024 - Buffer.byteLength(good) - '<!--  -->\n'.length;
    const fixture = withFigure(t, `${good}<!-- ${'x'.repeat(filler)} -->\n`);
    assert.equal(Buffer.byteLength(readFileSync(fixture.path('assets/hengeltop.svg'))), 40 * 1024);
    assertClean(fixture.check());
  });

  test('a svg in assets/ that no lesson uses gives the warning asset-unused, not an error', (t) => {
    const fixture = fixtureRoot(t);
    fixture.writeFile('assets/vissen/snoek.svg', svgFixture('good.svg'));
    fixture.writeFile('assets/notities.txt', 'geen svg\n');
    const result = fixture.check({ stability: false });
    assertClean(result);
    assert.deepEqual(result.warnings, [
      `${fixture.relCourseDir}/assets/vissen/snoek.svg: geen les gebruikt deze afbeelding; zet hem in een figure of haal hem weg [asset-unused]`,
    ]);
  });

  test('courseSvgs lists the svgs below assets/', (t) => {
    const fixture = fixtureRoot(t);
    fixture.writeFile('assets/vissen/snoek.svg', '<svg/>');
    assert.deepEqual(courseSvgs(fixture.courseDir), [
      'assets/hengeltop.svg',
      'assets/vissen/snoek.svg',
    ]);
    assert.deepEqual(courseSvgs(join(fixture.root, 'bestaat-niet')), []);
  });
});
