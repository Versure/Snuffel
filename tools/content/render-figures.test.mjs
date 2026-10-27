// content:figures renders every svg of a course to png (with Chromium from Playwright; set
// PLAYWRIGHT_CHROMIUM_PATH where Playwright's own build is not installed).
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { repoRoot } from './check.mjs';
import {
  figurePage,
  launchChromium,
  findFigures,
  outputStem,
  parseRenderArgs,
  renderFigures,
} from './render-figures.mjs';
import { fixtureRoot } from './test-helpers.mjs';

/** Width and height of a png from its IHDR chunk. */
function pngSize(file) {
  const bytes = readFileSync(file);
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], `${file}: no png`);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function tempDir(t) {
  const dir = mkdtempSync(join(tmpdir(), 'snuffel-figures-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

describe('content:figures', () => {
  test('outputStem, args and an unknown target', () => {
    assert.equal(outputStem('assets/vissen/snoek.svg'), 'vissen-snoek');
    assert.deepEqual(parseRenderArgs(['blind-typen', '--out', '/tmp/x']).targets, ['blind-typen']);
    assert.throws(() => parseRenderArgs([]), /cursus-id/);
    assert.throws(() => findFigures('bestaat-niet'), /geen cursus-id/);
  });

  test('findFigures gives the svgs of a course with the alt and caption of each lesson', (t) => {
    const fixture = fixtureRoot(t);
    fixture.writeFile('assets/vissen/snoek.svg', '<svg xmlns="http://www.w3.org/2000/svg"/>');
    const { name, figures } = findFigures('proefcursus', { root: fixture.root });
    assert.equal(name, 'proefcursus');
    assert.deepEqual(
      figures.map(({ stem }) => stem),
      ['hengeltop', 'vissen-snoek'],
    );
    const lesson = fixture.readLesson();
    assert.deepEqual(figures[0].uses, [
      {
        lesson: lesson.id,
        alt: lesson.steps[0].blocks[6].alt,
        caption: lesson.steps[0].blocks[6].caption,
      },
    ]);
    assert.deepEqual(figures[1].uses, []);
  });

  test('findFigures takes a directory of svgs, such as the templates', () => {
    const { name, figures } = findFigures('content/illustrations/templates', { root: repoRoot });
    assert.equal(name, 'templates');
    assert.ok(figures.some(({ stem }) => stem === 'keyboard-qwerty'));
  });

  test('the page escapes the alt text and loads nothing from elsewhere', () => {
    const html = figurePage('<svg xmlns="http://www.w3.org/2000/svg"/>', {
      uses: [{ lesson: 'les', alt: '<b>vis</b> & "hengel"' }],
      theme: 'donker',
      pageWidth: 360,
    });
    assert.match(html, /&lt;b&gt;vis&lt;\/b&gt; &amp; &quot;hengel&quot;/);
    assert.doesNotMatch(html, /https?:\/\//);
    assert.match(html, /#1d1036/);
  });

  test('renders every svg of a course in both themes at phone and laptop width', async (t) => {
    const fixture = fixtureRoot(t);
    const outDir = tempDir(t);
    const [result] = await renderFigures(['proefcursus'], { root: fixture.root, outDir });
    const names = readdirSync(join(outDir, 'proefcursus')).sort();
    assert.deepEqual(names, [
      'hengeltop-laptop-donker.png',
      'hengeltop-laptop-licht.png',
      'hengeltop-telefoon-donker.png',
      'hengeltop-telefoon-licht.png',
    ]);
    assert.equal(result.files.length, 4);
    // The phone renders at device scale 2 (360 css px), the laptop at 1 (672 css px).
    assert.equal(pngSize(join(outDir, 'proefcursus', 'hengeltop-telefoon-licht.png')).width, 720);
    assert.equal(pngSize(join(outDir, 'proefcursus', 'hengeltop-laptop-donker.png')).width, 672);
  });

  test('a missing Chromium gives a message with what to do', async () => {
    await assert.rejects(
      launchChromium('/bestaat-niet/chrome', () =>
        Promise.reject(new Error("Executable doesn't exist")),
      ),
      /npx playwright install chromium.*PLAYWRIGHT_CHROMIUM_PATH/,
    );
  });

  test('an empty name for the output directory is refused', async (t) => {
    assert.throws(() => findFigures('/'), /ongeldige naam/);
    await assert.rejects(renderFigures(['/'], { outDir: tempDir(t) }), /ongeldige naam/);
  });

  test('an svg that does not load as an image is an error', async (t) => {
    const fixture = fixtureRoot(t);
    fixture.writeFile('assets/hengeltop.svg', 'geen tekening');
    await assert.rejects(
      renderFigures(['proefcursus'], { root: fixture.root, outDir: tempDir(t) }),
      /laadt niet als afbeelding/,
    );
  });
});
