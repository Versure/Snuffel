// Access rules and schema of the `users` collection (migration *_setup_users.js),
// proven with child A, child B and a parent against a real PocketBase.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { startPocketBase, testSuperuser } from '../../tools/pocketbase-harness.mjs';
import {
  api,
  asSuperuser,
  authAs,
  authWithPassword,
  type ApiResponse,
  type RecordList,
} from './helpers.ts';

interface UserRecord {
  id: string;
  username: string;
  name: string;
  role: 'child' | 'parent';
  email: string;
  verified: boolean;
  [key: string]: unknown;
}

interface Account {
  record: UserRecord;
  token: string;
}

interface Trio {
  a: Account;
  b: Account;
  parent: Account;
}

const password = 'snuffel-test';
const records = '/api/collections/users/records';

let pb: Awaited<ReturnType<typeof startPocketBase>>;
let su: string;
let counter = 0;

before(async () => {
  pb = await startPocketBase();
  su = await asSuperuser(pb.url, testSuperuser);
});

after(async () => {
  await pb?.stop();
});

function assertRefused(response: ApiResponse<unknown>, what: string): void {
  assert.ok(
    response.status >= 400 && response.status < 500,
    `${what} should be refused, got ${response.status} ${JSON.stringify(response.body)}`,
  );
}

async function createUser(fields: Record<string, unknown>): Promise<UserRecord> {
  const response = await api<UserRecord>(pb.url, records, {
    method: 'POST',
    token: su,
    body: { password, passwordConfirm: password, ...fields },
  });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  return response.body;
}

/** Creates child A, child B and a parent with unique usernames, and logs them in. */
async function createTrio(): Promise<Trio> {
  counter += 1;
  const make = async (username: string, name: string, role: string): Promise<Account> => {
    const record = await createUser({ username, name, role });
    return { record, token: await authAs(pb.url, username, password) };
  };
  return {
    a: await make(`kind-a-${counter}`, 'Kind A', 'child'),
    b: await make(`kind-b-${counter}`, 'Kind B', 'child'),
    parent: await make(`ouder-${counter}`, 'Ouder', 'parent'),
  };
}

/** Reads a record as the superuser, bypassing all rules. */
async function actual(id: string): Promise<ApiResponse<UserRecord>> {
  return api<UserRecord>(pb.url, `${records}/${id}`, { token: su });
}

function update(id: string, token: string | undefined, body: Record<string, unknown>) {
  return api<UserRecord>(pb.url, `${records}/${id}`, { method: 'PATCH', token, body });
}

function remove(id: string, token: string | undefined) {
  return api(pb.url, `${records}/${id}`, { method: 'DELETE', token });
}

function list(token: string | undefined, query = '') {
  return api<RecordList<UserRecord>>(pb.url, `${records}?perPage=200${query}`, { token });
}

function newAccount(role: string) {
  counter += 1;
  return {
    username: `nieuw-${counter}`,
    name: 'Nieuw',
    role,
    password,
    passwordConfirm: password,
  };
}

describe('without login', () => {
  let trio: Trio;
  before(async () => {
    trio = await createTrio();
  });

  test('list gives no items', async () => {
    const response = await list(undefined);
    assert.equal(response.status, 200);
    assert.equal(response.body.totalItems, 0);
    assert.deepEqual(response.body.items, []);
  });

  test('view, update and delete of A do not work', async () => {
    assert.equal((await api(pb.url, `${records}/${trio.a.record.id}`)).status, 404);
    assertRefused(await update(trio.a.record.id, undefined, { name: 'Hack' }), 'update');
    assertRefused(await remove(trio.a.record.id, undefined), 'delete');
    const after = await actual(trio.a.record.id);
    assert.equal(after.status, 200);
    assert.equal(after.body.name, 'Kind A');
  });

  test('signing up is not possible, neither as child nor as parent', async () => {
    for (const role of ['child', 'parent']) {
      const body = newAccount(role);
      assertRefused(await api(pb.url, records, { method: 'POST', body }), `sign-up as ${role}`);
      const found = await list(su, `&filter=${encodeURIComponent(`username="${body.username}"`)}`);
      assert.equal(found.body.totalItems, 0);
    }
  });
});

