// Access rules and schema of `lesson_progress` (migration *_create_lesson_progress.js),
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

interface ProgressRecord extends StoredRecord {
  course_id: string;
  lesson_id: string;
  step_id: string;
  status: 'started' | 'completed';
  content_version: number;
}

let pb: Awaited<ReturnType<typeof startPocketBase>>;
let su: string;
let records: ReturnType<typeof asRecord<ProgressRecord>>;
let stepCounter = 0;

before(async () => {
  pb = await startPocketBase();
  su = await asSuperuser(pb.url, testSuperuser);
  records = asRecord<ProgressRecord>(pb, su, 'lesson_progress');
});

after(async () => {
  await pb?.stop();
});

/** A valid body for `user` with a step id that no other test uses. */
function progress(user: string, fields: Body = {}): Body {
  stepCounter += 1;
  return {
    user,
    course_id: 'proefcursus',
    lesson_id: 'proefles',
    step_id: `stap-${stepCounter}`,
    status: 'started',
    content_version: 1,
    ...fields,
  };
}

describe('without login', () => {
  let trio: Trio;
  let recordA: ProgressRecord;
  before(async () => {
    trio = await createTrio(pb, su);
    recordA = await records.make(trio.a.token, progress(trio.a.id));
  });

  test('list gives no items', async () => {
    const response = await records.list(undefined);
    assert.equal(response.status, 200);
    assert.equal(response.body.totalItems, 0);
  });

  test('create is refused, also with user = A', async () => {
    assertRefused(await records.create(undefined, progress('')), 'create without user');
    assertRefused(await records.create(undefined, progress(trio.a.id)), 'create for A');
  });

  test('view of a record of A gives 404', async () => {
    assert.equal((await records.view(recordA.id, undefined)).status, 404);
  });

  test('update and delete are refused', async () => {
    assertRefused(await records.update(recordA.id, undefined, { status: 'completed' }), 'update');
    assertRefused(await records.remove(recordA.id, undefined), 'delete');
    const actual = await records.actual(recordA.id);
    assert.equal(actual.status, 200);
    assert.equal(actual.body.status, 'started');
  });
});

describe('child A', () => {
  let trio: Trio;
  let recordB: ProgressRecord;
  before(async () => {
    trio = await createTrio(pb, su);
    recordB = await records.make(trio.b.token, progress(trio.b.id));
  });

  test('creates its own progress record', async () => {
    const response = await records.create(trio.a.token, progress(trio.a.id));
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(response.body.user, trio.a.id);
    assert.equal(response.body.status, 'started');
  });

  test('cannot create a record for child B', async () => {
    assertRefused(await records.create(trio.a.token, progress(trio.b.id)), 'create for B');
    const found = await records.list(su, `user="${trio.b.id}"`);
    assert.equal(found.body.totalItems, 1);
  });

  test('cannot create a record without user', async () => {
    const body = progress(trio.a.id);
    delete body['user'];
    assertRefused(await records.create(trio.a.token, body), 'create without user');
  });

  test('lists and views only its own records', async () => {
    const own = await records.make(trio.a.token, progress(trio.a.id));
    const list = await records.list(trio.a.token);
    assert.equal(list.status, 200);
    const ids = list.body.items.map((item) => item.id);
    assert.ok(ids.includes(own.id));
    assert.ok(!ids.includes(recordB.id));
    assert.ok(list.body.items.every((item) => item.user === trio.a.id));
    assert.equal((await records.view(own.id, trio.a.token)).status, 200);
    assert.equal((await records.view(recordB.id, trio.a.token)).status, 404);
    const filtered = await records.list(trio.a.token, `user="${trio.b.id}"`);
    assert.equal(filtered.body.totalItems, 0);
  });

  test('updates status and content_version of its own record', async () => {
    const own = await records.make(trio.a.token, progress(trio.a.id));
    const response = await records.update(own.id, trio.a.token, {
      status: 'completed',
      content_version: 2,
    });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(response.body.status, 'completed');
    assert.equal(response.body.content_version, 2);
  });

  test('cannot move its own record to child B', async () => {
    const own = await records.make(trio.a.token, progress(trio.a.id));
    assertRefused(await records.update(own.id, trio.a.token, { user: trio.b.id }), 'user = B');
    assertRefused(await records.update(own.id, trio.a.token, { user: trio.a.id }), 'user = A');
    const actual = await records.actual(own.id);
    assert.equal(actual.body.user, trio.a.id);
  });

  test('cannot change course_id, lesson_id or step_id of its own record', async () => {
    const own = await records.make(trio.a.token, progress(trio.a.id));
    for (const field of ['course_id', 'lesson_id', 'step_id']) {
      assertRefused(
        await records.update(own.id, trio.a.token, { [field]: 'iets-anders', status: 'completed' }),
        `update ${field}`,
      );
    }
    const actual = await records.actual(own.id);
    assert.equal(actual.body.course_id, own.course_id);
    assert.equal(actual.body.lesson_id, own.lesson_id);
    assert.equal(actual.body.step_id, own.step_id);
    assert.equal(actual.body.status, 'started');
  });

  test('cannot update or delete a record of child B', async () => {
    assertRefused(
      await records.update(recordB.id, trio.a.token, { status: 'completed' }),
      'update B',
    );
    assertRefused(await records.remove(recordB.id, trio.a.token), 'delete B');
    const actual = await records.actual(recordB.id);
    assert.equal(actual.status, 200);
    assert.equal(actual.body.status, 'started');
  });

  test('cannot delete its own record', async () => {
    const own = await records.make(trio.a.token, progress(trio.a.id));
    assertRefused(await records.remove(own.id, trio.a.token), 'delete own');
    assert.equal((await records.actual(own.id)).status, 200);
  });
});

