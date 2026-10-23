import type { TestAccount } from './accounts';
import { testPassword } from './login';

/** One `lesson_progress` record to store for a child. */
export interface StepRecord {
  readonly courseId: string;
  readonly lessonId: string;
  readonly stepId: string;
  readonly status: 'started' | 'completed';
  readonly contentVersion?: number;
}

const localHosts = ['127.0.0.1', 'localhost', '[::1]'];

/** Throws unless `url` is on this machine: test progress never goes to the NAS. */
function assertLocal(url: string): void {
  const { hostname } = new URL(url);
  if (!localHosts.includes(hostname)) {
    throw new Error(`progress: refusing to store test progress on "${url}" (only localhost)`);
  }
}

async function call<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const text = await response.text();
  if (!response.ok) throw new Error(`progress: ${init.method} ${url}: ${response.status} ${text}`);
  return JSON.parse(text) as T;
}

/**
 * Creates `lesson_progress` records for `account`. It logs in as that child (not as the
 * superuser), so the collection rules apply to every write, like in the app.
 */
export async function storeStepStatuses(
  baseURL: string,
  account: TestAccount,
  records: readonly StepRecord[],
): Promise<void> {
  assertLocal(baseURL);
  const json = { 'Content-Type': 'application/json' };
  const { token } = await call<{ token: string }>(
    new URL('/api/collections/users/auth-with-password', baseURL).href,
    {
      method: 'POST',
      headers: json,
      body: JSON.stringify({ identity: account.username, password: testPassword }),
    },
  );
  for (const record of records) {
    await call(new URL('/api/collections/lesson_progress/records', baseURL).href, {
      method: 'POST',
      headers: { ...json, Authorization: token },
      body: JSON.stringify({
        user: account.id,
        course_id: record.courseId,
        lesson_id: record.lessonId,
        step_id: record.stepId,
        status: record.status,
        content_version: record.contentVersion ?? 1,
      }),
    });
  }
}
