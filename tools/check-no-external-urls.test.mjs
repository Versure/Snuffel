import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, describe, test } from 'node:test';
import { findExternalUrls } from './check-no-external-urls.mjs';

const base = mkdtempSync(join(tmpdir(), 'snuffel-privacy-'));
after(() => rmSync(base, { recursive: true, force: true }));

let counter = 0;
/** A fresh project directory with the given files (path → content). */
function project(files) {
  const dir = join(base, String(counter++));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), content);
  }
  return dir;
}

const url = 'https://example.org/font.woff2';

describe('findExternalUrls', () => {
  test('reports a url in app code', () => {
    const dir = project({ 'web/src/app/app.ts': `const a = '${url}';\n` });
    assert.deepEqual(findExternalUrls(dir), [`web/src/app/app.ts:1  ${url}`]);
  });

  test('reports a url in web/src/app/core/content', () => {
    const dir = project({ 'web/src/app/core/content/content.service.ts': `\nfetch('${url}');\n` });
    assert.deepEqual(findExternalUrls(dir), [
      `web/src/app/core/content/content.service.ts:2  ${url}`,
    ]);
  });

  test('reports a url in a public directory called content that is not the build output', () => {
    const dir = project({ 'web/public/assets/content/x.svg': `<image href="${url}"/>` });
    assert.equal(findExternalUrls(dir).length, 1);
  });

  test('ignores web/public/content', () => {
    const dir = project({
      'web/public/content/proefcursus/lessons/proefles.abc.json': `{"url":"${url}"}`,
      'web/public/content/manifest.json': `{"url":"${url}"}`,
    });
    assert.deepEqual(findExternalUrls(dir), []);
  });

  test('ignores the content staging directories', () => {
    const dir = project({ 'web/public/.content-123/manifest.json': `{"url":"${url}"}` });
    assert.deepEqual(findExternalUrls(dir), []);
  });

  test('allows xml namespaces', () => {
    const dir = project({
      'web/public/assets/ted.svg': '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
    });
    assert.deepEqual(findExternalUrls(dir), []);
  });
});