describe('unique', () => {
  let trio: Trio;
  before(async () => {
    trio = await createTrio(pb, su);
  });

  test('a second record for the same user, lesson and step is refused', async () => {
    const body = progress(trio.a.id);
    await records.make(trio.a.token, body);
    assertRefused(
      await records.create(trio.a.token, { ...body, status: 'completed' }),
      'second record',
    );
    const found = await records.list(su, `user="${trio.a.id}" && step_id="${body['step_id']}"`);
    assert.equal(found.body.totalItems, 1);
  });

  test('the same lesson and step for child B is fine', async () => {
    const body = progress(trio.a.id);
    await records.make(trio.a.token, body);
    const response = await records.create(trio.b.token, { ...body, user: trio.b.id });
    assert.equal(response.status, 200, JSON.stringify(response.body));
  });
});

describe('schema', () => {
  let trio: Trio;
  before(async () => {
    trio = await createTrio(pb, su);
  });

  test('an invalid status is refused', async () => {
    assertRefused(
      await records.create(trio.a.token, progress(trio.a.id, { status: 'done' })),
      'status done',
    );
  });

  test('an invalid id is refused', async () => {
    for (const id of ['Stap_1', '', 'a'.repeat(61)]) {
      for (const field of ['course_id', 'lesson_id', 'step_id']) {
        assertRefused(
          await records.create(trio.a.token, progress(trio.a.id, { [field]: id })),
          `${field} "${id}"`,
        );
      }
    }
  });

  test('a content_version of 0 or 1.5 is refused', async () => {
    for (const version of [0, 1.5]) {
      assertRefused(
        await records.create(trio.a.token, progress(trio.a.id, { content_version: version })),
        `content_version ${version}`,
      );
    }
  });

  test('created and updated are set', async () => {
    const own = await records.make(trio.a.token, progress(trio.a.id));
    assert.match(own.created, /^\d{4}-\d{2}-\d{2} /);
    assert.match(own.updated, /^\d{4}-\d{2}-\d{2} /);
    await new Promise((resolve) => setTimeout(resolve, 20));
    const updated = await records.update(own.id, trio.a.token, { status: 'completed' });
    assert.equal(updated.body.created, own.created);
    assert.ok(updated.body.updated > own.updated, `${updated.body.updated} > ${own.updated}`);
  });
});

describe('parent', () => {
  let trio: Trio;
  let recordA: ProgressRecord;
  let recordB: ProgressRecord;
  before(async () => {
    trio = await createTrio(pb, su);
    recordA = await records.make(trio.a.token, progress(trio.a.id));
    recordB = await records.make(trio.b.token, progress(trio.b.id));
  });

  test('lists and views the records of every child', async () => {
    const list = await records.list(trio.parent.token);
    const ids = list.body.items.map((item) => item.id);
    assert.ok(ids.includes(recordA.id) && ids.includes(recordB.id));
    assert.equal((await records.view(recordA.id, trio.parent.token)).status, 200);
    assert.equal((await records.view(recordB.id, trio.parent.token)).status, 200);
  });

  test('cannot create a record for a child', async () => {
    assertRefused(
      await records.create(trio.parent.token, progress(trio.a.id)),
      'parent creates for A',
    );
  });

  test('cannot update a record of a child', async () => {
    assertRefused(
      await records.update(recordA.id, trio.parent.token, { status: 'completed' }),
      'parent updates A',
    );
    assert.equal((await records.actual(recordA.id)).body.status, 'started');
  });

  test('can delete a record of a child', async () => {
    const own = await records.make(trio.a.token, progress(trio.a.id));
    const response = await records.remove(own.id, trio.parent.token);
    assert.equal(response.status, 204);
    assert.equal((await records.actual(own.id)).status, 404);
  });

  test('can create and update its own record', async () => {
    const own = await records.make(trio.parent.token, progress(trio.parent.id));
    const response = await records.update(own.id, trio.parent.token, { status: 'completed' });
    assert.equal(response.status, 200, JSON.stringify(response.body));
  });
});

describe('cascade', () => {
  test("deleting child A removes its progress and keeps B's", async () => {
    const trio = await createTrio(pb, su);
    const recordA = await records.make(trio.a.token, progress(trio.a.id));
    const recordB = await records.make(trio.b.token, progress(trio.b.id));
    await deleteAccount(pb, su, trio.a.id);
    assert.equal((await records.actual(recordA.id)).status, 404);
    assert.equal((await records.actual(recordB.id)).status, 200);
  });
});
