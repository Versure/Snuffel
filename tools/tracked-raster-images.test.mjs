// No photo may be tracked anywhere in git, not only under content/: a workbook photo copied to some
// other folder would still end up in the history. Raster images are only allowed in the folders
// below; the list is as small as possible (nothing is tracked yet) and grows only on purpose.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { describe, test } from 'node:test';
import { rasterExtensions } from './content/raster-extensions.mjs';

const repoRoot = resolve(import.meta.dirname, '..');

/** Folders (with a trailing slash, relative to the repo root) where a tracked raster image is allowed. */
export const allowedRasterDirs = [];

/** Every raster image tracked by git in `root` outside `allowedDirs`, sorted. */
export function trackedRasterImagesOutside(root, allowedDirs = allowedRasterDirs) {
  const files = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' })
    .split('\0')
    .filter(Boolean);
  return files
    .filter((file) => rasterExtensions.some((ext) => file.toLowerCase().endsWith(ext)))
    .filter((file) => !allowedDirs.some((dir) => file.startsWith(dir)))
    .sort();
}

describe('tracked raster images', () => {
  test('no raster image (photo) is tracked outside the allowed folders', () => {
    assert.deepEqual(trackedRasterImagesOutside(repoRoot), []);
  });

  test('every allowed folder ends with a slash', () => {
    for (const dir of allowedRasterDirs) assert.ok(dir.endsWith('/'), dir);
  });

  test('a tracked photo outside the allowed folders is reported, in any case', (t) => {
    const root = mkdtempSync(join(tmpdir(), 'snuffel-tracked-raster-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    execFileSync('git', ['init', '--quiet'], { cwd: root });
    const files = [
      'web/public/assets/icon.png',
      'web/public-old/blz-12.JPG',
      'docs/IMG_0001.heic',
      'scan.Tiff',
      'docs/drawing.svg',
      'README.md',
    ];
    for (const file of files) {
      mkdirSync(join(root, dirname(file)), { recursive: true });
      writeFileSync(join(root, file), '');
    }
    writeFileSync(join(root, 'untracked.jpg'), '');
    execFileSync('git', ['add', '--', ...files], { cwd: root });

    assert.deepEqual(trackedRasterImagesOutside(root, ['web/public/']), [
      'docs/IMG_0001.heic',
      'scan.Tiff',
      'web/public-old/blz-12.JPG',
    ]);
    assert.deepEqual(trackedRasterImagesOutside(root, []), [
      'docs/IMG_0001.heic',
      'scan.Tiff',
      'web/public-old/blz-12.JPG',
      'web/public/assets/icon.png',
    ]);
  });
});
