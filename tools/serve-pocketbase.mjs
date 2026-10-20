// Serves a directory (default: the production build) with the pinned PocketBase binary,
// using pb_hooks and pb_migrations from the repo. Used by the e2e tests and `npm run serve:prod`.
//
// Usage: node tools/serve-pocketbase.mjs [--port 8090] [--public dir] [--data dir]
// An explicit --data below pocketbase/pb_data/ is emptied first, so every run starts clean.
import { spawn } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { fetchPocketBase, rootDir } from './fetch-pocketbase.mjs';

const dataRoot = join(rootDir, 'pocketbase', 'pb_data');

const { values } = parseArgs({
  options: {
    port: { type: 'string', default: '8090' },
    public: { type: 'string', default: join(rootDir, 'web', 'dist', 'snuffel', 'browser') },
    data: { type: 'string' },
  },
});

const publicDir = resolve(values.public);
if (!existsSync(join(publicDir, 'index.html'))) {
  console.error(`serve-pocketbase: ${publicDir} has no index.html. Run \`npm run build\` first.`);
  process.exit(1);
}

let dataDir = join(dataRoot, 'local');
if (values.data) {
  dataDir = resolve(values.data);
  const inside = relative(dataRoot, dataDir);
  if (inside && !inside.startsWith('..') && !isAbsolute(inside)) {
    rmSync(dataDir, { recursive: true, force: true });
  }
}

let binary;
try {
  binary = await fetchPocketBase();
} catch (error) {
  console.error(`serve-pocketbase: ${error.message}`);
  process.exit(1);
}

const child = spawn(
  binary,
  [
    'serve',
    `--http=127.0.0.1:${values.port}`,
    `--dir=${dataDir}`,
    `--publicDir=${publicDir}`,
    `--hooksDir=${join(rootDir, 'pocketbase', 'pb_hooks')}`,
    `--migrationsDir=${join(rootDir, 'pocketbase', 'pb_migrations')}`,
    '--hooksWatch=false',
  ],
  { stdio: 'inherit' },
);

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}
child.on('exit', (code, signal) => process.exit(code ?? (signal ? 0 : 1)));
