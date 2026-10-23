// Access rules and schema of `quiz_attempts` (migration *_create_quiz_attempts.js),
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

interface AttemptRecord extends StoredRecord {
  lesson_id: string;
  question_id: string;
  option_id: string;
  correct: boolean;
  hints_used: number;
  content_version: number;
}

let pb: Awaited<ReturnType<typeof startPocketBase>>;
let su: string;
let records: ReturnType<typeof asRecord<AttemptRecord>>;

before(async () => {
  pb = await startPocketBase();
  su = await asSuperuser(pb.url, testSuperuser);
  records = asRecord<AttemptRecord>(pb, su, 'quiz_attempts');
});

after(async () => {
  await pb?.stop();
});

/** A valid attempt for `user`. */
function attempt(user: string, fields: Body = {}): Body {
  return {
    user,
    lesson_id: 'proefles',
    question_id: 'schokken-terug',
    option_id: 'aanslaan',
    correct: true,
    hints_used: 1,
    content_version: 1,
    ...fields,
  };
}

describe('without login', () => {
  let trio: Trio;
  let recordA: AttemptRecord;
  before(async () => {
    trio = await createTrio(pb, su);
    recordA = await records.make(trio.a.token, attempt(trio.a.id));
  });

  test('list gives no items', async () => {
    const response = await records.list(undefined);
    assert.equal(response.status, 200);
    assert.equal(response.body.totalItems, 0);
  });

  test('create is refused, also with user = A', async () => {
    assertRefused(await records.create(undefined, attempt('')), 'create without user');
    assertRefused(await records.create(undefined, attempt(trio.a.id)), 'create for A');
  });

  test('view of an attempt of A gives 404', async () => {
    assert.equal((await records.view(recordA.id, undefined)).status, 404);
  });

  test('update and delete are refused', async () => {
    assertRefused(await records.update(recordA.id, undefined, { correct: false }), 'update');
    assertRefused(await records.remove(recordA.id, undefined), 'delete');
    assert.equal((await records.actual(recordA.id)).body.correct, true);
  });
});

describe('child A', () => {
  let trio: Trio;
  let recordB: AttemptRecord;
  before(async () => {
    trio = await createTrio(pb, su);
    recordB = await records.make(trio.b.token, attempt(trio.b.id));
  });

  test('creates its own attempt', async () => {
    const response = await records.create(trio.a.token, attempt(trio.a.id));
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(response.body.user, trio.a.id);
    assert.equal(response.body.correct, true);
    assert.equal(response.body.hints_used, 1);
    assert.equal(response.body.content_version, 1);
  });

  test('cannot create an attempt for child B', async () => {
    assertRefused(await records.create(trio.a.token, attempt(trio.b.id)), 'create for B');
    const found = await records.list(su, `user="${trio.b.id}"`);
    assert.equal(found.body.totalItems, 1);
  });

  test('cannot create an attempt without user', async () => {
    const body = attempt(trio.a.id);
    delete body['user'];
    assertRefused(await records.create(trio.a.token, body), 'create without user');
  });

  test('lists and views only its own attempts', async () => {
    const own = await records.make(trio.a.token, attempt(trio.a.id));
    const list = await records.list(trio.a.token);
    const ids = list.body.items.map((item) => item.id);
    assert.ok(ids.includes(own.id));
    assert.ok(!ids.includes(recordB.id));
    assert.ok(list.body.items.every((item) => item.user === trio.a.id));
    assert.equal((await records.view(own.id, trio.a.token)).status, 200);
    assert.equal((await records.view(recordB.id, trio.a.token)).status, 404);
    assert.equal((await records.list(trio.a.token, `user="${trio.b.id}"`)).body.totalItems, 0);
  });

  test('cannot update or delete an attempt of child B', async () => {
    assertRefused(await records.update(recordB.id, trio.a.token, { correct: false }), 'update B');
    assertRefused(await records.remove(recordB.id, trio.a.token), 'delete B');
    const actual = await records.actual(recordB.id);
    assert.equal(actual.status, 200);
    assert.equal(actual.body.correct, true);
  });

  test('child A can store two attempts for the same question', async () => {
    const first = await records.make(trio.a.token, attempt(trio.a.id, { question_id: 'twee' }));
    const second = await records.make(
      trio.a.token,
      attempt(trio.a.id, { question_id: 'twee', option_id: 'wachten', correct: false }),
    );
    assert.notEqual(first.id, second.id);
    const found = await records.list(trio.a.token, 'question_id="twee"');
    assert.equal(found.body.totalItems, 2);
  });

  test('child A cannot delete its own attempt', async () => {
    const own = await records.make(trio.a.token, attempt(trio.a.id));
    assertRefused(await records.remove(own.id, trio.a.token), 'delete own');
    assert.equal((await records.actual(own.id)).status, 200);
  });
});

