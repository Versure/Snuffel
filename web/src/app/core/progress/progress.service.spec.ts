import { TestBed } from '@angular/core/testing';
import PocketBase, { ClientResponseError } from 'pocketbase';
import { PocketBaseService } from '../pocketbase/pocketbase.service';
import type {
  ChecklistStateRecord,
  InteractionResultRecord,
  LessonProgressRecord,
  QuizAttemptRecord,
} from '../pocketbase/types';
import { ProgressError } from './progress-error';
import { ProgressService } from './progress.service';

interface FakeCollection {
  getFullList: ReturnType<typeof vi.fn>;
  getFirstListItem: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
}

function fakeCollection(): FakeCollection {
  return {
    getFullList: vi.fn(async () => []),
    getFirstListItem: vi.fn(),
    create: vi.fn(async (body: Record<string, unknown>) => ({ id: 'new', ...body })),
    update: vi.fn(async (id: string, body: Record<string, unknown>) => ({ id, ...body })),
  };
}

const base = { user: 'kind-a', created: '', updated: '' };

function step(stepId: string, status: 'started' | 'completed'): LessonProgressRecord {
  return {
    ...base,
    id: `p-${stepId}`,
    course_id: 'proefcursus',
    lesson_id: 'proefles',
    step_id: stepId,
    status,
    content_version: 1,
  };
}

function attempt(id: string, created: string): QuizAttemptRecord {
  return {
    ...base,
    id,
    created,
    lesson_id: 'proefles',
    question_id: 'vraag',
    option_id: 'a',
    correct: true,
    hints_used: 0,
    content_version: 1,
  };
}

function result(id: string, created: string): InteractionResultRecord {
  return {
    ...base,
    id,
    created,
    lesson_id: 'proefles',
    interaction_id: 'voel-spel',
    kind: 'trace-game',
    score: 6,
    total: 8,
    detail: { rounds: [] },
    content_version: 1,
  };
}

const error = (status: number) => new ClientResponseError({ status });

