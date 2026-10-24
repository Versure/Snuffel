import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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

const seedFile = resolve(__dirname, '..', '..', '..', 'pocketbase', 'seed', 'dev-accounts.json');
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
  const auth = await childAuth(baseURL, account);
  for (const record of records) {
    await post(baseURL, 'lesson_progress', auth, {
      user: account.id,
      course_id: record.courseId,
      lesson_id: record.lessonId,
      step_id: record.stepId,
      status: record.status,
      content_version: record.contentVersion ?? 1,
    });
  }
}

const json = { 'Content-Type': 'application/json' };

/** Logs in as the child (not as the superuser), so the collection rules apply to every write. */
async function childAuth(baseURL: string, account: TestAccount): Promise<string> {
  assertLocal(baseURL);
  const { token } = await call<{ token: string }>(
    new URL('/api/collections/users/auth-with-password', baseURL).href,
    {
      method: 'POST',
      headers: json,
      body: JSON.stringify({ identity: account.username, password: testPassword }),
    },
  );
  return token;
}

async function post(
  baseURL: string,
  collection: string,
  token: string,
  body: Record<string, unknown>,
): Promise<void> {
  await call(new URL(`/api/collections/${collection}/records`, baseURL).href, {
    method: 'POST',
    headers: { ...json, Authorization: token },
    body: JSON.stringify(body),
  });
}

/** One `quiz_attempts` record to store for a child. */
export interface AttemptRecord {
  readonly lessonId: string;
  readonly questionId: string;
  readonly optionId: string;
  readonly correct: boolean;
  readonly hintsUsed?: number;
  readonly contentVersion?: number;
}

/** Creates `quiz_attempts` records (in the given order) as that child. */
export async function storeQuizAttempts(
  baseURL: string,
  account: TestAccount,
  records: readonly AttemptRecord[],
): Promise<void> {
  const auth = await childAuth(baseURL, account);
  for (const record of records) {
    await post(baseURL, 'quiz_attempts', auth, {
      user: account.id,
      lesson_id: record.lessonId,
      question_id: record.questionId,
      option_id: record.optionId,
      correct: record.correct,
      hints_used: record.hintsUsed ?? 0,
      content_version: record.contentVersion ?? 1,
    });
  }
}

/** Creates a `checklist_states` record (the ticked items of one practice step) as that child. */
export async function storeChecklist(
  baseURL: string,
  account: TestAccount,
  lessonId: string,
  checklistId: string,
  checked: readonly string[],
): Promise<void> {
  const auth = await childAuth(baseURL, account);
  await post(baseURL, 'checklist_states', auth, {
    user: account.id,
    lesson_id: lessonId,
    checklist_id: checklistId,
    checked,
  });
}

/** One `interaction_results` record to store for a child. */
export interface ResultRecord {
  readonly lessonId: string;
  readonly interactionId: string;
  readonly kind: string;
  readonly score: number;
  readonly total: number;
  readonly detail?: unknown;
  readonly contentVersion?: number;
}

/** Creates an `interaction_results` record as that child. */
export async function storeInteractionResult(
  baseURL: string,
  account: TestAccount,
  record: ResultRecord,
): Promise<void> {
  const auth = await childAuth(baseURL, account);
  await post(baseURL, 'interaction_results', auth, {
    user: account.id,
    lesson_id: record.lessonId,
    interaction_id: record.interactionId,
    kind: record.kind,
    score: record.score,
    total: record.total,
    detail: record.detail ?? null,
    content_version: record.contentVersion ?? 1,
  });
}

/** How many records of a lesson a child has in each collection. */
export interface LessonRecordCounts {
  lesson_progress: number;
  quiz_attempts: number;
  checklist_states: number;
  interaction_results: number;
}

const collections = [
  'lesson_progress',
  'quiz_attempts',
  'checklist_states',
  'interaction_results',
] as const;

/**
 * Counts the records of one child and one lesson in all four collections, as the dev superuser
 * (the `--dev-superuser` of the e2e server), so it also sees what the parent is not shown.
 */
export async function countLessonRecords(
  baseURL: string,
  userId: string,
  lessonId: string,
): Promise<LessonRecordCounts> {
  assertLocal(baseURL);
  const { superuser } = JSON.parse(readFileSync(seedFile, 'utf8')) as {
    superuser: { email: string; password: string };
  };
  const { token } = await call<{ token: string }>(
    new URL('/api/collections/_superusers/auth-with-password', baseURL).href,
    {
      method: 'POST',
      headers: json,
      body: JSON.stringify({ identity: superuser.email, password: superuser.password }),
    },
  );
  const counts = {} as LessonRecordCounts;
  for (const collection of collections) {
    const url = new URL(`/api/collections/${collection}/records`, baseURL);
    // Ids from the test itself, never user input; still quoted as a filter string.
    url.searchParams.set('filter', `user = "${userId}" && lesson_id = "${lessonId}"`);
    url.searchParams.set('perPage', '1');
    url.searchParams.set('fields', 'id');
    const page = await call<{ totalItems: number }>(url.href, {
      method: 'GET',
      headers: { Authorization: token },
    });
    counts[collection] = page.totalItems;
  }
  return counts;
}
