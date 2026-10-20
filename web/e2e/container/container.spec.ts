import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '../fixtures';
import { composeArgs, docker, repoRoot } from './compose';

function containerId(): string {
  return docker(composeArgs('ps', '-q', 'snuffel'));
}

test.describe('container image', () => {
  test('is healthy', () => {
    const status = docker(['inspect', '--format', '{{.State.Health.Status}}', containerId()]);
    expect(status).toBe('healthy');
  });

  test('does not run as root', () => {
    const uid = docker(composeArgs('exec', '-T', 'snuffel', 'id', '-u'));
    expect(uid).toMatch(/^\d+$/);
    expect(uid).not.toBe('0');
  });

  test('is built for linux/amd64', () => {
    const image = docker(['inspect', '--format', '{{.Image}}', containerId()]);
    const platform = docker(['image', 'inspect', '--format', '{{.Os}}/{{.Architecture}}', image]);
    expect(platform).toBe('linux/amd64');
  });

  test('runs the pinned PocketBase version', () => {
    const pinned = JSON.parse(
      readFileSync(join(repoRoot, 'pocketbase', 'pocketbase.json'), 'utf8'),
    ) as { version: string };
    const output = docker(composeArgs('exec', '-T', 'snuffel', '/pb/pocketbase', '--version'));
    expect(output).toBe(`pocketbase version ${pinned.version}`);
  });
});
