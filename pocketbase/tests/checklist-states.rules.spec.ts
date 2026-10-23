// Access rules and schema of `checklist_states` (migration *_create_checklist_states.js),
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

interface ChecklistRecord extends StoredRecord {
  lesson_id: string;
  checklist_id: string;
  checked: string[] | null;
}

let pb: Awaited<ReturnType<typeof startPocketBase>>;
let su: string;
let records: ReturnType<typeof asRecord<ChecklistRecord>>;
let checklistCounter = 0;

before(async () => {
  pb = await startPocketBase();
  su = await asSuperuser(pb.url, testSuperuser);
  records = asRecord<ChecklistRecord>(pb, su, 'checklist_states');
});

after(async () => {
  await pb?.stop();
});

/** A valid body for `user` with a checklist id that no other test uses. */
function checklist(user: string, fields: Body = {}): Body {
  checklistCounter += 1;
  return {
    user,
    lesson_id: 'proefles',
    checklist_id: `lijst-${checklistCounter}`,
    checked: ['vispas'],
    ...fields,
  };
}

describe('without login', () => {
  let trio: Trio;
  let recordA: ChecklistRecord;
  before(async () => {
    trio = await createTrio(pb, su);
    recordA = await records.make(trio.a.token, checklist(trio.a.id));
  });

  test('list gives no items', async () => {
    const response = await records.list(undefined);
    assert.equal(response.status, 200);
    assert.equal(response.body.totalItems, 0);
  });

  test('create is refused, also with user = A', async () => {
    assertRefused(await records.create(undefined, checklist('')), 'create without user');
    assertRefused(await records.create(undefined, checklist(trio.a.id)), 'create for A');
  });

  test('view of a record of A gives 404', async () => {
    assert.equal((await records.view(recordA.id, undefined)).status, 404);
  });

  test('update and delete are refused', async () => {
    assertRefused(await records.update(recordA.id, undefined, { checked: [] }), 'update');
    assertRefused(await records.remove(recordA.id, undefined), 'delete');
    assert.deepEqual((await records.actual(recordA.id)).body.checked, ['vispas']);
  });
});

describe('child A', () => {
  let trio: Trio;
  let recordB: ChecklistRecord;
  before(async () => {
    trio = await createTrio(pb, su);
    recordB = await records.make(trio.b.token, checklist(trio.b.id));
  });

  test('creates its own checklist', async () => {
    const response = await records.create(trio.a.token, checklist(trio.a.id));
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(response.body.user, trio.a.id);
    assert.deepEqual(response.body.checked, ['vispas']);
  });

  test('cannot create a record for child B', async () => {
    assertRefused(await records.create(trio.a.token, checklist(trio.b.id)), 'create for B');
    assert.equal((await records.list(su, `user="${trio.b.id}"`)).body.totalItems, 1);
  });

  test('cannot create a record without user', async () => {
    const body = checklist(trio.a.id);
    delete body['user'];
    assertRefused(await records.create(trio.a.token, body), 'create without user');
  });

  test('lists and views only its own records', async () => {
    const own = await records.make(trio.a.token, checklist(trio.a.id));
    const list = await records.list(trio.a.token);
    const ids = list.body.items.map((item) => item.id);
    assert.ok(ids.includes(own.id));
    assert.ok(!ids.includes(recordB.id));
    assert.ok(list.body.items.every((item) => item.user === trio.a.id));
    assert.equal((await records.view(own.id, trio.a.token)).status, 200);
    assert.equal((await records.view(recordB.id, trio.a.token)).status, 404);
    assert.equal((await records.list(trio.a.token, `user="${trio.b.id}"`)).body.totalItems, 0);
  });

  test('updates checked of its own checklist', async () => {
    const own = await records.make(trio.a.token, checklist(trio.a.id));
    const response = await records.update(own.id, trio.a.token, {
      checked: ['vispas', 'staal-en-tang'],
    });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.deepEqual(response.body.checked, ['vispas', 'staal-en-tang']);
  });

  test('cannot move its own checklist to child B', async () => {
    const own = await records.make(trio.a.token, checklist(trio.a.id));
    assertRefused(await records.update(own.id, trio.a.token, { user: trio.b.id }), 'user = B');
    assertRefused(await records.update(own.id, trio.a.token, { user: trio.a.id }), 'user = A');
    assert.equal((await records.actual(own.id)).body.user, trio.a.id);
  });

  test('cannot change lesson_id or checklist_id', async () => {
    const own = await records.make(trio.a.token, checklist(trio.a.id));
    for (const field of ['lesson_id', 'checklist_id']) {
      assertRefused(
        await records.update(own.id, trio.a.token, { [field]: 'iets-anders', checked: [] }),
        `update ${field}`,
      );
    }
    const actual = await records.actual(own.id);
    assert.equal(actual.body.lesson_id, own.lesson_id);
    assert.equal(actual.body.checklist_id, own.checklist_id);
    assert.deepEqual(actual.body.checked, ['vispas']);
  });

  test('cannot update or delete a record of child B', async () => {
    assertRefused(await records.update(recordB.id, trio.a.token, { checked: [] }), 'update B');
    assertRefused(await records.remove(recordB.id, trio.a.token), 'delete B');
    const actual = await records.actual(recordB.id);
    assert.equal(actual.status, 200);
    assert.deepEqual(actual.body.checked, ['vispas']);
  });

  test('cannot delete its own record', async () => {
    const own = await records.make(trio.a.token, checklist(trio.a.id));
    assertRefused(await records.remove(own.id, trio.a.token), 'delete own');
    assert.equal((await records.actual(own.id)).status, 200);
  });
});

