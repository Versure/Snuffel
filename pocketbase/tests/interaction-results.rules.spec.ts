// Access rules and schema of `interaction_results` (migration *_create_interaction_results.js),
// proven with child A, child B and a parent against a real PocketBase.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { startPocketBase, testSuperuser } from '../../tools/pocketbase-harness.mjs';
import { asSuperuser } from './helpers.ts';
import {
  asRecord,
  assertRefused,
  createTrio,
  deleteAccount,
  type Body,
  type StoredRecord,
  type Trio,
} from './progress-helpers.ts';

interface ResultRecord extends StoredRecord {
  lesson_id: string;
  interaction_id: string;
  kind: string;
  score: number;
  total: number;
  detail: unknown;
  content_version: number;
}

let pb: Awaited<ReturnType<typeof startPocketBase>>;
let su: string;
let records: ReturnType<typeof asRecord<ResultRecord>>;

before(async () => {
  pb = await startPocketBase();
  su = await asSuperuser(pb.url, testSuperuser);
  records = asRecord<ResultRecord>(pb, su, 'interaction_results');
});

after(async () => {
  await pb?.stop();
});

/** A valid result for `user`. */
function result(user: string, fields: Body = {}): Body {
  return {
    user,
    lesson_id: 'proefles',
    interaction_id: 'voel-spel',
    kind: 'trace-game',
    score: 6,
    total: 8,
    detail: { rounds: [{ pattern: 'tik', choice: 'vis', correct: true }] },
    content_version: 1,
    ...fields,
  };
}

describe('without login', () => {
  let trio: Trio;
  let recordA: ResultRecord;
  before(async () => {
    trio = await createTrio(pb, su);
    recordA = await records.make(trio.a.token, result(trio.a.id));
  });

  test('list gives no items', async () => {
    const response = await records.list(undefined);
    assert.equal(response.status, 200);
    assert.equal(response.body.totalItems, 0);
  });

  test('create is refused, also with user = A', async () => {
    assertRefused(await records.create(undefined, result('')), 'create without user');
    assertRefused(await records.create(undefined, result(trio.a.id)), 'create for A');
  });

  test('view of a result of A gives 404', async () => {
    assert.equal((await records.view(recordA.id, undefined)).status, 404);
  });

  test('update and delete are refused', async () => {
    assertRefused(await records.update(recordA.id, undefined, { score: 8 }), 'update');
    assertRefused(await records.remove(recordA.id, undefined), 'delete');
    assert.equal((await records.actual(recordA.id)).body.score, 6);
  });
});

describe('child A', () => {
  let trio: Trio;
  let recordB: ResultRecord;
  before(async () => {
    trio = await createTrio(pb, su);
    recordB = await records.make(trio.b.token, result(trio.b.id));
  });

  test('creates its own result', async () => {
    const response = await records.create(trio.a.token, result(trio.a.id));
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(response.body.user, trio.a.id);
    assert.equal(response.body.kind, 'trace-game');
    assert.equal(response.body.score, 6);
    assert.equal(response.body.total, 8);
    assert.deepEqual(response.body.detail, {
      rounds: [{ pattern: 'tik', choice: 'vis', correct: true }],
    });
    assert.equal(response.body.content_version, 1);
  });

  test('can store two results for the same interaction', async () => {
    const first = await records.make(trio.a.token, result(trio.a.id, { interaction_id: 'twee' }));
    const second = await records.make(
      trio.a.token,
      result(trio.a.id, { interaction_id: 'twee', score: 3 }),
    );
    assert.notEqual(first.id, second.id);
    const found = await records.list(trio.a.token, 'interaction_id="twee"');
    assert.equal(found.body.totalItems, 2);
  });

  test('cannot create a result for child B', async () => {
    assertRefused(await records.create(trio.a.token, result(trio.b.id)), 'create for B');
    const found = await records.list(su, `user="${trio.b.id}"`);
    assert.equal(found.body.totalItems, 1);
  });

  test('cannot create a result without user', async () => {
    const body = result(trio.a.id);
    delete body['user'];
    assertRefused(await records.create(trio.a.token, body), 'create without user');
  });

  test('lists and views only its own results', async () => {
    const own = await records.make(trio.a.token, result(trio.a.id));
    const list = await records.list(trio.a.token);
    const ids = list.body.items.map((item) => item.id);
    assert.ok(ids.includes(own.id));
    assert.ok(!ids.includes(recordB.id));
    assert.ok(list.body.items.every((item) => item.user === trio.a.id));
    assert.equal((await records.view(own.id, trio.a.token)).status, 200);
    assert.equal((await records.view(recordB.id, trio.a.token)).status, 404);
    assert.equal((await records.list(trio.a.token, `user="${trio.b.id}"`)).body.totalItems, 0);
  });

  test('cannot update its own result', async () => {
    const own = await records.make(trio.a.token, result(trio.a.id));
    assertRefused(await records.update(own.id, trio.a.token, { score: 8 }), 'update own');
    const actual = await records.actual(own.id);
    assert.equal(actual.body.score, 6);
    assert.equal(actual.body.updated, own.updated);
  });

  test('cannot update or delete a result of child B', async () => {
    assertRefused(await records.update(recordB.id, trio.a.token, { score: 0 }), 'update B');
    assertRefused(await records.remove(recordB.id, trio.a.token), 'delete B');
    const actual = await records.actual(recordB.id);
    assert.equal(actual.status, 200);
    assert.equal(actual.body.score, 6);
  });

  test('cannot delete its own result', async () => {
    const own = await records.make(trio.a.token, result(trio.a.id));
    assertRefused(await records.remove(own.id, trio.a.token), 'delete own');
    assert.equal((await records.actual(own.id)).status, 200);
  });
});