describe('child A, reading', () => {
  let trio: Trio;
  before(async () => {
    trio = await createTrio();
  });

  test('A can view itself, with role and username', async () => {
    const response = await api<UserRecord>(pb.url, `${records}/${trio.a.record.id}`, {
      token: trio.a.token,
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.role, 'child');
    assert.equal(response.body.username, trio.a.record.username);
  });

  test('list gives only A', async () => {
    const response = await list(trio.a.token);
    assert.equal(response.status, 200);
    assert.deepEqual(
      response.body.items.map((item) => item.id),
      [trio.a.record.id],
    );
  });

  test('view of B gives 404', async () => {
    const response = await api(pb.url, `${records}/${trio.b.record.id}`, { token: trio.a.token });
    assert.equal(response.status, 404);
  });

  test('filtering on the username of B gives no items', async () => {
    const filter = encodeURIComponent(`username="${trio.b.record.username}"`);
    const response = await list(trio.a.token, `&filter=${filter}`);
    assert.equal(response.status, 200);
    assert.equal(response.body.totalItems, 0);
  });
});

describe('child A, changing others', () => {
  let trio: Trio;
  before(async () => {
    trio = await createTrio();
  });

  test('update of the name of B does not work', async () => {
    assertRefused(await update(trio.b.record.id, trio.a.token, { name: 'Gehackt' }), 'update B');
  });

  test('delete of B does not work', async () => {
    assertRefused(await remove(trio.b.record.id, trio.a.token), 'delete B');
  });

  test('B is unchanged afterwards', async () => {
    const response = await actual(trio.b.record.id);
    assert.equal(response.status, 200);
    assert.equal(response.body.name, 'Kind B');
    assert.equal(response.body.role, 'child');
    assert.equal(response.body.updated, trio.b.record['updated']);
  });
});

describe('child A, own role', () => {
  let trio: Trio;
  before(async () => {
    trio = await createTrio();
  });

  test('setting role to "parent" does not work', async () => {
    assertRefused(await update(trio.a.record.id, trio.a.token, { role: 'parent' }), 'role');
  });

  test('setting role to "child" does not work either', async () => {
    assertRefused(await update(trio.a.record.id, trio.a.token, { role: 'child' }), 'role');
  });

  test('role together with an allowed field does not work', async () => {
    const response = await update(trio.a.record.id, trio.a.token, {
      name: 'Baas',
      role: 'parent',
    });
    assertRefused(response, 'role with name');
    assert.equal((await actual(trio.a.record.id)).body.name, 'Kind A');
  });

  test('role via field modifiers or multipart does not work', async () => {
    for (const key of ['role+', '+role', 'role-']) {
      assertRefused(await update(trio.a.record.id, trio.a.token, { [key]: 'parent' }), key);
    }
    const form = new FormData();
    form.append('role', 'parent');
    const multipart = await fetch(`${pb.url}${records}/${trio.a.record.id}`, {
      method: 'PATCH',
      headers: { Authorization: trio.a.token },
      body: form,
    });
    assert.ok(multipart.status >= 400, `multipart role gave ${multipart.status}`);
    const payload = new FormData();
    payload.append('@jsonPayload', JSON.stringify({ role: 'parent' }));
    const json = await fetch(`${pb.url}${records}/${trio.a.record.id}`, {
      method: 'PATCH',
      headers: { Authorization: trio.a.token },
      body: payload,
    });
    assert.ok(json.status >= 400, `@jsonPayload role gave ${json.status}`);
  });

  test('A is still a child, and still only sees itself', async () => {
    assert.equal((await actual(trio.a.record.id)).body.role, 'child');
    const response = await list(trio.a.token);
    assert.deepEqual(
      response.body.items.map((item) => item.id),
      [trio.a.record.id],
    );
  });
});

describe('child A, other fields', () => {
  let trio: Trio;
  before(async () => {
    trio = await createTrio();
  });

  test('changing username, email or verified does not work', async () => {
    const id = trio.a.record.id;
    assertRefused(await update(id, trio.a.token, { username: 'andere-naam' }), 'username');
    assertRefused(await update(id, trio.a.token, { email: 'kind@snuffel.test' }), 'email');
    assertRefused(await update(id, trio.a.token, { verified: true }), 'verified');
    const after = await actual(id);
    assert.equal(after.body.username, trio.a.record.username);
    assert.equal(after.body.email, '');
    assert.equal(after.body.verified, false);
  });

  test('changing the name works', async () => {
    const response = await update(trio.a.record.id, trio.a.token, { name: 'Anna' });
    assert.equal(response.status, 200);
    assert.equal((await actual(trio.a.record.id)).body.name, 'Anna');
  });

  test('changing the password without oldPassword does not work', async () => {
    const response = await update(trio.a.record.id, trio.a.token, {
      password: 'nieuw-wachtwoord',
      passwordConfirm: 'nieuw-wachtwoord',
    });
    assertRefused(response, 'password without oldPassword');
    assert.equal((await authWithPassword(pb.url, trio.a.record.username, password)).status, 200);
  });

  test('changing the password with oldPassword works', async () => {
    const response = await update(trio.a.record.id, trio.a.token, {
      oldPassword: password,
      password: 'nieuw-wachtwoord',
      passwordConfirm: 'nieuw-wachtwoord',
    });
    assert.equal(response.status, 200);
    const login = await authWithPassword(pb.url, trio.a.record.username, 'nieuw-wachtwoord');
    assert.equal(login.status, 200);
  });
});

// emailVisibility and the e-mail change flow are not covered by updateRule's field checks.
// This pins down the current behaviour: neither lets a child reach another account or change
// its own login (the identity is `username`, never `email`).
describe('child A, e-mail visibility and e-mail change', () => {
  let trio: Trio;
  before(async () => {
    trio = await createTrio();
    const response = await update(trio.b.record.id, su, { email: 'kind-b@snuffel.test' });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    // Changing the e-mail resets the token key, so B logs in again.
    trio.b.token = await authAs(pb.url, trio.b.record.username, password);
  });

  test('the parent does not see the e-mail of B while emailVisibility is off', async () => {
    const response = await api<UserRecord>(pb.url, `${records}/${trio.b.record.id}`, {
      token: trio.parent.token,
    });
    assert.equal(response.status, 200);
    assert.equal(response.body['emailVisibility'], false);
    assert.equal(response.body.email, undefined);
  });

  test('A can turn on emailVisibility of itself (the only effect: the parent sees it)', async () => {
    const response = await update(trio.a.record.id, trio.a.token, { emailVisibility: true });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    const after = await actual(trio.a.record.id);
    assert.equal(after.body['emailVisibility'], true);
    assert.equal(after.body.email, '');
    assert.equal(after.body.role, 'child');
  });

  test('A cannot change emailVisibility of B', async () => {
    assertRefused(
      await update(trio.b.record.id, trio.a.token, { emailVisibility: true }),
      'emailVisibility of B',
    );
    assert.equal((await actual(trio.b.record.id)).body['emailVisibility'], false);
  });

  test('B turning on emailVisibility only shows the e-mail to the parent, not to A', async () => {
    const response = await update(trio.b.record.id, trio.b.token, { emailVisibility: true });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    const asParent = await api<UserRecord>(pb.url, `${records}/${trio.b.record.id}`, {
      token: trio.parent.token,
    });
    assert.equal(asParent.body.email, 'kind-b@snuffel.test');
    const asA = await api(pb.url, `${records}/${trio.b.record.id}`, { token: trio.a.token });
    assert.equal(asA.status, 404);
  });

  test('request-email-change needs a login', async () => {
    const response = await api(pb.url, '/api/collections/users/request-email-change', {
      method: 'POST',
      body: { newEmail: 'iemand@snuffel.test' },
    });
    assert.equal(response.status, 401);
  });

  test('request-email-change by a child does not change the e-mail by itself', async () => {
    // PocketBase only changes the address after confirm-email-change with a token that it
    // mails to the new address. Snuffel configures no SMTP; PocketBase then hands the mail to
    // the local `sendmail`. Without one (CI, the container) the request fails with 400; with
    // one (macOS) it gives 204. Either way the address stays the same.
    const settings = await api<{ smtp: { enabled: boolean } }>(pb.url, '/api/settings', {
      token: su,
    });
    assert.equal(settings.body.smtp.enabled, false);
    for (const account of [trio.a, trio.b]) {
      const response = await api(pb.url, '/api/collections/users/request-email-change', {
        method: 'POST',
        token: account.token,
        body: { newEmail: `nieuw-${account.record.username}@snuffel.test` },
      });
      assert.ok([204, 400].includes(response.status), JSON.stringify(response));
    }
    assert.equal((await actual(trio.a.record.id)).body.email, '');
    assert.equal((await actual(trio.b.record.id)).body.email, 'kind-b@snuffel.test');
  });

  test('confirm-email-change without a mailed token is refused', async () => {
    const response = await api(pb.url, '/api/collections/users/confirm-email-change', {
      method: 'POST',
      body: { token: trio.a.token, password },
    });
    assertRefused(response, 'confirm-email-change with an auth token');
    assert.equal((await actual(trio.a.record.id)).body.email, '');
  });

  test('the e-mail address never works as login identity, also not after these attempts', async () => {
    const response = await authWithPassword(pb.url, 'kind-b@snuffel.test', password);
    assertRefused(response, 'login with e-mail');
    assert.equal(response.body.token, undefined);
  });
});

describe('child A, creating and deleting', () => {
  let trio: Trio;
  before(async () => {
    trio = await createTrio();
  });

  test('creating a new account does not work', async () => {
    for (const role of ['child', 'parent']) {
      const body = newAccount(role);
      const response = await api(pb.url, records, { method: 'POST', token: trio.a.token, body });
      assertRefused(response, `create ${role}`);
      const found = await list(su, `&filter=${encodeURIComponent(`username="${body.username}"`)}`);
      assert.equal(found.body.totalItems, 0);
    }
  });

  test('deleting itself does not work', async () => {
    assertRefused(await remove(trio.a.record.id, trio.a.token), 'delete self');
    assert.equal((await actual(trio.a.record.id)).status, 200);
  });
});

describe('parent', () => {
  let trio: Trio;
  before(async () => {
    trio = await createTrio();
  });

  test('list gives A, B and the parent', async () => {
    const response = await list(trio.parent.token);
    assert.equal(response.status, 200);
    const ids = response.body.items.map((item) => item.id);
    for (const account of [trio.a, trio.b, trio.parent]) {
      assert.ok(ids.includes(account.record.id), `${account.record.username} missing`);
    }
  });

  test('view of A and B works', async () => {
    for (const account of [trio.a, trio.b]) {
      const response = await api<UserRecord>(pb.url, `${records}/${account.record.id}`, {
        token: trio.parent.token,
      });
      assert.equal(response.status, 200);
      assert.equal(response.body.username, account.record.username);
    }
  });

  test('creating a child works', async () => {
    const body = newAccount('child');
    const response = await api<UserRecord>(pb.url, records, {
      method: 'POST',
      token: trio.parent.token,
      body,
    });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal((await actual(response.body.id)).body.role, 'child');
  });

  test('changing name and role of a child works', async () => {
    const response = await update(trio.b.record.id, trio.parent.token, {
      name: 'Bram',
      role: 'parent',
    });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    const after = await actual(trio.b.record.id);
    assert.equal(after.body.name, 'Bram');
    assert.equal(after.body.role, 'parent');
  });

  test('deleting a child works', async () => {
    const response = await remove(trio.a.record.id, trio.parent.token);
    assert.equal(response.status, 204);
    assert.equal((await actual(trio.a.record.id)).status, 404);
  });
});

describe('logging in', () => {
  let trio: Trio;
  before(async () => {
    trio = await createTrio();
    const response = await update(trio.a.record.id, su, { email: 'kind-a@snuffel.test' });
    assert.equal(response.status, 200, JSON.stringify(response.body));
  });

  test('works with the username as identity, and returns the role', async () => {
    const response = await authWithPassword(pb.url, trio.a.record.username, password);
    assert.equal(response.status, 200);
    assert.equal(response.body.record?.['role'], 'child');
  });

  test('works with the username in capitals (case-insensitive unique index)', async () => {
    const response = await authWithPassword(pb.url, trio.a.record.username.toUpperCase(), password);
    assert.equal(response.status, 200);
    assert.equal(response.body.record?.['id'], trio.a.record.id);
  });

  test('does not work with the e-mail address as identity', async () => {
    const response = await authWithPassword(pb.url, 'kind-a@snuffel.test', password);
    assertRefused(response, 'login with e-mail');
    assert.equal(response.body.token, undefined);
  });

  test('does not work with a wrong password', async () => {
    const response = await authWithPassword(pb.url, trio.a.record.username, 'fout-wachtwoord');
    assertRefused(response, 'wrong password');
    assert.equal(response.body.token, undefined);
  });

  test('auth-refresh with a valid token works', async () => {
    const response = await api(pb.url, '/api/collections/users/auth-refresh', {
      method: 'POST',
      token: trio.b.token,
    });
    assert.equal(response.status, 200);
  });

  test('auth-refresh with a tampered token gives 401', async () => {
    const [header, payload, signature] = trio.b.token.split('.');
    const flipped = (signature[0] === 'A' ? 'B' : 'A') + signature.slice(1);
    for (const token of [`${header}.${payload}.${flipped}`, `${header}.${payload}.`]) {
      const response = await api(pb.url, '/api/collections/users/auth-refresh', {
        method: 'POST',
        token,
      });
      assert.equal(response.status, 401);
    }
  });

  test('a token with a changed payload (other user) gives 401', async () => {
    const [header, , signature] = trio.a.token.split('.');
    const payload = JSON.parse(Buffer.from(trio.a.token.split('.')[1], 'base64url').toString());
    const forged = Buffer.from(JSON.stringify({ ...payload, id: trio.parent.record.id })).toString(
      'base64url',
    );
    const response = await api(pb.url, '/api/collections/users/auth-refresh', {
      method: 'POST',
      token: `${header}.${forged}.${signature}`,
    });
    assert.equal(response.status, 401);
  });
});

describe('schema', () => {
  let trio: Trio;
  before(async () => {
    trio = await createTrio();
  });

  test('a second account with the same username, also in capitals, is refused', async () => {
    for (const username of [trio.a.record.username, trio.a.record.username.toUpperCase()]) {
      const response = await api(pb.url, records, {
        method: 'POST',
        token: su,
        body: { username, name: 'Dubbel', role: 'child', password, passwordConfirm: password },
      });
      assertRefused(response, `duplicate ${username}`);
    }
    const found = await list(
      su,
      `&filter=${encodeURIComponent(`username~"${trio.a.record.username}"`)}`,
    );
    assert.equal(found.body.totalItems, 1);
  });

  test('the username has a case-insensitive unique index', async () => {
    const response = await api<{ indexes: string[] }>(pb.url, '/api/collections/users', {
      token: su,
    });
    assert.ok(
      response.body.indexes.some((index) =>
        /UNIQUE INDEX .*users.*\(\s*`?username`?\s+COLLATE NOCASE\s*\)/i.test(index),
      ),
      JSON.stringify(response.body.indexes),
    );
  });

  test('an invalid username is refused', async () => {
    for (const username of ['met spatie', 'Hoofdletter', 'ab', '-begin', 'a'.repeat(21)]) {
      const response = await api(pb.url, records, {
        method: 'POST',
        token: su,
        body: { username, name: 'Fout', role: 'child', password, passwordConfirm: password },
      });
      assertRefused(response, `username "${username}"`);
    }
  });

  test('an invalid or missing role is refused', async () => {
    for (const role of ['admin', '', undefined]) {
      counter += 1;
      const response = await api(pb.url, records, {
        method: 'POST',
        token: su,
        body: {
          username: `rol-${counter}`,
          name: 'Rol',
          role,
          password,
          passwordConfirm: password,
        },
      });
      assertRefused(response, `role "${role}"`);
    }
  });

  test('a missing or too long name is refused', async () => {
    for (const name of ['', 'x'.repeat(41)]) {
      counter += 1;
      const response = await api(pb.url, records, {
        method: 'POST',
        token: su,
        body: {
          username: `naam-${counter}`,
          name,
          role: 'child',
          password,
          passwordConfirm: password,
        },
      });
      assertRefused(response, `name of length ${name.length}`);
    }
  });

  test('avatar no longer exists', async () => {
    const response = await api<{ fields: { name: string }[] }>(pb.url, '/api/collections/users', {
      token: su,
    });
    const names = response.body.fields.map((field) => field.name);
    assert.ok(!names.includes('avatar'));
    for (const name of ['username', 'name', 'role', 'email']) assert.ok(names.includes(name));
  });

  test('an account without e-mail can exist', async () => {
    assert.equal(trio.a.record.email, '');
    assert.equal((await actual(trio.a.record.id)).status, 200);
  });

  test('only password login is enabled, with username as identity', async () => {
    const response = await api<{
      passwordAuth: { enabled: boolean; identityFields: string[] };
      oauth2: { enabled: boolean };
      otp: { enabled: boolean };
      mfa: { enabled: boolean };
      manageRule: string | null;
    }>(pb.url, '/api/collections/users', { token: su });
    assert.deepEqual(response.body.passwordAuth, { enabled: true, identityFields: ['username'] });
    assert.equal(response.body.oauth2.enabled, false);
    assert.equal(response.body.otp.enabled, false);
    assert.equal(response.body.mfa.enabled, false);
    assert.equal(response.body.manageRule, null);
  });
});
