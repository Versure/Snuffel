// Shared helpers for the integration tests of the progress collections (lesson_progress,
// quiz_attempts, checklist_states): child A, child B and a parent, and short calls per record.
import assert from 'node:assert/strict';
import { api, authAs, type ApiResponse, type RecordList } from './helpers.ts';

export const password = 'snuffel-test';

export interface Account {
  id: string;
  username: string;
  token: string;
}

export interface Trio {
  a: Account;
  b: Account;
  parent: Account;
}

export interface Server {
  url: string;
}

let counter = 0;

/** Creates a `users` account as the superuser and logs it in. */
export async function createAccount(
  pb: Server,
  su: string,
  username: string,
  role: 'child' | 'parent',
): Promise<Account> {
  const response = await api<{ id: string }>(pb.url, '/api/collections/users/records', {
    method: 'POST',
    token: su,
    body: { username, name: username, role, password, passwordConfirm: password },
  });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  return { id: response.body.id, username, token: await authAs(pb.url, username, password) };
}

/** Creates child A, child B and a parent with unique usernames, and logs them in. */
export async function createTrio(pb: Server, su: string): Promise<Trio> {
  counter += 1;
  return {
    a: await createAccount(pb, su, `kind-a-${counter}`, 'child'),
    b: await createAccount(pb, su, `kind-b-${counter}`, 'child'),
    parent: await createAccount(pb, su, `ouder-${counter}`, 'parent'),
  };
}

/** Fails unless the response is a 4xx (refused by a rule, validation or not found). */
export function assertRefused(response: ApiResponse<unknown>, what: string): void {
  assert.ok(
    response.status >= 400 && response.status < 500,
    `${what} should be refused, got ${response.status} ${JSON.stringify(response.body)}`,
  );
}

export type Body = Record<string, unknown>;

export interface StoredRecord {
  id: string;
  user: string;
  created: string;
  updated: string;
  [key: string]: unknown;
}

/** Calls on one collection; `token` undefined means without login, `actual` reads as superuser. */
export function asRecord<T extends StoredRecord = StoredRecord>(
  pb: Server,
  su: string,
  collection: string,
) {
  const records = `/api/collections/${collection}/records`;
  return {
    create: (token: string | undefined, body: Body) =>
      api<T>(pb.url, records, { method: 'POST', token, body }),
    view: (id: string, token: string | undefined) => api<T>(pb.url, `${records}/${id}`, { token }),
    list: (token: string | undefined, filter?: string) =>
      api<RecordList<T>>(
        pb.url,
        `${records}?perPage=200${filter ? `&filter=${encodeURIComponent(filter)}` : ''}`,
        { token },
      ),
    update: (id: string, token: string | undefined, body: Body) =>
      api<T>(pb.url, `${records}/${id}`, { method: 'PATCH', token, body }),
    remove: (id: string, token: string | undefined) =>
      api(pb.url, `${records}/${id}`, { method: 'DELETE', token }),
    actual: (id: string) => api<T>(pb.url, `${records}/${id}`, { token: su }),
    /** Creates a record as `token` and fails the test when that does not work. */
    async make(token: string, body: Body): Promise<T> {
      const response = await api<T>(pb.url, records, { method: 'POST', token, body });
      assert.equal(response.status, 200, JSON.stringify(response.body));
      return response.body;
    },
  };
}

/** Deletes a `users` account as the superuser (to prove cascadeDelete). */
export async function deleteAccount(pb: Server, su: string, id: string): Promise<void> {
  const response = await api(pb.url, `/api/collections/users/records/${id}`, {
    method: 'DELETE',
    token: su,
  });
  assert.equal(response.status, 204, JSON.stringify(response.body));
}
