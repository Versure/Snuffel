import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { promisify } from 'node:util';
import { startPocketBase } from './pocketbase-harness.mjs';
import { defaultSeedFile, loadSeed, seedAccounts } from './seed-pocketbase.mjs';

const execFileAsync = promisify(execFile);
const seedTool = join(import.meta.dirname, 'seed-pocketbase.mjs');

async function login(url, identity, password, collection = 'users') {
  const response = await fetch(`${url}/api/collections/${collection}/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity, password }),
  });
  return { status: response.status, body: await response.json() };
}

async function allUsers(url, superuser) {
  const { body } = await login(url, superuser.email, superuser.password, '_superusers');
  const response = await fetch(`${url}/api/collections/users/records?perPage=200`, {
    headers: { Authorization: body.token },
  });
  return (await response.json()).items;
}

describe('dev seed against PocketBase', () => {
  const seed = loadSeed();
  let pb;

  before(async () => {
    pb = await startPocketBase({ superuser: seed.superuser });
  });

  after(async () => {
    await pb?.stop();
  });

  test('the dev seed has kind-a, kind-b (children) and ouder (parent)', () => {
    assert.deepEqual(
      seed.accounts.map(({ username, role }) => [username, role]),
      [
        ['kind-a', 'child'],
        ['kind-b', 'child'],
        ['ouder', 'parent'],
      ],
    );
  });

  test('after seeding, every account can log in with the right role and name', async () => {
    const result = await seedAccounts(pb.url, seed.superuser, seed.accounts);
    assert.deepEqual(result.created, ['kind-a', 'kind-b', 'ouder']);
    for (const account of seed.accounts) {
      const response = await login(pb.url, account.username, account.password);
      assert.equal(response.status, 200, account.username);
      assert.equal(response.body.record.role, account.role);
      assert.equal(response.body.record.name, account.name);
    }
  });

  test('running it twice gives no duplicates and no error, and restores changes', async () => {
    const changed = seed.accounts.map((account) =>
      account.username === 'kind-a'
        ? { ...account, name: 'Iemand anders', role: 'parent' }
        : account,
    );
    await seedAccounts(pb.url, seed.superuser, changed);
    const result = await seedAccounts(pb.url, seed.superuser, seed.accounts);
    assert.deepEqual(result.created, []);
    assert.deepEqual(result.updated, ['kind-a', 'kind-b', 'ouder']);
    const users = await allUsers(pb.url, seed.superuser);
    assert.equal(users.length, 3);
    const kindA = users.find((user) => user.username === 'kind-a');
    assert.equal(kindA.name, 'Kind A');
    assert.equal(kindA.role, 'child');
  });

  test('the CLI seeds the default file and reports what it did', async () => {
    const { stdout } = await execFileAsync(process.execPath, [seedTool, '--url', pb.url]);
    assert.match(stdout, /test accounts ready/);
    assert.match(stdout, /updated: kind-a, kind-b, ouder/);
  });

  test('a wrong superuser password gives a clear error', async () => {
    await assert.rejects(
      seedAccounts(pb.url, { ...seed.superuser, password: 'fout-wachtwoord' }, seed.accounts),
      /seed: POST \/api\/collections\/_superusers\/auth-with-password failed: HTTP 400/,
    );
  });
});

describe('loadSeed', () => {
  let dir;

  before(() => {
    dir = mkdtempSync(join(tmpdir(), 'snuffel-seed-'));
  });

  after(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function file(name, content) {
    const path = join(dir, name);
    writeFileSync(path, content);
    return path;
  }

  test('reads the default file', () => {
    assert.equal(loadSeed(defaultSeedFile).accounts.length, 3);
  });

  test('a missing file gives a clear error', () => {
    assert.throws(() => loadSeed(join(dir, 'missing.json')), /seed: cannot read .*missing\.json/);
  });

  test('broken JSON gives a clear error with the file name', () => {
    const path = file('broken.json', '{ "accounts": [ ');
    assert.throws(() => loadSeed(path), /seed: .*broken\.json is not valid JSON/);
  });

  test('a wrong structure names the broken parts', () => {
    const path = file(
      'wrong.json',
      JSON.stringify({
        superuser: { email: 'dev@snuffel.test' },
        accounts: [{ username: 'kind-a', name: 'Kind A', role: 'admin', password: 'x' }, {}],
      }),
    );
    assert.throws(
      () => loadSeed(path),
      (error) => {
        assert.match(error.message, /wrong\.json is invalid/);
        assert.match(error.message, /"superuser" needs "email" and "password"/);
        assert.match(error.message, /accounts\[0\]\.role must be "child" or "parent"/);
        assert.match(error.message, /accounts\[1\]\.username is missing/);
        return true;
      },
    );
  });

  test('the CLI exits with the error for a broken file', async () => {
    const path = file('cli-broken.json', 'nope');
    await assert.rejects(
      execFileAsync(process.execPath, [seedTool, '--url', 'http://127.0.0.1:1', '--file', path]),
      (error) => {
        assert.equal(error.code, 1);
        assert.match(error.stderr, /cli-broken\.json is not valid JSON/);
        return true;
      },
    );
  });
});
