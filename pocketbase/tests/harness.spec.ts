import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { after, before, describe, test } from 'node:test';
import { startPocketBase, testSuperuser } from '../../tools/pocketbase-harness.mjs';
import { api, asSuperuser } from './helpers.ts';

describe('PocketBase harness', () => {
  let pb: Awaited<ReturnType<typeof startPocketBase>>;
  let stopped = false;

  before(async () => {
    pb = await startPocketBase();
  });

  after(async () => {
    if (!stopped) await pb.stop();
  });

  test('starts PocketBase with an empty data directory below pocketbase/pb_data', () => {
    assert.match(pb.dataDir, /pocketbase[\\/]pb_data[\\/]test-/);
    assert.ok(existsSync(pb.dataDir));
  });

  test('/api/health answers 200', async () => {
    const response = await api(pb.url, '/api/health');
    assert.equal(response.status, 200);
  });

  test('the superuser can log in', async () => {
    const token = await asSuperuser(pb.url, testSuperuser);
    assert.ok(token.length > 0);
  });

  test('the migrations from the repo are applied', async () => {
    const token = await asSuperuser(pb.url, testSuperuser);
    const response = await api<{ fields: { name: string }[] }>(pb.url, '/api/collections/users', {
      token,
    });
    assert.equal(response.status, 200);
    // `username` and `role` only exist through pb_migrations/*_setup_users.js.
    const names = response.body.fields.map((field) => field.name);
    assert.ok(names.includes('username') && names.includes('role'), names.join(', '));
  });

  test('the hooks from the repo are loaded', async () => {
    // security.pb.js sets the CSP on everything outside /api and /_.
    const response = await fetch(`${pb.url}/`);
    assert.ok(response.headers.get('content-security-policy'));
  });

  test('stop() ends PocketBase and removes the data directory', async () => {
    await pb.stop();
    stopped = true;
    assert.equal(existsSync(pb.dataDir), false);
    await assert.rejects(fetch(`${pb.url}/api/health`));
  });
});
