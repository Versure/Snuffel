import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { promisify } from 'node:util';
import { startPocketBase } from './pocketbase-harness.mjs';
import {
  assertLocalUrl,
  defaultSeedFile,
  loadSeed,
  seedAccounts,
  seedAssignments,
} from './seed-pocketbase.mjs';

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

async function superuserGet(url, superuser, path) {
  const { body } = await login(url, superuser.email, superuser.password, '_superusers');
  const response = await fetch(`${url}${path}`, { headers: { Authorization: body.token } });
  return response.json();
}

/** Every course assignment as `username/course_id`, sorted. */
async function allAssignments(url, superuser) {
  const users = await allUsers(url, superuser);
  const { items } = await superuserGet(
    url,
    superuser,
    '/api/collections/course_assignments/records?perPage=200',
  );
  return items
    .map((item) => `${users.find((user) => user.id === item.user)?.username}/${item.course_id}`)
    .sort();
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

  test('the dev seed assigns roofvissen to kind-a and not to kind-b', async () => {
    assert.deepEqual(seed.assignments, [{ username: 'kind-a', course_id: 'roofvissen' }]);
    await seedAccounts(pb.url, seed.superuser, seed.accounts);
    const result = await seedAssignments(pb.url, seed.superuser, seed.assignments);
    assert.deepEqual(result, { created: ['kind-a/roofvissen'], existing: [] });
    assert.deepEqual(await allAssignments(pb.url, seed.superuser), ['kind-a/roofvissen']);
  });

  test('seeding the assignments twice gives no duplicate', async () => {
    await seedAccounts(pb.url, seed.superuser, seed.accounts);
    await seedAssignments(pb.url, seed.superuser, seed.assignments);
    const again = await seedAssignments(pb.url, seed.superuser, seed.assignments);
    assert.deepEqual(again, { created: [], existing: ['kind-a/roofvissen'] });
    assert.deepEqual(await allAssignments(pb.url, seed.superuser), ['kind-a/roofvissen']);
  });

  test('an assignment to an unknown account or to the parent gives a clear error', async () => {
    await seedAccounts(pb.url, seed.superuser, seed.accounts);
    await assert.rejects(
      seedAssignments(pb.url, seed.superuser, [{ username: 'niemand', course_id: 'roofvissen' }]),
      /seed: assignment for "niemand": no such account/,
    );
    await assert.rejects(
      seedAssignments(pb.url, seed.superuser, [{ username: 'ouder', course_id: 'roofvissen' }]),
      /seed: assignment for "ouder": not a child/,
    );
  });

  test('the CLI seeds the default file and reports what it did', async () => {
    const { stdout } = await execFileAsync(process.execPath, [seedTool, '--url', pb.url]);
    assert.match(stdout, /test accounts ready/);
    assert.match(stdout, /updated: kind-a, kind-b, ouder/);
    assert.match(stdout, /course assignments ready/);
    assert.deepEqual(await allAssignments(pb.url, seed.superuser), ['kind-a/roofvissen']);
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

  test('an assignment to an unknown account, to the parent or with an invalid course id is refused', () => {
    const base = loadSeed(defaultSeedFile);
    const path = file(
      'assignments.json',
      JSON.stringify({
        ...base,
        assignments: [
          { username: 'niemand', course_id: 'roofvissen' },
          { username: 'ouder', course_id: 'roofvissen' },
          { username: 'kind-a', course_id: 'Roof_vissen' },
          { username: 'kind-b', course_id: 'a'.repeat(61) },
        ],
      }),
    );
    assert.throws(
      () => loadSeed(path),
      (error) => {
        assert.match(error.message, /assignments\.json is invalid/);
        assert.match(error.message, /assignments\[0\]\.username "niemand" is not in "accounts"/);
        assert.match(error.message, /assignments\[1\]\.username "ouder" is not a child/);
        assert.match(
          error.message,
          /assignments\[2\]\.course_id "Roof_vissen" is not a valid course id/,
        );
        assert.match(error.message, /assignments\[3\]\.course_id "a{61}" is not a valid course id/);
        return true;
      },
    );
  });

  test('assignments that are not a list are refused', () => {
    const path = file(
      'assignments-object.json',
      JSON.stringify({ ...loadSeed(defaultSeedFile), assignments: { 'kind-a': 'roofvissen' } }),
    );
    assert.throws(() => loadSeed(path), /"assignments" must be a list/);
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

describe('assertLocalUrl', () => {
  test('accepts 127.0.0.1, localhost and ::1', () => {
    for (const url of [
      'http://127.0.0.1:8090',
      'http://localhost:4200',
      'http://[::1]:8092',
      'https://localhost',
    ]) {
      assert.doesNotThrow(() => assertLocalUrl(url), url);
    }
  });

  test('refuses any other host with a clear error', () => {
    for (const url of [
      'http://192.168.1.10:8090',
      'http://nas.local:8090',
      'http://snuffel.example',
      'http://127.0.0.2:8090',
      'http://localhost.example.com',
      'http://user@evil.example/@127.0.0.1',
    ]) {
      assert.throws(
        () => assertLocalUrl(url),
        /seed: refusing to seed .*only 127\.0\.0\.1, localhost or ::1/,
        url,
      );
    }
  });

  test('refuses something that is not an http URL', () => {
    assert.throws(() => assertLocalUrl('not a url'), /seed: --url "not a url" is not a valid URL/);
    assert.throws(() => assertLocalUrl(''), /is not a valid URL/);
    assert.throws(() => assertLocalUrl('file://localhost/etc/passwd'), /refusing to seed/);
  });

  test('seedAccounts refuses a remote URL before sending anything', async () => {
    await assert.rejects(
      seedAccounts('http://192.168.1.10:8090', loadSeed().superuser, loadSeed().accounts),
      /refusing to seed/,
    );
  });

  test('the CLI exits with code 1 for a remote URL', async () => {
    await assert.rejects(
      execFileAsync(process.execPath, [seedTool, '--url', 'http://192.168.1.10:8090']),
      (error) => {
        assert.equal(error.code, 1);
        assert.match(error.stderr, /refusing to seed "http:\/\/192\.168\.1\.10:8090"/);
        return true;
      },
    );
  });
});
