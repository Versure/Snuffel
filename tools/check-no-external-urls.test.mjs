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
// The fixture projects only contain the roots a test needs.
const lenient = { allowMissingRoots: true };

describe('findExternalUrls', () => {
  test('reports a url in app code', () => {
    const dir = project({ 'web/src/app/app.ts': `const a = '${url}';\n` });
    assert.deepEqual(findExternalUrls(dir, lenient), [`web/src/app/app.ts:1  ${url}`]);
  });

  test('reports a url in web/src/app/core/content', () => {
    const dir = project({ 'web/src/app/core/content/content.service.ts': `\nfetch('${url}');\n` });
    assert.deepEqual(findExternalUrls(dir, lenient), [
      `web/src/app/core/content/content.service.ts:2  ${url}`,
    ]);
  });

  test('reports a url in a public directory called content that is not the build output', () => {
    const dir = project({ 'web/public/assets/content/x.svg': `<image href="${url}"/>` });
    assert.equal(findExternalUrls(dir, lenient).length, 1);
  });

  test('ignores web/public/content', () => {
    const dir = project({
      'web/public/content/proefcursus/lessons/proefles.abc.json': `{"url":"${url}"}`,
      'web/public/content/manifest.json': `{"url":"${url}"}`,
    });
    assert.deepEqual(findExternalUrls(dir, lenient), []);
  });

  test('ignores the content staging directories', () => {
    const dir = project({ 'web/public/.content-123/manifest.json': `{"url":"${url}"}` });
    assert.deepEqual(findExternalUrls(dir, lenient), []);
  });

  test('allows xml namespaces', () => {
    const dir = project({
      'web/public/assets/ted.svg': '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
    });
    assert.deepEqual(findExternalUrls(dir, lenient), []);
  });

  test('a missing root is an error by default', () => {
    const dir = project({ 'web/src/app/app.ts': 'const a = 1;\n' });
    assert.throws(() => findExternalUrls(dir), /directory web\/public not found/);
  });

  test('scans all roots when they exist', () => {
    const dir = project({
      'web/src/a.ts': '',
      'web/public/a.svg': '',
      'pocketbase/pb_hooks/a.pb.js': `fetch('${url}');\n`,
      'pocketbase/pb_migrations/1_a.js': '',
    });
    assert.deepEqual(findExternalUrls(dir), [`pocketbase/pb_hooks/a.pb.js:1  ${url}`]);
  });

  test('other errors than a missing directory are not swallowed', () => {
    // A file where a root directory should be: readdir fails with ENOTDIR.
    const dir = project({ 'web/src': '' });
    assert.throws(() => findExternalUrls(dir, lenient), { code: 'ENOTDIR' });
  });
});