describe('schema', () => {
  let trio: Trio;
  before(async () => {
    trio = await createTrio(pb, su);
  });

  test('a score higher than total is refused', async () => {
    assertRefused(
      await records.create(trio.a.token, result(trio.a.id, { score: 9, total: 8 })),
      'score 9 of 8',
    );
    const equal = await records.create(trio.a.token, result(trio.a.id, { score: 8, total: 8 }));
    assert.equal(equal.status, 200, JSON.stringify(equal.body));
  });

  test('score below 0 or not whole is refused', async () => {
    for (const score of [-1, 1.5]) {
      assertRefused(
        await records.create(trio.a.token, result(trio.a.id, { score })),
        `score ${score}`,
      );
    }
  });

  test('total 0 is refused', async () => {
    assertRefused(
      await records.create(trio.a.token, result(trio.a.id, { score: 0, total: 0 })),
      'total 0',
    );
  });

  test('content_version 0 is refused', async () => {
    assertRefused(
      await records.create(trio.a.token, result(trio.a.id, { content_version: 0 })),
      'content_version 0',
    );
  });

  test('an invalid id is refused', async () => {
    for (const id of ['Voel_Spel', '', 'a'.repeat(61)]) {
      for (const field of ['lesson_id', 'interaction_id', 'kind']) {
        assertRefused(
          await records.create(trio.a.token, result(trio.a.id, { [field]: id })),
          `${field} "${id}"`,
        );
      }
    }
  });

  test('a detail larger than 4 kB is refused', async () => {
    const rounds = Array.from({ length: 80 }, () => ({
      pattern: 'een-heel-lang-patroon-id',
      choice: 'een-heel-lange-keuze',
      correct: true,
    }));
    assert.ok(JSON.stringify({ rounds }).length > 4096);
    assertRefused(
      await records.create(trio.a.token, result(trio.a.id, { detail: { rounds } })),
      'detail > 4 kB',
    );
  });

  test('score 0 with total 8 is fine', async () => {
    const response = await records.create(trio.a.token, result(trio.a.id, { score: 0, total: 8 }));
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(response.body.score, 0);
    assert.equal(response.body.total, 8);
  });

  test('created and updated are set', async () => {
    const own = await records.make(trio.a.token, result(trio.a.id));
    assert.match(own.created, /^\d{4}-\d{2}-\d{2} /);
    assert.match(own.updated, /^\d{4}-\d{2}-\d{2} /);
  });
});

describe('parent', () => {
  let trio: Trio;
  let recordA: ResultRecord;
  let recordB: ResultRecord;
  before(async () => {
    trio = await createTrio(pb, su);
    recordA = await records.make(trio.a.token, result(trio.a.id));
    recordB = await records.make(trio.b.token, result(trio.b.id));
  });

  test('lists and views the results of every child', async () => {
    const ids = (await records.list(trio.parent.token)).body.items.map((item) => item.id);
    assert.ok(ids.includes(recordA.id) && ids.includes(recordB.id));
    assert.equal((await records.view(recordA.id, trio.parent.token)).status, 200);
    assert.equal((await records.view(recordB.id, trio.parent.token)).status, 200);
  });

  test('cannot create a result for a child', async () => {
    assertRefused(await records.create(trio.parent.token, result(trio.a.id)), 'create for A');
  });

  test('cannot update a result of a child', async () => {
    assertRefused(await records.update(recordA.id, trio.parent.token, { score: 0 }), 'update A');
    assert.equal((await records.actual(recordA.id)).body.score, 6);
  });

  test('can delete a result of a child', async () => {
    const own = await records.make(trio.a.token, result(trio.a.id));
    assert.equal((await records.remove(own.id, trio.parent.token)).status, 204);
    assert.equal((await records.actual(own.id)).status, 404);
  });

  test('can create its own result', async () => {
    const response = await records.create(trio.parent.token, result(trio.parent.id));
    assert.equal(response.status, 200, JSON.stringify(response.body));
  });
});

describe('cascade', () => {
  test("deleting child A removes its results and keeps B's", async () => {
    const trio = await createTrio(pb, su);
    const recordA = await records.make(trio.a.token, result(trio.a.id));
    const recordB = await records.make(trio.b.token, result(trio.b.id));
    await deleteAccount(pb, su, trio.a.id);
    assert.equal((await records.actual(recordA.id)).status, 404);
    assert.equal((await records.actual(recordB.id)).status, 200);
  });
});
