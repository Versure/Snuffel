// Small fetch helpers for the PocketBase integration tests. They talk to the REST API
// directly, the way any other client (or attacker) would.

export interface Credentials {
  email: string;
  password: string;
}

export interface ApiResponse<T = Record<string, unknown>> {
  status: number;
  body: T;
}

export interface RecordList<T = Record<string, unknown>> {
  page: number;
  totalItems: number;
  items: T[];
}

export interface ApiOptions {
  method?: string;
  token?: string;
  body?: unknown;
}

/** Sends a JSON request to `<url><path>` and returns status and parsed body. */
export async function api<T = Record<string, unknown>>(
  url: string,
  path: string,
  { method = 'GET', token, body }: ApiOptions = {},
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = token;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${url}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: (text ? JSON.parse(text) : {}) as T };
}

/** Logs in to an auth collection and returns the response (token and record on success). */
export function authWithPassword(
  url: string,
  identity: string,
  password: string,
  collection = 'users',
): Promise<ApiResponse<{ token?: string; record?: Record<string, unknown> }>> {
  return api(url, `/api/collections/${collection}/auth-with-password`, {
    method: 'POST',
    body: { identity, password },
  });
}

/** Logs in as a `users` account and returns its token; fails the test when that is not possible. */
export async function authAs(url: string, identity: string, password: string): Promise<string> {
  const response = await authWithPassword(url, identity, password);
  if (response.status !== 200 || !response.body.token) {
    throw new Error(
      `Login as ${identity} failed: ${response.status} ${JSON.stringify(response.body)}`,
    );
  }
  return response.body.token;
}

/** Logs in as a superuser and returns its token. */
export async function asSuperuser(url: string, { email, password }: Credentials): Promise<string> {
  const response = await authWithPassword(url, email, password, '_superusers');
  if (response.status !== 200 || !response.body.token) {
    throw new Error(`Superuser login failed: ${response.status} ${JSON.stringify(response.body)}`);
  }
  return response.body.token;
}
