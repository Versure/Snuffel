import { execFileSync } from 'node:child_process';
import { composeArgs, repoRoot } from './compose';

/** Builds and starts the container from deploy/compose.dev.yml and waits until it is healthy. */
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
}
