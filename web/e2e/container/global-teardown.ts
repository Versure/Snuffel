import { execFileSync } from 'node:child_process';
import { composeArgs, repoRoot } from './compose';

/** Stops the container; the data volume stays (wipe it with `down -v`). */
export default function globalTeardown(): void {
  execFileSync('docker', composeArgs('down'), { stdio: 'inherit', cwd: repoRoot });
}
