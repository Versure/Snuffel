// Access rules and schema of `course_assignments` (migration *_create_course_assignments.js),
// proven with child A, child B and a parent against a real PocketBase. Only the parent assigns,
// and only to a child (the create rule follows the relation in the body: `@request.body.user.role`).
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { startPocketBase, testSuperuser } from '../../tools/pocketbase-harness.mjs';
import { asSuperuser } from './helpers.ts';
import {
  asRecord,
  assertRefused,
  createAccount,
  createTrio,
  deleteAccount,
  type Body,
  type StoredRecord,
  type Trio,
} from './progress-helpers.ts';

interface AssignmentRecord extends StoredRecord {
  course_id: string;
}

let pb: Awaited<ReturnType<typeof startPocketBase>>;
let su: string;
let records: ReturnType<typeof asRecord<AssignmentRecord>>;
let courseCounter = 0;
let parentCounter = 0;

before(async () => {
  pb = await startPocketBase();
  su = await asSuperuser(pb.url, testSuperuser);
  records = asRecord<AssignmentRecord>(pb, su, 'course_assignments');
});

after(async () => {
  await pb?.stop();
});

/** A course id that no other test uses. */
function nextCourse(): string {
  courseCounter += 1;
  return `cursus-${courseCounter}`;
}

/** A valid body for `user` with a course id that no other test uses. */
function assignment(user: string, fields: Body = {}): Body {
  return { user, course_id: nextCourse(), ...fields };
}

describe('without login', () => {
  let trio: Trio;
  let recordA: AssignmentRecord;
  before(async () => {
    trio = await createTrio(pb, su);
    recordA = await records.make(trio.parent.token, assignment(trio.a.id));
  });

  test('list gives no items', async () => {
    const response = await records.list(undefined);
    assert.equal(response.status, 200);
    assert.equal(response.body.totalItems, 0);
  });

  test('create is refused', async () => {
    assertRefused(await records.create(undefined, assignment(trio.a.id)), 'create for A');
  });

  test('view of an assignment of A gives 404', async () => {
    assert.equal((await records.view(recordA.id, undefined)).status, 404);
  });

  test('update and delete are refused', async () => {
    assertRefused(await records.update(recordA.id, undefined, { course_id: 'anders' }), 'update');
    assertRefused(await records.remove(recordA.id, undefined), 'delete');
    assert.equal((await records.actual(recordA.id)).body.course_id, recordA.course_id);
  });
});

describe('child A', () => {
  let trio: Trio;
  let recordA: AssignmentRecord;
  let recordB: AssignmentRecord;
  before(async () => {
    trio = await createTrio(pb, su);
    recordA = await records.make(trio.parent.token, assignment(trio.a.id));
    recordB = await records.make(trio.parent.token, assignment(trio.b.id));
  });

  test('lists and views only its own assignments', async () => {
    const list = await records.list(trio.a.token);
    const ids = list.body.items.map((item) => item.id);
    assert.deepEqual(ids, [recordA.id]);
    assert.equal((await records.view(recordA.id, trio.a.token)).status, 200);
    assert.equal((await records.view(recordB.id, trio.a.token)).status, 404);
    assert.equal((await records.list(trio.a.token, `user="${trio.b.id}"`)).body.totalItems, 0);
  });

  test('cannot assign a course to itself or to child B', async () => {
    const own = assignment(trio.a.id);
    assertRefused(await records.create(trio.a.token, own), 'A assigns A');
    const forB = assignment(trio.b.id);
    assertRefused(await records.create(trio.a.token, forB), 'A assigns B');
    for (const body of [own, forB]) {
      const filter = `course_id="${String(body['course_id'])}"`;
      assert.equal((await records.list(su, filter)).body.totalItems, 0);
    }
  });

  test('cannot change or delete its own assignment', async () => {
    assertRefused(
      await records.update(recordA.id, trio.a.token, { course_id: 'iets-anders' }),
      'update course_id',
    );
    assertRefused(await records.update(recordA.id, trio.a.token, { user: trio.b.id }), 'user = B');
    assertRefused(await records.remove(recordA.id, trio.a.token), 'delete own');
    const actual = await records.actual(recordA.id);
    assert.equal(actual.status, 200);
    assert.equal(actual.body.course_id, recordA.course_id);
    assert.equal(actual.body.user, trio.a.id);
  });

  test('cannot delete an assignment of child B', async () => {
    assertRefused(await records.remove(recordB.id, trio.a.token), 'delete B');
    assert.equal((await records.actual(recordB.id)).status, 200);
  });
});

