import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';

export const repoRoot = resolve(__dirname, '..', '..', '..');

/**
 * `docker compose` arguments for the local image (deploy/compose.dev.yml).
 * SNUFFEL_COMPOSE_OVERRIDE may name one extra compose file, for example to pass proxy
 * settings to the build on a network that needs them; normally it is not set.
 */
export function composeArgs(...args: string[]): string[] {
  const files = ['-f', join(repoRoot, 'deploy', 'compose.dev.yml')];
  const override = process.env['SNUFFEL_COMPOSE_OVERRIDE'];
  if (override) files.push('-f', resolve(override));
  return ['compose', ...files, ...args];
}

/** Runs docker and returns its trimmed output. */
export function docker(args: string[]): string {
  return execFileSync('docker', args, { encoding: 'utf8', cwd: repoRoot }).trim();
}
