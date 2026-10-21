// Fills a local PocketBase with the dev/test accounts from pocketbase/seed/dev-accounts.json.
// Only for local development and the e2e tests: the seed never goes into the image
// (see tools/image-contents.test.mjs) and never runs on the NAS.
//
// Usage: node tools/seed-pocketbase.mjs --url http://127.0.0.1:8092 [--file pocketbase/seed/dev-accounts.json]
// The superuser from the file must exist already (serve-pocketbase.mjs --dev-superuser makes it).
// Running it again changes nothing: accounts are matched on `username` and updated.
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { rootDir } from './fetch-pocketbase.mjs';
import { upsertSuperuser } from './pocketbase-harness.mjs';

export { upsertSuperuser };

export const defaultSeedFile = join(rootDir, 'pocketbase', 'seed', 'dev-accounts.json');

const roles = ['child', 'parent'];

const localHosts = ['127.0.0.1', 'localhost', '[::1]'];

/**
 * Throws unless `url` is an http(s) URL on this machine (127.0.0.1, localhost or ::1).
 * The seed puts known passwords into PocketBase, so it must never reach the NAS.
 */
export function assertLocalUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`seed: --url "${url}" is not a valid URL`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || !localHosts.includes(parsed.hostname)) {
    throw new Error(
      `seed: refusing to seed "${url}": only 127.0.0.1, localhost or ::1 are allowed (never the NAS)`,
    );
  }
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

/**
 * Reads and checks a seed file: `{ superuser: { email, password }, accounts: [{ username, name, role, password }] }`.
 * Throws an error that names the file and the broken part.
 */
export function loadSeed(file = defaultSeedFile) {
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch (error) {
    throw new Error(`seed: cannot read ${file} (${error.code ?? error.message})`, { cause: error });
  }
  let seed;
  try {
    seed = JSON.parse(text);
  } catch (error) {
    throw new Error(`seed: ${file} is not valid JSON (${error.message})`, { cause: error });
  }
  const problems = [];
  if (!seed || typeof seed !== 'object' || Array.isArray(seed)) {
    problems.push('the file must contain an object with "superuser" and "accounts"');
  } else {
    if (!nonEmptyString(seed.superuser?.email) || !nonEmptyString(seed.superuser?.password)) {
      problems.push('"superuser" needs "email" and "password"');
    }
    if (!Array.isArray(seed.accounts) || seed.accounts.length === 0) {
      problems.push('"accounts" must be a non-empty list');
    } else {
      seed.accounts.forEach((account, index) => {
        for (const key of ['username', 'name', 'password']) {
          if (!nonEmptyString(account?.[key]))
            problems.push(`accounts[${index}].${key} is missing`);
        }
        if (!roles.includes(account?.role)) {
          problems.push(`accounts[${index}].role must be "child" or "parent"`);
        }
      });
    }
  }
  if (problems.length > 0) {
    throw new Error(`seed: ${file} is invalid: ${problems.join('; ')}`);
  }
  return seed;
}

async function request(url, path, { method = 'GET', token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = token;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${url}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const json = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(`seed: ${method} ${path} failed: HTTP ${response.status} ${text}`);
  }
  return json;
}

/**
 * Creates or updates each account (matched on `username`): `name`, `role` and password are set.
 * Returns `{ created, updated }` with the usernames.
 */
export async function seedAccounts(url, superuser, accounts) {
  assertLocalUrl(url);
  const { token } = await request(url, '/api/collections/_superusers/auth-with-password', {
    method: 'POST',
    body: { identity: superuser.email, password: superuser.password },
  });
  const created = [];
  const updated = [];
  for (const { username, name, role, password } of accounts) {
    const filter = encodeURIComponent(`username="${username}"`);
    const existing = await request(
      url,
      `/api/collections/users/records?perPage=1&skipTotal=1&filter=${filter}`,
      { token },
    );
    const body = { username, name, role, password, passwordConfirm: password };
    if (existing.items.length > 0) {
      await request(url, `/api/collections/users/records/${existing.items[0].id}`, {
        method: 'PATCH',
        token,
        body,
      });
      updated.push(username);
    } else {
      await request(url, '/api/collections/users/records', { method: 'POST', token, body });
      created.push(username);
    }
  }
  return { created, updated };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({
    options: {
      url: { type: 'string' },
      file: { type: 'string', default: defaultSeedFile },
    },
  });
  if (!values.url) {
    console.error('seed: --url is required, e.g. --url http://127.0.0.1:8092');
    process.exit(1);
  }
  try {
    assertLocalUrl(values.url);
    const seed = loadSeed(resolve(values.file));
    const { created, updated } = await seedAccounts(values.url, seed.superuser, seed.accounts);
    console.log(
      `seed: test accounts ready on ${values.url} (created: ${created.join(', ') || '-'}; updated: ${updated.join(', ') || '-'})`,
    );
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
