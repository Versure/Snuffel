import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Page } from '@playwright/test';
import { afterThisTest, test } from '../fixtures';
import { loginAs, testPassword } from './login';

/** A child account made for one test. */
export interface TestAccount {
  readonly id: string;
  readonly username: string;
  readonly name: string;
}

interface Seed {
  superuser: { email: string; password: string };
}

const seedFile = resolve(__dirname, '..', '..', '..', 'pocketbase', 'seed', 'dev-accounts.json');
const localHosts = ['127.0.0.1', 'localhost', '[::1]'];

/** Throws unless `url` is on this machine: test accounts never go to the NAS. */
function assertLocal(url: string): void {
  const { hostname } = new URL(url);
  if (!localHosts.includes(hostname)) {
    throw new Error(`accounts: refusing to create a test account on "${url}" (only localhost)`);
  }
}

async function call<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const text = await response.text();
  if (!response.ok) throw new Error(`accounts: ${init.method} ${url}: ${response.status} ${text}`);
  return JSON.parse(text) as T;
}

export interface ChildOptions {
  /** The display name; "Testkind" by default. */
  readonly name?: string;
  /**
   * The ids of the `selected-children` courses the child sees (a `course_assignments` record
   * each, as the parent makes on /ouder). Courses for every child need none.
   */
  readonly courses?: readonly string[];
}

/**
 * Creates a new child account (`e2e-<8 characters>`, password `snuffel-test`) as the dev
 * superuser from pocketbase/seed/dev-accounts.json, through the REST API. Every test that writes
 * progress gets its own child, so tests running at the same time never see each other's ticks.
 * The parent sees every test child, so a test that looks one up on /ouder passes a unique `name`
 * (see `uniqueName`); the default is "Testkind". `courses` are assigned to the new child.
 * The account (with its progress and assignments) is deleted when the test ends, so /ouder only
 * shows the seeded children and those of the tests that are running, not every child of the run.
 */
export async function createChild(
  baseURL: string,
  { name = 'Testkind', courses = [] }: ChildOptions = {},
): Promise<TestAccount> {
  assertLocal(baseURL);
  const { superuser } = JSON.parse(readFileSync(seedFile, 'utf8')) as Seed;
  const json = { 'Content-Type': 'application/json' };
  const { token } = await call<{ token: string }>(
    new URL('/api/collections/_superusers/auth-with-password', baseURL).href,
    {
      method: 'POST',
      headers: json,
      body: JSON.stringify({ identity: superuser.email, password: superuser.password }),
    },
  );
  const username = `e2e-${randomBytes(4).toString('hex')}`;
  const record = await call<{ id: string }>(
    new URL('/api/collections/users/records', baseURL).href,
    {
      method: 'POST',
      headers: { ...json, Authorization: token },
      body: JSON.stringify({
        username,
        name,
        role: 'child',
        password: testPassword,
        passwordConfirm: testPassword,
      }),
    },
  );
  afterThisTest(() => deleteChild(baseURL, token, record.id));
  for (const courseId of courses) {
    await call<{ id: string }>(
      new URL('/api/collections/course_assignments/records', baseURL).href,
      {
        method: 'POST',
        headers: { ...json, Authorization: token },
        body: JSON.stringify({ user: record.id, course_id: courseId }),
      },
    );
  }
  return { id: record.id, username, name };
}

/** Deletes a test child; its records go with it (every relation to users cascades). */
async function deleteChild(baseURL: string, token: string, id: string): Promise<void> {
  const url = new URL(`/api/collections/users/records/${id}`, baseURL).href;
  const response = await fetch(url, { method: 'DELETE', headers: { Authorization: token } });
  if (!response.ok) {
    throw new Error(`accounts: DELETE ${url}: ${response.status} ${await response.text()}`);
  }
}

/** A name no other test child has, for tests that find their child on /ouder. */
export function uniqueName(prefix = 'Testkind'): string {
  return `${prefix} ${randomBytes(4).toString('hex')}`;
}

/** The base URL of the running test's project (the PocketBase server for lesson tests). */
export function currentBaseURL(): string {
  const baseURL = test.info().project.use.baseURL;
  if (!baseURL) throw new Error('accounts: the project has no baseURL');
  return baseURL;
}

/**
 * Creates a new child (with the `selected-children` courses in `courses` assigned), opens `path`
 * and logs in as that child.
 */
export async function loginAsNewChild(
  page: Page,
  path: string,
  { courses = [] }: { courses?: readonly string[] } = {},
): Promise<TestAccount> {
  const account = await createChild(currentBaseURL(), { courses });
  await loginAs(page, account.username, path);
  return account;
}