describe('append only', () => {
  test('nobody can update an attempt', async () => {
    const trio = await createTrio(pb, su);
    const own = await records.make(trio.a.token, attempt(trio.a.id));
    assertRefused(
      await records.update(own.id, trio.a.token, { correct: false, hints_used: 0 }),
      'child A updates its own attempt',
    );
    assertRefused(
      await records.update(own.id, trio.parent.token, { correct: false }),
      'the parent updates an attempt of A',
    );
    const actual = await records.actual(own.id);
    assert.equal(actual.body.correct, true);
    assert.equal(actual.body.hints_used, 1);
    assert.equal(actual.body.updated, own.updated);
  });
});

describe('schema', () => {
  let trio: Trio;
  before(async () => {
    trio = await createTrio(pb, su);
  });

  test('hints_used below 0 or not whole is refused', async () => {
    for (const hints of [-1, 1.5]) {
      assertRefused(
        await records.create(trio.a.token, attempt(trio.a.id, { hints_used: hints })),
        `hints_used ${hints}`,
      );
    }
  });

  test('content_version 0 is refused', async () => {
    assertRefused(
      await records.create(trio.a.token, attempt(trio.a.id, { content_version: 0 })),
      'content_version 0',
    );
  });

  test('an invalid id is refused', async () => {
    for (const id of ['Vraag_1', '', 'a'.repeat(61)]) {
      for (const field of ['lesson_id', 'question_id', 'option_id']) {
        assertRefused(
          await records.create(trio.a.token, attempt(trio.a.id, { [field]: id })),
          `${field} "${id}"`,
        );
      }
    }
  });

  test('correct false and hints_used 0 are fine', async () => {
    const response = await records.create(
      trio.a.token,
      attempt(trio.a.id, { correct: false, hints_used: 0 }),
    );
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(response.body.correct, false);
    assert.equal(response.body.hints_used, 0);
  });

  test('created and updated are set', async () => {
    const own = await records.make(trio.a.token, attempt(trio.a.id));
    assert.match(own.created, /^\d{4}-\d{2}-\d{2} /);
    assert.match(own.updated, /^\d{4}-\d{2}-\d{2} /);
  });
});

describe('parent', () => {
  let trio: Trio;
  let recordA: AttemptRecord;
  let recordB: AttemptRecord;
  before(async () => {
    trio = await createTrio(pb, su);
    recordA = await records.make(trio.a.token, attempt(trio.a.id));
    recordB = await records.make(trio.b.token, attempt(trio.b.id));
  });

  test('lists and views the records of every child', async () => {
    const ids = (await records.list(trio.parent.token)).body.items.map((item) => item.id);
    assert.ok(ids.includes(recordA.id) && ids.includes(recordB.id));
    assert.equal((await records.view(recordA.id, trio.parent.token)).status, 200);
    assert.equal((await records.view(recordB.id, trio.parent.token)).status, 200);
  });

  test('the parent cannot create an attempt for a child', async () => {
    assertRefused(await records.create(trio.parent.token, attempt(trio.a.id)), 'create for A');
  });

  test('the parent can delete an attempt of a child', async () => {
    const own = await records.make(trio.a.token, attempt(trio.a.id));
    assert.equal((await records.remove(own.id, trio.parent.token)).status, 204);
    assert.equal((await records.actual(own.id)).status, 404);
  });

  test('can create its own attempt', async () => {
    const response = await records.create(trio.parent.token, attempt(trio.parent.id));
    assert.equal(response.status, 200, JSON.stringify(response.body));
  });
});

describe('cascade', () => {
  test("deleting child A removes its progress and keeps B's", async () => {
    const trio = await createTrio(pb, su);
    const recordA = await records.make(trio.a.token, attempt(trio.a.id));
    const recordB = await records.make(trio.b.token, attempt(trio.b.id));
    await deleteAccount(pb, su, trio.a.id);
    assert.equal((await records.actual(recordA.id)).status, 404);
    assert.equal((await records.actual(recordB.id)).status, 200);
  });
});
