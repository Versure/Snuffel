// Photos of workbook pages for `snuffel-leren` live in huiswerk-fotos/ and never in git: they may
// show a child's name, school or handwriting, and the pages are copyrighted.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

const repoRoot = resolve(import.meta.dirname, '..');
export const photoDir = 'huiswerk-fotos';

/** Whether git ignores `path` (relative to the repo root), also when the file does not exist. */
export function isIgnoredByGit(path) {
  const result = spawnSync('git', ['check-ignore', '--quiet', '--no-index', path], {
    cwd: repoRoot,
  });
  if (result.status !== 0 && result.status !== 1) {
    throw new Error(`git check-ignore failed: ${result.stderr?.toString()}`);
  }
  return result.status === 0;
}

test('.gitignore ignores huiswerk-fotos/ and everything in it', () => {
  for (const path of [
    `${photoDir}/blz-12.jpg`,
    `${photoDir}/wiskunde/hoofdstuk-3/IMG_0001.HEIC`,
    `${photoDir}/notities.txt`,
  ]) {
    assert.ok(isIgnoredByGit(path), `${path} is not ignored`);
  }
});

test('git check-ignore tells an ignored path from a tracked one', () => {
  assert.equal(isIgnoredByGit('content/terms.json'), false);
  assert.equal(isIgnoredByGit('README.md'), false);
});

test('no file under huiswerk-fotos/ is tracked', () => {
  const tracked = execFileSync('git', ['ls-files', '--', photoDir], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  assert.equal(tracked.trim(), '');
});

test('.dockerignore keeps huiswerk-fotos out of the build context', () => {
  const lines = readFileSync(join(repoRoot, '.dockerignore'), 'utf8')
    .split('\n')
    .map((line) => line.trim().replace(/\/$/, ''));
  assert.ok(lines.includes(photoDir));
});
