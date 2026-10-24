// Clearing one lesson of one child, the way the parent overview does it (M12): find the ids
// with a filter on user and lesson_id in all four progress collections, then delete them one by
// one. No rule changes: this proves the rules of M5, M8 and M9 allow exactly that.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { startPocketBase, testSuperuser } from '../../tools/pocketbase-harness.mjs';
import { asSuperuser } from './helpers.ts';
import {
  asRecord,
  assertRefused,
  createTrio,
  type Account,
  type Body,
  type StoredRecord,
  type Trio,
} from './progress-helpers.ts';

const collections = [
  'lesson_progress',
  'quiz_attempts',
  'checklist_states',
  'interaction_results',
] as const;
type Collection = (typeof collections)[number];

let pb: Awaited<ReturnType<typeof startPocketBase>>;
let su: string;
let records: Record<Collection, ReturnType<typeof asRecord>>;

before(async () => {
  pb = await startPocketBase();
  su = await asSuperuser(pb.url, testSuperuser);
  records = {
    lesson_progress: asRecord(pb, su, 'lesson_progress'),
    quiz_attempts: asRecord(pb, su, 'quiz_attempts'),
    checklist_states: asRecord(pb, su, 'checklist_states'),
    interaction_results: asRecord(pb, su, 'interaction_results'),
  };
});

after(async () => {
  await pb?.stop();
});

/** A valid body per collection for `user` and `lessonId`; `n` keeps unique indexes apart. */
function body(collection: Collection, user: string, lessonId: string, n: number): Body {
  switch (collection) {
    case 'lesson_progress':
      return {
        user,
        course_id: 'proefcursus',
        lesson_id: lessonId,
        step_id: `stap-${n}`,
        status: 'completed',
        content_version: 1,
      };
    case 'quiz_attempts':
      return {
        user,
        lesson_id: lessonId,
        question_id: `vraag-${n}`,
        option_id: 'a',
        correct: true,
        hints_used: 0,
        content_version: 1,
      };
    case 'checklist_states':
      return { user, lesson_id: lessonId, checklist_id: `lijst-${n}`, checked: ['vispas'] };
    case 'interaction_results':
      return {
        user,
        lesson_id: lessonId,
        interaction_id: 'voel-spel',
        kind: 'trace-game',
        score: n,
        total: 8,
        detail: null,
        content_version: 1,
      };
  }
}

/** Stores two records of `lessonId` for `account` in every collection. */
async function store(account: Account, lessonId: string): Promise<void> {
  for (const collection of collections) {
    for (const n of [1, 2]) {
      await records[collection].make(account.token, body(collection, account.id, lessonId, n));
    }
  }
}

/** The filter the app builds (with parameters there; the ids here are generated, not typed). */
function lessonFilter(userId: string, lessonId: string): string {
  return `user = "${userId}" && lesson_id = "${lessonId}"`;
}

/** The ids of `userId` for `lessonId` in one collection, as `token` sees them. */
async function findIds(
  collection: Collection,
  token: string,
  userId: string,
  lessonId: string,
): Promise<string[]> {
  const response = await records[collection].list(token, lessonFilter(userId, lessonId));
  assert.equal(response.status, 200, JSON.stringify(response.body));
  return response.body.items.map((item: StoredRecord) => item.id);
}

/** Counts as the superuser, so the answer does not depend on the rules. */
async function count(collection: Collection, userId: string, lessonId: string): Promise<number> {
  return (await findIds(collection, su, userId, lessonId)).length;
}

/** Deletes every given id as `token`; fails the test unless each delete gives 204. */
async function deleteAll(collection: Collection, token: string, ids: string[]): Promise<void> {
  for (const id of ids) {
    const response = await records[collection].remove(id, token);
    assert.equal(response.status, 204, `${collection} ${id}: ${JSON.stringify(response.body)}`);
  }
}

describe('a parent clears one lesson of a child', () => {
  let trio: Trio;
  before(async () => {
    trio = await createTrio(pb, su);
    await store(trio.a, 'proefles');
    await store(trio.a, 'proefles-breuken');
    await store(trio.b, 'proefles');
  });

  test('the parent finds every record of child A for one lesson with a filter on user and lesson_id, in all four collections', async () => {
    for (const collection of collections) {
      const ids = await findIds(collection, trio.parent.token, trio.a.id, 'proefles');
      assert.equal(ids.length, 2, collection);
    }
  });

  test('the parent deletes them one by one and nothing of that lesson is left for A', async () => {
    for (const collection of collections) {
      const ids = await findIds(collection, trio.parent.token, trio.a.id, 'proefles');
      await deleteAll(collection, trio.parent.token, ids);
      assert.equal(await count(collection, trio.a.id, 'proefles'), 0, collection);
    }
  });

  test('the other lesson of A and the same lesson of B stay', async () => {
    for (const collection of collections) {
      assert.equal(await count(collection, trio.a.id, 'proefles-breuken'), 2, collection);
      assert.equal(await count(collection, trio.b.id, 'proefles'), 2, collection);
    }
  });
});

describe('a child cannot clear a lesson', () => {
  let trio: Trio;
  before(async () => {
    trio = await createTrio(pb, su);
    await store(trio.a, 'proefles');
    await store(trio.b, 'proefles');
  });

  test('child A cannot delete its own records of that lesson, nor those of B', async () => {
    for (const collection of collections) {
      const own = await findIds(collection, trio.a.token, trio.a.id, 'proefles');
      assert.equal(own.length, 2, collection);
      for (const id of own) {
        assertRefused(await records[collection].remove(id, trio.a.token), `${collection} own`);
      }
      // A cannot even find the records of B, so the ids come from the superuser.
      assert.deepEqual(await findIds(collection, trio.a.token, trio.b.id, 'proefles'), []);
      for (const id of await findIds(collection, su, trio.b.id, 'proefles')) {
        assertRefused(await records[collection].remove(id, trio.a.token), `${collection} of B`);
      }
      assert.equal(await count(collection, trio.a.id, 'proefles'), 2, collection);
      assert.equal(await count(collection, trio.b.id, 'proefles'), 2, collection);
    }
  });
});

describe('clearing is safe to repeat', () => {
  let trio: Trio;
  before(async () => {
    trio = await createTrio(pb, su);
    await store(trio.a, 'proefles');
  });

  test('deleting again after a partial delete removes the rest', async () => {
    // A connection lost halfway: only the first record of every collection is gone.
    for (const collection of collections) {
      const ids = await findIds(collection, trio.parent.token, trio.a.id, 'proefles');
      await deleteAll(collection, trio.parent.token, ids.slice(0, 1));
      assert.equal(await count(collection, trio.a.id, 'proefles'), 1, collection);
    }
    // Again: search anew and delete what is left.
    for (const collection of collections) {
      const ids = await findIds(collection, trio.parent.token, trio.a.id, 'proefles');
      assert.equal(ids.length, 1, collection);
      await deleteAll(collection, trio.parent.token, ids);
      assert.equal(await count(collection, trio.a.id, 'proefles'), 0, collection);
    }
  });
});
