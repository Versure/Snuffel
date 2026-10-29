import { TestBed } from '@angular/core/testing';
import PocketBase, { ClientResponseError } from 'pocketbase';
import type { ManifestCourse } from '../content/content.types';
import { PocketBaseService } from '../pocketbase/pocketbase.service';
import type { CourseAssignmentRecord, UserRecord } from '../pocketbase/types';
import { ProgressError } from '../progress/progress-error';
import { CourseAccessService } from './course-access.service';

const manifestCourse = (id: string, access: ManifestCourse['access']): ManifestCourse => ({
  id,
  title: id,
  kind: 'course',
  access,
  file: `${id}/course.json`,
  hash: '0123456789abcdef',
  lessons: [],
  assets: [],
});

const blindTypen = manifestCourse('blind-typen', 'all-children');
const roofvissen = manifestCourse('roofvissen', 'selected-children');

const kindA: UserRecord = { id: 'a1', username: 'kind-a', name: 'Kind A', role: 'child' };
const ouder: UserRecord = { id: 'p1', username: 'ouder', name: 'Ouder', role: 'parent' };

const assignment = (id: string, user: string, courseId: string): CourseAssignmentRecord => ({
  id,
  user,
  course_id: courseId,
  created: '2026-10-29 08:00:00.000Z',
  updated: '2026-10-29 08:00:00.000Z',
});

describe('CourseAccessService', () => {
  let client: PocketBase;
  let records: {
    getFullList: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let service: CourseAccessService;

  beforeEach(() => {
    client = new PocketBase('/');
    records = {
      getFullList: vi.fn(async () => []),
      create: vi.fn(async () => assignment('n1', 'a1', 'roofvissen')),
      delete: vi.fn(async () => true),
    };
    vi.spyOn(client, 'collection').mockImplementation((name: string) => {
      expect(name).toBe('course_assignments');
      return records as unknown as ReturnType<PocketBase['collection']>;
    });
    TestBed.configureTestingModule({
      providers: [{ provide: PocketBaseService, useValue: { client } }],
    });
    service = TestBed.inject(CourseAccessService);
  });

  it('loadAssignedCourseIds filters on the user with a parameter and asks only course_id', async () => {
    records.getFullList.mockResolvedValue([{ course_id: 'roofvissen' }, { course_id: 'nieuw' }]);
    const ids = await service.loadAssignedCourseIds('a1" || user != "');
    expect([...ids]).toEqual(['roofvissen', 'nieuw']);
    expect(records.getFullList).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: client.filter('user = {:userId}', { userId: 'a1" || user != "' }),
        fields: 'course_id',
      }),
    );
    const [options] = records.getFullList.mock.calls[0] as [{ filter: string }];
    // The quotes in the id are escaped, so the id cannot widen the filter.
    expect(options.filter).toBe('user = "a1\\" || user != \\""');
  });

  it('loadAssignments loads every assignment', async () => {
    const all = [assignment('x1', 'a1', 'roofvissen'), assignment('x2', 'b1', 'roofvissen')];
    records.getFullList.mockResolvedValue(all);
    await expect(service.loadAssignments()).resolves.toEqual(all);
    const [options] = records.getFullList.mock.calls[0] as [{ filter?: string }];
    expect(options.filter).toBeUndefined();
  });

  it('assign sends the user and the course id', async () => {
    await expect(service.assign('a1', 'roofvissen')).resolves.toEqual(
      assignment('n1', 'a1', 'roofvissen'),
    );
    expect(records.create).toHaveBeenCalledWith(
      { user: 'a1', course_id: 'roofvissen' },
      expect.anything(),
    );
  });

  it('unassign deletes the assignment by id', async () => {
    await service.unassign('x1');
    expect(records.delete).toHaveBeenCalledWith('x1', expect.anything());
  });

  it('canOpen sends no request for the parent or an all-children course', async () => {
    await expect(service.canOpen(roofvissen, ouder)).resolves.toBe(true);
    await expect(service.canOpen(blindTypen, ouder)).resolves.toBe(true);
    await expect(service.canOpen(blindTypen, kindA)).resolves.toBe(true);
    expect(records.getFullList).not.toHaveBeenCalled();
  });

  it('canOpen loads the assignments of the child for a selected-children course', async () => {
    await expect(service.canOpen(roofvissen, kindA)).resolves.toBe(false);
    records.getFullList.mockResolvedValue([{ course_id: 'roofvissen' }]);
    await expect(service.canOpen(roofvissen, kindA)).resolves.toBe(true);
    expect(records.getFullList).toHaveBeenCalledWith(
      expect.objectContaining({ filter: client.filter('user = {:userId}', { userId: 'a1' }) }),
    );
  });

  it('a failure becomes a ProgressError', async () => {
    records.getFullList.mockRejectedValue(new ClientResponseError({ status: 0 }));
    records.create.mockRejectedValue(new ClientResponseError({ status: 400 }));
    records.delete.mockRejectedValue(new ClientResponseError({ status: 503 }));
    const results = await Promise.all([
      service.loadAssignedCourseIds('a1').catch((error: unknown) => error),
      service.loadAssignments().catch((error: unknown) => error),
      service.canOpen(roofvissen, kindA).catch((error: unknown) => error),
      service.assign('a1', 'roofvissen').catch((error: unknown) => error),
      service.unassign('x1').catch((error: unknown) => error),
    ]);
    for (const error of results) expect(error).toBeInstanceOf(ProgressError);
    expect(results.map((error) => (error as ProgressError).reason)).toEqual([
      'unavailable',
      'unavailable',
      'unavailable',
      'refused',
      'unavailable',
    ]);
  });
});
