// No photos or other raster images under content/: lessons only use simple svg drawings, and
// photos of workbook pages (snuffel-leren, homework) stay in huiswerk-fotos/, outside git.
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { describe, test } from 'node:test';
import { repoRoot } from './check.mjs';

export const rasterExtensions = [
  '.jpg',
  '.jpeg',
  '.png',
  '.heic',
  '.heif',
  '.webp',
  '.gif',
  '.bmp',
  '.tif',
  '.tiff',
];

/** Every raster image below `root`/content, as a path relative to `root` with forward slashes. */
export function rasterImagesInContent(root) {
  const found = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (rasterExtensions.some((ext) => entry.name.toLowerCase().endsWith(ext))) {
        found.push(relative(root, path).split(sep).join('/'));
      }
    }
  };
  walk(join(root, 'content'));
  return found.sort();
}

describe('raster images in content', () => {
  test('there are no raster images (photos) under content/', () => {
    assert.deepEqual(rasterImagesInContent(repoRoot), []);
  });

  test('a photo under content/ is found, in any case and at any depth', (t) => {
    const root = mkdtempSync(join(tmpdir(), 'snuffel-raster-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const assets = join(root, 'content', 'courses', 'wiskunde', 'assets');
    mkdirSync(assets, { recursive: true });
    mkdirSync(join(root, 'content', 'fixtures'), { recursive: true });
    writeFileSync(join(assets, 'schema.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
    writeFileSync(join(assets, 'course.json'), '{}');
    assert.deepEqual(rasterImagesInContent(root), []);

    writeFileSync(join(assets, 'blz-12.JPG'), '');
    writeFileSync(join(root, 'content', 'fixtures', 'IMG_0001.heic'), '');
    writeFileSync(join(root, 'content', 'scan.tiff'), '');
    assert.deepEqual(rasterImagesInContent(root), [
      'content/courses/wiskunde/assets/blz-12.JPG',
      'content/fixtures/IMG_0001.heic',
      'content/scan.tiff',
    ]);
  });

  test('every listed extension counts as a raster image', (t) => {
    const root = mkdtempSync(join(tmpdir(), 'snuffel-raster-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    mkdirSync(join(root, 'content'));
    for (const ext of rasterExtensions) writeFileSync(join(root, 'content', `foto${ext}`), '');
    assert.equal(rasterImagesInContent(root).length, rasterExtensions.length);
  });
});
