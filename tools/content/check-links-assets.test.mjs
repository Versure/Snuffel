import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { externalReferences, isValidAssetPath } from './rules/assets.mjs';
import { trackerReason } from './trackers.mjs';
import { assertClean, assertIssue, fixtureRoot } from './test-helpers.mjs';

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