describe('parent', () => {
  let trio: Trio;
  let recordB: AssignmentRecord;
  before(async () => {
    trio = await createTrio(pb, su);
    recordB = await records.make(trio.parent.token, assignment(trio.b.id));
  });

  test('assigns a course to child A and sees every assignment', async () => {
    const response = await records.create(trio.parent.token, assignment(trio.a.id));
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(response.body.user, trio.a.id);
    const ids = (await records.list(trio.parent.token)).body.items.map((item) => item.id);
    assert.ok(ids.includes(response.body.id) && ids.includes(recordB.id));
    assert.equal((await records.view(recordB.id, trio.parent.token)).status, 200);
  });

  test('cannot assign a course to itself', async () => {
    const body = assignment(trio.parent.id);
    assertRefused(await records.create(trio.parent.token, body), 'assign to the parent');
    const filter = `course_id="${String(body['course_id'])}"`;
    assert.equal((await records.list(su, filter)).body.totalItems, 0);
  });

  test('cannot assign a course to a second parent', async () => {
    parentCounter += 1;
    const second = await createAccount(pb, su, `ouder-twee-${parentCounter}`, 'parent');
    const body = assignment(second.id);
    assertRefused(await records.create(trio.parent.token, body), 'assign to a second parent');
    const filter = `course_id="${String(body['course_id'])}"`;
    assert.equal((await records.list(su, filter)).body.totalItems, 0);
  });

  test('cannot assign without user or to an unknown id', async () => {
    const without = assignment(trio.a.id);
    delete without['user'];
    assertRefused(await records.create(trio.parent.token, without), 'without user');
    assertRefused(
      await records.create(trio.parent.token, assignment('bestaatniet1234')),
      'unknown user',
    );
    assertRefused(await records.create(trio.parent.token, assignment('')), 'empty user');
  });

  test('cannot change an assignment, also not user or course_id', async () => {
    const own = await records.make(trio.parent.token, assignment(trio.a.id));
    for (const body of [{ user: trio.b.id }, { course_id: 'iets-anders' }, {}]) {
      assertRefused(await records.update(own.id, trio.parent.token, body), JSON.stringify(body));
    }
    const actual = await records.actual(own.id);
    assert.equal(actual.body.user, trio.a.id);
    assert.equal(actual.body.course_id, own.course_id);
  });

  test('can delete an assignment', async () => {
    const own = await records.make(trio.parent.token, assignment(trio.a.id));
    assert.equal((await records.remove(own.id, trio.parent.token)).status, 204);
    assert.equal((await records.actual(own.id)).status, 404);
  });
});

describe('unique', () => {
  let trio: Trio;
  before(async () => {
    trio = await createTrio(pb, su);
  });

  test('a second assignment of the same course to A is refused', async () => {
    const body = assignment(trio.a.id);
    await records.make(trio.parent.token, body);
    assertRefused(await records.create(trio.parent.token, body), 'second assignment');
    const filter = `user="${trio.a.id}" && course_id="${String(body['course_id'])}"`;
    assert.equal((await records.list(su, filter)).body.totalItems, 1);
  });

  test('the same course for child B is fine', async () => {
    const body = assignment(trio.a.id);
    await records.make(trio.parent.token, body);
    const response = await records.create(trio.parent.token, { ...body, user: trio.b.id });
    assert.equal(response.status, 200, JSON.stringify(response.body));
  });
});

describe('schema', () => {
  let trio: Trio;
  before(async () => {
    trio = await createTrio(pb, su);
  });

  test('an invalid course_id is refused', async () => {
    for (const id of ['Roof_vissen', '', 'a'.repeat(61)]) {
      assertRefused(
        await records.create(trio.parent.token, { user: trio.a.id, course_id: id }),
        `course_id "${id}"`,
      );
    }
    assert.equal((await records.list(su, `user="${trio.a.id}"`)).body.totalItems, 0);
  });

  test('a course_id of 60 characters is fine', async () => {
    const response = await records.create(trio.parent.token, {
      user: trio.a.id,
      course_id: 'a'.repeat(60),
    });
    assert.equal(response.status, 200, JSON.stringify(response.body));
  });

  test('created and updated are set', async () => {
    const own = await records.make(trio.parent.token, assignment(trio.a.id));
    assert.match(own.created, /^\d{4}-\d{2}-\d{2} /);
    assert.match(own.updated, /^\d{4}-\d{2}-\d{2} /);
  });
});

describe('cascade', () => {
  test("deleting child A removes its assignments and keeps B's", async () => {
    const trio = await createTrio(pb, su);
    const recordA = await records.make(trio.parent.token, assignment(trio.a.id));
    const recordB = await records.make(trio.parent.token, assignment(trio.b.id));
    await deleteAccount(pb, su, trio.a.id);
    assert.equal((await records.actual(recordA.id)).status, 404);
    assert.equal((await records.actual(recordB.id)).status, 200);
  });
});