describe('ProgressService', () => {
  let client: PocketBase;
  let collections: Record<string, FakeCollection>;
  let service: ProgressService;

  beforeEach(() => {
    client = new PocketBase('/');
    collections = {
      lesson_progress: fakeCollection(),
      quiz_attempts: fakeCollection(),
      checklist_states: fakeCollection(),
      interaction_results: fakeCollection(),
    };
    vi.spyOn(client, 'collection').mockImplementation(
      (name: string) => collections[name] as unknown as ReturnType<PocketBase['collection']>,
    );
    TestBed.configureTestingModule({
      providers: [{ provide: PocketBaseService, useValue: { client } }],
    });
    service = TestBed.inject(ProgressService);
  });

  it('loadLesson asks the four collections with filter parameters and maps the records', async () => {
    const checklist: ChecklistStateRecord = {
      ...base,
      id: 'c1',
      lesson_id: 'proefles',
      checklist_id: 'zelf-doen',
      checked: ['vispas'],
    };
    collections['lesson_progress'].getFullList.mockResolvedValue([
      step('uitleg', 'completed'),
      step('quiz', 'started'),
    ]);
    collections['checklist_states'].getFullList.mockResolvedValue([
      checklist,
      { ...checklist, id: 'c2', checklist_id: 'leeg', checked: null },
    ]);
    collections['quiz_attempts'].getFullList.mockResolvedValue([attempt('q1', '2026-01-01')]);
    collections['interaction_results'].getFullList.mockResolvedValue([result('r1', '2026-01-01')]);

    const snapshot = await service.loadLesson('kind"a', 'proef"les');

    const expectedFilter = client.filter('lesson_id = {:lessonId} && user = {:userId}', {
      lessonId: 'proef"les',
      userId: 'kind"a',
    });
    // Quotes are escaped by pb.filter, never pasted into the filter.
    expect(expectedFilter).toContain('\\"');
    for (const name of [
      'lesson_progress',
      'checklist_states',
      'quiz_attempts',
      'interaction_results',
    ]) {
      expect(collections[name].getFullList).toHaveBeenCalledWith(
        expect.objectContaining({ filter: expectedFilter, requestKey: null }),
      );
    }
    for (const name of ['quiz_attempts', 'interaction_results']) {
      expect(collections[name].getFullList).toHaveBeenCalledWith(
        expect.objectContaining({ sort: '-created' }),
      );
    }
    expect([...snapshot.steps]).toEqual([
      ['uitleg', { id: 'p-uitleg', status: 'completed' }],
      ['quiz', { id: 'p-quiz', status: 'started' }],
    ]);
    expect([...snapshot.checklists]).toEqual([
      ['zelf-doen', { id: 'c1', checked: ['vispas'] }],
      ['leeg', { id: 'c2', checked: [] }],
    ]);
    expect(snapshot.attempts.map((item) => item.id)).toEqual(['q1']);
    expect(snapshot.results.map((item) => item.id)).toEqual(['r1']);
  });

  it('loadStepStatuses filters on the user with parameters', async () => {
    await service.loadStepStatuses('kind"a');
    const expectedFilter = client.filter('user = {:userId}', { userId: 'kind"a' });
    expect(expectedFilter).toContain('\\"');
    expect(collections['lesson_progress'].getFullList).toHaveBeenCalledWith(
      expect.objectContaining({ filter: expectedFilter, requestKey: null }),
    );
  });

  it('loadStepStatuses also filters on the course when given', async () => {
    await service.loadStepStatuses('kind-a', 'proef"cursus');
    const expectedFilter = client.filter('user = {:userId} && course_id = {:courseId}', {
      userId: 'kind-a',
      courseId: 'proef"cursus',
    });
    expect(expectedFilter).toContain('\\"');
    expect(collections['lesson_progress'].getFullList).toHaveBeenCalledWith(
      expect.objectContaining({ filter: expectedFilter, requestKey: null }),
    );
  });

  it('loadStepStatuses asks only lesson_id, step_id and status', async () => {
    await service.loadStepStatuses('kind-a');
    expect(collections['lesson_progress'].getFullList).toHaveBeenCalledWith(
      expect.objectContaining({ fields: 'lesson_id,step_id,status' }),
    );
    for (const name of ['quiz_attempts', 'checklist_states', 'interaction_results']) {
      expect(collections[name].getFullList).not.toHaveBeenCalled();
    }
  });

  it('loadStepStatuses groups the statuses by lesson and step', async () => {
    collections['lesson_progress'].getFullList.mockResolvedValue([
      { lesson_id: 'proefles', step_id: 'uitleg', status: 'completed' },
      { lesson_id: 'proefles', step_id: 'quiz', status: 'started' },
      { lesson_id: 'proefles-breuken', step_id: 'oefenen', status: 'started' },
    ]);
    const statuses = await service.loadStepStatuses('kind-a');
    expect([...statuses.keys()]).toEqual(['proefles', 'proefles-breuken']);
    expect([...(statuses.get('proefles') ?? [])]).toEqual([
      ['uitleg', 'completed'],
      ['quiz', 'started'],
    ]);
    expect([...(statuses.get('proefles-breuken') ?? [])]).toEqual([['oefenen', 'started']]);
  });

  it('a network error while loading step statuses becomes ProgressError unavailable', async () => {
    collections['lesson_progress'].getFullList.mockRejectedValue(error(0));
    const load = service.loadStepStatuses('kind-a');
    await expect(load).rejects.toBeInstanceOf(ProgressError);
    await expect(load).rejects.toMatchObject({ reason: 'unavailable' });
  });

  it('loadLesson also loads the interaction results newest first', async () => {
    collections['interaction_results'].getFullList.mockResolvedValue([
      result('oud', '2026-01-01 10:00:00.000Z'),
      result('nieuwst', '2026-01-03 10:00:00.000Z'),
      result('midden', '2026-01-02 10:00:00.000Z'),
    ]);
    const snapshot = await service.loadLesson('kind-a', 'proefles');
    expect(collections['interaction_results'].getFullList).toHaveBeenCalledWith(
      expect.objectContaining({ sort: '-created', requestKey: null }),
    );
    expect(snapshot.results.map((item) => item.id)).toEqual(['nieuwst', 'midden', 'oud']);
  });

  it('saveInteractionResult always creates a new record with score, total, detail and content_version', async () => {
    const results = collections['interaction_results'];
    const detail = { rounds: [{ pattern: 'tik', choice: 'vis', correct: true }] };
    await service.saveInteractionResult(
      'kind-a',
      'proefles',
      'voel-spel',
      'trace-game',
      { score: 1, total: 1, detail },
      3,
    );
    await service.saveInteractionResult(
      'kind-a',
      'proefles',
      'voel-spel',
      'trace-game',
      { score: 0, total: 1, detail },
      3,
    );
    expect(results.create).toHaveBeenCalledTimes(2);
    expect(results.create).toHaveBeenNthCalledWith(
      1,
      {
        user: 'kind-a',
        lesson_id: 'proefles',
        interaction_id: 'voel-spel',
        kind: 'trace-game',
        score: 1,
        total: 1,
        detail,
        content_version: 3,
      },
      { requestKey: null },
    );
    expect(results.create.mock.calls[1][0]).toMatchObject({ score: 0 });
    expect(results.update).not.toHaveBeenCalled();
  });

  it('a failed save becomes ProgressError', async () => {
    collections['interaction_results'].create.mockRejectedValue(error(0));
    await expect(
      service.saveInteractionResult(
        'kind-a',
        'proefles',
        'voel-spel',
        'trace-game',
        { score: 1, total: 1, detail: {} },
        1,
      ),
    ).rejects.toMatchObject({ name: 'ProgressError', reason: 'unavailable' });
    collections['interaction_results'].create.mockRejectedValue(error(403));
    await expect(
      service.saveInteractionResult(
        'kind-a',
        'proefles',
        'voel-spel',
        'trace-game',
        { score: 1, total: 1, detail: {} },
        1,
      ),
    ).rejects.toBeInstanceOf(ProgressError);
  });

  it('loadLesson sorts attempts newest first', async () => {
    collections['quiz_attempts'].getFullList.mockResolvedValue([
      attempt('oud', '2026-01-01 10:00:00.000Z'),
      attempt('nieuwst', '2026-01-03 10:00:00.000Z'),
      attempt('midden', '2026-01-02 10:00:00.000Z'),
    ]);
    const snapshot = await service.loadLesson('kind-a', 'proefles');
    expect(snapshot.attempts.map((item) => item.id)).toEqual(['nieuwst', 'midden', 'oud']);
  });

  it('setStepStatus creates a record the first time and updates it after', async () => {
    const lessonProgress = collections['lesson_progress'];
    const created = await service.setStepStatus(
      'kind-a',
      'proefcursus',
      'proefles',
      'quiz',
      'started',
      3,
    );
    expect(lessonProgress.create).toHaveBeenCalledWith(
      {
        user: 'kind-a',
        course_id: 'proefcursus',
        lesson_id: 'proefles',
        step_id: 'quiz',
        status: 'started',
        content_version: 3,
      },
      { requestKey: null },
    );
    expect(created).toEqual({ id: 'new', status: 'started' });

    const updated = await service.setStepStatus(
      'kind-a',
      'proefcursus',
      'proefles',
      'quiz',
      'completed',
      3,
      created,
    );
    expect(lessonProgress.update).toHaveBeenCalledWith(
      'new',
      { status: 'completed', content_version: 3 },
      { requestKey: null },
    );
    expect(updated).toEqual({ id: 'new', status: 'completed' });
    expect(lessonProgress.create).toHaveBeenCalledTimes(1);
  });

  it('an update never sends user, course_id, lesson_id or step_id', async () => {
    await service.setStepStatus('kind-a', 'proefcursus', 'proefles', 'quiz', 'completed', 1, {
      id: 'p1',
      status: 'started',
    });
    await service.saveChecklist('kind-a', 'proefles', 'zelf-doen', ['vispas'], 'c1');
    const sent = [
      ...collections['lesson_progress'].update.mock.calls,
      ...collections['checklist_states'].update.mock.calls,
    ].map((call) => Object.keys(call[1] as object));
    expect(sent).toEqual([['status', 'content_version'], ['checked']]);
  });

  it('setStepStatus never turns completed back into started', async () => {
    const result = await service.setStepStatus(
      'kind-a',
      'proefcursus',
      'proefles',
      'zelf-doen',
      'started',
      1,
      { id: 'p1', status: 'completed' },
    );
    expect(result).toEqual({ id: 'p1', status: 'completed' });
    expect(collections['lesson_progress'].update).not.toHaveBeenCalled();

    // Also not when the record turns out to exist already.
    collections['lesson_progress'].create.mockRejectedValue(error(400));
    collections['lesson_progress'].getFirstListItem.mockResolvedValue(
      step('zelf-doen', 'completed'),
    );
    const found = await service.setStepStatus(
      'kind-a',
      'proefcursus',
      'proefles',
      'zelf-doen',
      'started',
      1,
    );
    expect(found).toEqual({ id: 'p-zelf-doen', status: 'completed' });
    expect(collections['lesson_progress'].update).not.toHaveBeenCalled();
  });

  it('setStepStatus falls back to an update when the record already exists', async () => {
    const lessonProgress = collections['lesson_progress'];
    lessonProgress.create.mockRejectedValue(error(400));
    lessonProgress.getFirstListItem.mockResolvedValue(step('quiz', 'started'));
    const result = await service.setStepStatus(
      'kind-a',
      'proefcursus',
      'proefles',
      'quiz',
      'completed',
      2,
    );
    expect(lessonProgress.getFirstListItem).toHaveBeenCalledWith(
      client.filter('user = {:userId} && lesson_id = {:lessonId} && step_id = {:stepId}', {
        userId: 'kind-a',
        lessonId: 'proefles',
        stepId: 'quiz',
      }),
      { requestKey: null },
    );
    expect(lessonProgress.update).toHaveBeenCalledWith(
      'p-quiz',
      { status: 'completed', content_version: 2 },
      { requestKey: null },
    );
    expect(result).toEqual({ id: 'p-quiz', status: 'completed' });
  });

  it('saveChecklist sends the whole list in item order', async () => {
    const checklists = collections['checklist_states'];
    const created = await service.saveChecklist('kind-a', 'proefles', 'zelf-doen', [
      'vispas',
      'bodem-voelen',
    ]);
    expect(checklists.create).toHaveBeenCalledWith(
      {
        user: 'kind-a',
        lesson_id: 'proefles',
        checklist_id: 'zelf-doen',
        checked: ['vispas', 'bodem-voelen'],
      },
      { requestKey: null },
    );
    expect(created).toEqual({ id: 'new', checked: ['vispas', 'bodem-voelen'] });

    await service.saveChecklist('kind-a', 'proefles', 'zelf-doen', [], 'new');
    expect(checklists.update).toHaveBeenCalledWith('new', { checked: [] }, { requestKey: null });

    // The record already exists: look it up and update only `checked`.
    checklists.create.mockRejectedValue(error(400));
    checklists.getFirstListItem.mockResolvedValue({ id: 'c9' });
    const fallback = await service.saveChecklist('kind-a', 'proefles', 'zelf-doen', ['vispas']);
    expect(checklists.update).toHaveBeenLastCalledWith(
      'c9',
      { checked: ['vispas'] },
      { requestKey: null },
    );
    expect(fallback).toEqual({ id: 'c9', checked: ['vispas'] });
  });

  it('recordAnswer always creates a new attempt with hints_used and content_version', async () => {
    const attempts = collections['quiz_attempts'];
    await service.recordAnswer('kind-a', 'proefles', 'vraag', 'a', false, 2, 4);
    await service.recordAnswer('kind-a', 'proefles', 'vraag', 'b', true, 0, 4);
    expect(attempts.create).toHaveBeenCalledTimes(2);
    expect(attempts.create).toHaveBeenNthCalledWith(
      1,
      {
        user: 'kind-a',
        lesson_id: 'proefles',
        question_id: 'vraag',
        option_id: 'a',
        correct: false,
        hints_used: 2,
        content_version: 4,
      },
      { requestKey: null },
    );
    expect(attempts.update).not.toHaveBeenCalled();
  });

  it('a network error becomes ProgressError unavailable, a 403 refused', async () => {
    collections['lesson_progress'].getFullList.mockRejectedValue(error(0));
    const load = service.loadLesson('kind-a', 'proefles');
    await expect(load).rejects.toBeInstanceOf(ProgressError);
    await expect(load).rejects.toMatchObject({ reason: 'unavailable' });

    collections['quiz_attempts'].create.mockRejectedValue(error(403));
    await expect(
      service.recordAnswer('kind-a', 'proefles', 'vraag', 'a', true, 0, 1),
    ).rejects.toMatchObject({ name: 'ProgressError', reason: 'refused' });

    collections['checklist_states'].update.mockRejectedValue(error(503));
    await expect(
      service.saveChecklist('kind-a', 'proefles', 'zelf-doen', [], 'c1'),
    ).rejects.toMatchObject({ reason: 'unavailable' });

    // A 400 whose record cannot be found is refused, not retried forever.
    collections['lesson_progress'].create.mockRejectedValue(error(400));
    collections['lesson_progress'].getFirstListItem.mockRejectedValue(error(404));
    await expect(
      service.setStepStatus('kind-a', 'proefcursus', 'proefles', 'quiz', 'started', 1),
    ).rejects.toMatchObject({ reason: 'refused' });
  });
});