describe('unique', () => {
  let trio: Trio;
  before(async () => {
    trio = await createTrio(pb, su);
  });

  test('a second record for the same user, lesson and checklist is refused', async () => {
    const body = checklist(trio.a.id);
    await records.make(trio.a.token, body);
    assertRefused(await records.create(trio.a.token, { ...body, checked: [] }), 'second record');
    const filter = `user="${trio.a.id}" && checklist_id="${body['checklist_id']}"`;
    assert.equal((await records.list(su, filter)).body.totalItems, 1);
  });

  test('the same lesson and checklist for child B is fine', async () => {
    const body = checklist(trio.a.id);
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

  test('checked larger than 2 kB is refused', async () => {
    const big = Array.from({ length: 100 }, (_, index) => `item-nummer-${index}-met-lange-naam`);
    assert.ok(JSON.stringify(big).length > 2000);
    assertRefused(
      await records.create(trio.a.token, checklist(trio.a.id, { checked: big })),
      'checked > 2 kB',
    );
    const own = await records.make(trio.a.token, checklist(trio.a.id));
    assertRefused(await records.update(own.id, trio.a.token, { checked: big }), 'update > 2 kB');
  });

  test('an empty list is fine', async () => {
    const response = await records.create(trio.a.token, checklist(trio.a.id, { checked: [] }));
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.deepEqual(response.body.checked, []);
  });

  test('an invalid id is refused', async () => {
    for (const id of ['Lijst_1', '', 'a'.repeat(61)]) {
      for (const field of ['lesson_id', 'checklist_id']) {
        assertRefused(
          await records.create(trio.a.token, checklist(trio.a.id, { [field]: id })),
          `${field} "${id}"`,
        );
      }
    }
  });

  test('created and updated are set', async () => {
    const own = await records.make(trio.a.token, checklist(trio.a.id));
    assert.match(own.created, /^\d{4}-\d{2}-\d{2} /);
    assert.match(own.updated, /^\d{4}-\d{2}-\d{2} /);
    await new Promise((resolve) => setTimeout(resolve, 20));
    const updated = await records.update(own.id, trio.a.token, { checked: [] });
    assert.equal(updated.body.created, own.created);
    assert.ok(updated.body.updated > own.updated, `${updated.body.updated} > ${own.updated}`);
  });
});

describe('parent', () => {
  let trio: Trio;
  let recordA: ChecklistRecord;
  let recordB: ChecklistRecord;
  before(async () => {
    trio = await createTrio(pb, su);
    recordA = await records.make(trio.a.token, checklist(trio.a.id));
    recordB = await records.make(trio.b.token, checklist(trio.b.id));
  });

  test('lists and views the records of every child', async () => {
    const ids = (await records.list(trio.parent.token)).body.items.map((item) => item.id);
    assert.ok(ids.includes(recordA.id) && ids.includes(recordB.id));
    assert.equal((await records.view(recordA.id, trio.parent.token)).status, 200);
    assert.equal((await records.view(recordB.id, trio.parent.token)).status, 200);
  });

  test('cannot create a record for a child', async () => {
    assertRefused(await records.create(trio.parent.token, checklist(trio.a.id)), 'create for A');
  });

  test('cannot update a record of a child', async () => {
    assertRefused(
      await records.update(recordA.id, trio.parent.token, { checked: [] }),
      'parent updates A',
    );
    assert.deepEqual((await records.actual(recordA.id)).body.checked, ['vispas']);
  });

  test('can delete a record of a child', async () => {
    const own = await records.make(trio.a.token, checklist(trio.a.id));
    assert.equal((await records.remove(own.id, trio.parent.token)).status, 204);
    assert.equal((await records.actual(own.id)).status, 404);
  });

  test('can create and update its own record', async () => {
    const own = await records.make(trio.parent.token, checklist(trio.parent.id));
    const response = await records.update(own.id, trio.parent.token, { checked: [] });
    assert.equal(response.status, 200, JSON.stringify(response.body));
  });
});

describe('cascade', () => {
  test("deleting child A removes its progress and keeps B's", async () => {
    const trio = await createTrio(pb, su);
    const recordA = await records.make(trio.a.token, checklist(trio.a.id));
    const recordB = await records.make(trio.b.token, checklist(trio.b.id));
    await deleteAccount(pb, su, trio.a.id);
    assert.equal((await records.actual(recordA.id)).status, 404);
    assert.equal((await records.actual(recordB.id)).status, 200);
  });
});
