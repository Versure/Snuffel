// Guards that the dev seed (test accounts with known passwords) and the content fixtures (the
// test lesson) never end up in the image.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { rootDir } from './fetch-pocketbase.mjs';

const dockerfile = readFileSync(join(rootDir, 'deploy', 'Dockerfile'), 'utf8');
const dockerignore = readFileSync(join(rootDir, '.dockerignore'), 'utf8')
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#'));

/** COPY instructions per stage: `{ stage, from, sources }` (`from` is set for --from=...). */
function copies(text) {
  const result = [];
  let stage = '';
  for (const line of text.replace(/\\\n/g, ' ').split('\n')) {
    const fromMatch = /^FROM\s+.*?\s+AS\s+(\S+)/i.exec(line.trim());
    if (fromMatch) stage = fromMatch[1];
    const copyMatch = /^COPY\s+(.*)$/i.exec(line.trim());
    if (!copyMatch) continue;
    const parts = copyMatch[1].split(/\s+/);
    const from = parts.find((part) => part.startsWith('--from='))?.slice('--from='.length);
    const args = parts.filter((part) => !part.startsWith('--'));
    result.push({ stage, from, sources: args.slice(0, -1) });
  }
  return result;
}

test('the Dockerfile copies nothing from pocketbase/seed', () => {
  for (const { sources } of copies(dockerfile)) {
    for (const source of sources) {
      assert.ok(!source.replace(/^\.\//, '').startsWith('pocketbase/seed'), source);
    }
  }
});

test('the runtime stage only takes migrations and hooks from the repo', () => {
  const fromContext = copies(dockerfile)
    .filter(({ stage, from }) => stage === 'runtime' && !from)
    .flatMap(({ sources }) => sources);
  assert.deepEqual(fromContext.sort(), ['pocketbase/pb_hooks', 'pocketbase/pb_migrations']);
});

test('.dockerignore keeps pocketbase/seed out of the build context', () => {
  assert.ok(
    dockerignore.some((line) => line.replace(/\/$/, '') === 'pocketbase/seed'),
    dockerignore.join(', '),
  );
});

test('the Dockerfile builds content before the app, without fixtures', () => {
  const runs = dockerfile
    .replace(/\\\n/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^RUN\s/i.test(line));
  const content = runs.findIndex((line) => /npm run content:build/.test(line));
  const app = runs.findIndex((line) => /npm run build\b/.test(line));
  assert.ok(content >= 0, 'content:build is missing');
  assert.ok(app > content, 'content:build must run before npm run build');
  assert.doesNotMatch(dockerfile, /--fixtures/);
  assert.doesNotMatch(dockerfile, /content\/fixtures/);
});

test('.dockerignore keeps generated content out of the build context', () => {
  assert.ok(
    dockerignore.some((line) => line.replace(/\/$/, '') === 'web/public/content'),
    dockerignore.join(', '),
  );
});
