// Serves a directory (default: the production build) with the pinned PocketBase binary,
// using pb_hooks and pb_migrations from the repo. Used by the e2e tests and `npm run serve:prod`.
//
// Usage: node tools/serve-pocketbase.mjs [--port 8090] [--public dir] [--data dir] [--keep-data]
//        [--dev-superuser] [--api-only]
// An explicit --data below pocketbase/pb_data/ is emptied first, so every run starts clean
// (unless --keep-data). --dev-superuser first creates the dev superuser from
// pocketbase/seed/dev-accounts.json with the CLI (local development and e2e only).
// --api-only serves no app (for `npm start`, where ng serve serves it and proxies /api).
import { spawn } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { fetchPocketBase, rootDir } from './fetch-pocketbase.mjs';
import { pocketBaseFlags } from './pocketbase-harness.mjs';
import { loadSeed, upsertSuperuser } from './seed-pocketbase.mjs';

const dataRoot = join(rootDir, 'pocketbase', 'pb_data');

const { values } = parseArgs({
  options: {
    port: { type: 'string', default: '8090' },
    public: { type: 'string', default: join(rootDir, 'web', 'dist', 'snuffel', 'browser') },
    data: { type: 'string' },
    'keep-data': { type: 'boolean', default: false },
    'dev-superuser': { type: 'boolean', default: false },
    'api-only': { type: 'boolean', default: false },
  },
});

const publicDir = resolve(values.public);
if (!values['api-only'] && !existsSync(join(publicDir, 'index.html'))) {
  console.error(`serve-pocketbase: ${publicDir} has no index.html. Run \`npm run build\` first.`);
  process.exit(1);
}

let dataDir = join(dataRoot, 'local');
if (values.data) {
  dataDir = resolve(values.data);
  const inside = relative(dataRoot, dataDir);
  if (inside && !inside.startsWith('..') && !isAbsolute(inside) && !values['keep-data']) {
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

if (values['dev-superuser']) {
  try {
    const { superuser } = loadSeed();
    await upsertSuperuser(binary, dataDir, superuser);
    console.log(`serve-pocketbase: dev superuser ${superuser.email} ready`);
  } catch (error) {
    console.error(`serve-pocketbase: ${error.message}`);
    process.exit(1);
  }
}

const child = spawn(
  binary,
  [
    'serve',
    `--http=127.0.0.1:${values.port}`,
    ...(values['api-only'] ? [] : [`--publicDir=${publicDir}`]),
    ...pocketBaseFlags(dataDir),
  ],
  { stdio: 'inherit' },
);

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}
child.on('exit', (code, signal) => process.exit(code ?? (signal ? 0 : 1)));
