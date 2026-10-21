import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { composeArgs, repoRoot } from './compose';

interface Seed {
  superuser: { email: string; password: string };
}

/**
 * Builds and starts the container from deploy/compose.dev.yml, waits until it is healthy,
 * then creates the dev superuser and the test accounts in its (local, dev-only) volume.
 * The seed itself is not in the image; it runs from the repo against port 8090.
 */
export default function globalSetup(): void {
  try {
    execFileSync('docker', ['info'], { stdio: 'ignore' });
  } catch {
    throw new Error(
      'Docker is not available. Start Docker (Desktop) and run `npm run e2e:container` again.',
    );
  }
  try {
    execFileSync('docker', composeArgs('up', '--build', '--wait', '--wait-timeout', '120', '-d'), {
      stdio: 'inherit',
      cwd: repoRoot,
    });
  } catch {
    throw new Error(
      '`docker compose -f deploy/compose.dev.yml up --build --wait` failed; see the output above.',
    );
  }

  const seedFile = join(repoRoot, 'pocketbase', 'seed', 'dev-accounts.json');
  const { superuser } = JSON.parse(readFileSync(seedFile, 'utf8')) as Seed;
  try {
    execFileSync(
      'docker',
      composeArgs(
        'exec',
        '-T',
        'snuffel',
        '/pb/pocketbase',
        'superuser',
        'upsert',
        superuser.email,
        superuser.password,
        '--dir',
        '/pb/pb_data',
      ),
      { stdio: 'inherit', cwd: repoRoot },
    );
    execFileSync(
      process.execPath,
      [join(repoRoot, 'tools', 'seed-pocketbase.mjs'), '--url', 'http://127.0.0.1:8090'],
      { stdio: 'inherit', cwd: repoRoot },
    );
  } catch {
    throw new Error('Seeding the test accounts in the container failed; see the output above.');
  }
}
