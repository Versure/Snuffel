import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { test as setup } from '../fixtures';

// Creates the test accounts kind-a, kind-b and ouder (pocketbase/seed/dev-accounts.json).
// The dev superuser comes from `serve-pocketbase.mjs --dev-superuser` (or, for the container,
// from e2e/container/global-setup.ts). Never runs against the NAS.
setup('seed the test accounts', ({ baseURL }) => {
  const tool = resolve(__dirname, '..', '..', '..', 'tools', 'seed-pocketbase.mjs');
  const output = execFileSync(process.execPath, [tool, '--url', baseURL ?? ''], {
    encoding: 'utf8',
  });
  setup.info().annotations.push({ type: 'seed', description: output.trim() });
});
