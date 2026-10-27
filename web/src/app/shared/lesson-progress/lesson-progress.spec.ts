import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '../../core/auth/auth.service';
import type { Interaction, Lesson } from '../../core/content/content.types';
import type {
  InteractionResultRecord,
  QuizAttemptRecord,
  UserRecord,
} from '../../core/pocketbase/types';
import { ProgressError } from '../../core/progress/progress-error';
import {
  ProgressService,
  type ChecklistProgress,
  type LessonProgressSnapshot,
  type StepProgress,
} from '../../core/progress/progress.service';
import {
  ANSWER_NOT_SAVED,
  LessonProgress,
  RESULT_NOT_SAVED,
  TICK_NOT_SAVED,
} from './lesson-progress';

const lesson = { id: 'proefles', version: 2 } as Lesson;
const items = ['vispas', 'staal-en-tang', 'bodem-voelen'];
const questions = ['een', 'twee'];
const kindA: UserRecord = { id: 'a1', username: 'kind-a', name: 'Kind A', role: 'child' };

function attempt(
  id: string,
  questionId: string,
  version: number,
  optionId = 'a',
): QuizAttemptRecord {
  return {
    id,
    user: 'a1',
    created: '',
    updated: '',
    lesson_id: 'proefles',
    question_id: questionId,
    option_id: optionId,
    correct: true,
    hints_used: 0,
    content_version: version,
  };
}

function interactionResult(id: string, version: number, score = 6): InteractionResultRecord {
  return {
    id,
    user: 'a1',
    created: '',
    updated: '',
    lesson_id: 'proefles',
    interaction_id: 'voel-spel',
    kind: 'trace-game',
    score,
    total: 8,
    detail: { rounds: [] },
    content_version: version,
  };
}

const game = { id: 'voel-spel', kind: 'trace-game' } as Interaction;
const finished = { score: 7, total: 8, detail: { rounds: [] } };

function snapshot(fields: Partial<LessonProgressSnapshot> = {}): LessonProgressSnapshot {
  return { steps: new Map(), checklists: new Map(), attempts: [], results: [], ...fields };
}

/** A promise with its resolve and reject, to control when a fake call finishes. */
function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason: unknown) => void = () => undefined;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('LessonProgress', () => {
  let user: ReturnType<typeof signal<UserRecord | null>>;
  let fake: {
    loadLesson: ReturnType<typeof vi.fn<ProgressService['loadLesson']>>;
    setStepStatus: ReturnType<typeof vi.fn<ProgressService['setStepStatus']>>;
    saveChecklist: ReturnType<typeof vi.fn<ProgressService['saveChecklist']>>;
    recordAnswer: ReturnType<typeof vi.fn<ProgressService['recordAnswer']>>;
    saveInteractionResult: ReturnType<typeof vi.fn<ProgressService['saveInteractionResult']>>;
  };
  let progress: LessonProgress;

  beforeEach(() => {
    user = signal<UserRecord | null>(kindA);
    fake = {
      loadLesson: vi.fn(async () => snapshot()),
      setStepStatus: vi.fn(async (...args: Parameters<ProgressService['setStepStatus']>) => ({
        id: `p-${args[3]}`,
        status: args[4],
      })),
      saveChecklist: vi.fn(async (...args: Parameters<ProgressService['saveChecklist']>) => ({
        id: 'c1',
        checked: [...args[3]],
      })),
      recordAnswer: vi.fn(async (...args: Parameters<ProgressService['recordAnswer']>) =>
        attempt(`q-${args[2]}`, args[2], args[6], args[3]),
      ),
      saveInteractionResult: vi.fn(
        async (...args: Parameters<ProgressService['saveInteractionResult']>) => ({
          ...interactionResult('nieuw', args[5], args[4].score),
          interaction_id: args[2],
        }),
      ),
    };
    TestBed.configureTestingModule({
      providers: [
        LessonProgress,
        { provide: ProgressService, useValue: fake },
        { provide: AuthService, useValue: { user } },
      ],
    });
    progress = TestBed.inject(LessonProgress);
  });

  it('loads the progress of the logged-in user for this lesson', async () => {
    fake.loadLesson.mockResolvedValue(
      snapshot({
        checklists: new Map<string, ChecklistProgress>([
          ['zelf-doen', { id: 'c1', checked: ['vispas'] }],
        ]),
      }),
    );
    expect(progress.state()).toBe('loading');
    const loading = progress.load(lesson, 'proefcursus');
    expect(progress.state()).toBe('loading');
    await loading;
    expect(fake.loadLesson).toHaveBeenCalledWith('a1', 'proefles');
    expect(progress.state()).toBe('ready');
    expect(progress.loads()).toBe(1);
    expect(progress.checked('zelf-doen')).toEqual(['vispas']);
    expect(progress.checked('onbekend')).toEqual([]);

    // Another user loads again, and never sees the ticks of the first.
    user.set({ ...kindA, id: 'b1', username: 'kind-b' });
    fake.loadLesson.mockResolvedValue(snapshot());
    await progress.load(lesson, 'proefcursus');
    expect(fake.loadLesson).toHaveBeenLastCalledWith('b1', 'proefles');
    expect(progress.checked('zelf-doen')).toEqual([]);
  });

  it('doneSteps lists only completed steps', async () => {
    fake.loadLesson.mockResolvedValue(
      snapshot({
        steps: new Map<string, StepProgress>([
          ['uitleg', { id: 'p1', status: 'completed' }],
          ['quiz', { id: 'p2', status: 'started' }],
          ['zelf-doen', { id: 'p3', status: 'completed' }],
        ]),
      }),
    );
    await progress.load(lesson, 'proefcursus');
    expect(progress.doneSteps()).toEqual(['uitleg', 'zelf-doen']);
  });

  it('startedSteps lists only started steps', async () => {
    fake.loadLesson.mockResolvedValue(
      snapshot({
        steps: new Map<string, StepProgress>([
          ['uitleg', { id: 'p1', status: 'completed' }],
          ['quiz', { id: 'p2', status: 'started' }],
        ]),
      }),
    );
    await progress.load(lesson, 'proefcursus');
    expect(progress.startedSteps()).toEqual(['quiz']);
  });

  it('latestAnswers ignores attempts for another content version', async () => {
    fake.loadLesson.mockResolvedValue(
      snapshot({
        attempts: [
          attempt('nieuw-oude-versie', 'een', 1, 'c'),
          attempt('nieuwst', 'een', 2, 'b'),
          attempt('ouder', 'een', 2, 'a'),
          attempt('alleen-oud', 'twee', 1),
          attempt('andere-vraag', 'drie', 2),
        ],
      }),
    );
    await progress.load(lesson, 'proefcursus');
    const latest = progress.latestAnswers(questions);
    expect([...latest.keys()]).toEqual(['een']);
    expect(latest.get('een')?.id).toBe('nieuwst');
  });

  it('latestResult ignores results for another content version', async () => {
    fake.loadLesson.mockResolvedValue(
      snapshot({
        results: [
          interactionResult('nieuw-oude-versie', 1, 8),
          interactionResult('nieuwst', 2, 5),
          interactionResult('ouder', 2, 3),
        ],
      }),
    );
    await progress.load(lesson, 'proefcursus');
    expect(progress.latestResult('voel-spel')?.id).toBe('nieuwst');
    expect(progress.latestResult('ander-spel')).toBeNull();

    fake.loadLesson.mockResolvedValue(snapshot({ results: [interactionResult('oud', 1)] }));
    await progress.reload();
    expect(progress.latestResult('voel-spel')).toBeNull();
  });

  it('recordInteraction stores the result and marks the step completed', async () => {
    await progress.load(lesson, 'proefcursus');
    await progress.recordInteraction('spel', game, finished);
    expect(fake.saveInteractionResult).toHaveBeenCalledWith(
      'a1',
      'proefles',
      'voel-spel',
      'trace-game',
      finished,
      2,
    );
    expect(progress.latestResult('voel-spel')?.score).toBe(7);
    expect(fake.setStepStatus).toHaveBeenLastCalledWith(
      'a1',
      'proefcursus',
      'proefles',
      'spel',
      'completed',
      2,
      undefined,
    );
    expect(progress.doneSteps()).toEqual(['spel']);
    expect(progress.saveError('spel')).toBeNull();
  });

  it('a failed result save sets saveError and leaves the step as it was', async () => {
    fake.loadLesson.mockResolvedValue(
      snapshot({
        steps: new Map<string, StepProgress>([['spel', { id: 'p1', status: 'started' }]]),
      }),
    );
    await progress.load(lesson, 'proefcursus');
    fake.saveInteractionResult.mockRejectedValueOnce(new ProgressError('unavailable', 'test'));
    await progress.recordInteraction('spel', game, finished);
    expect(progress.saveError('spel')).toBe(RESULT_NOT_SAVED);
    expect(progress.latestResult('voel-spel')).toBeNull();
    expect(fake.setStepStatus).not.toHaveBeenCalled();
    expect(progress.doneSteps()).toEqual([]);

    // The next game that is saved clears the message.
    await progress.recordInteraction('spel', game, finished);
    expect(progress.saveError('spel')).toBeNull();
    expect(progress.doneSteps()).toEqual(['spel']);
  });

  it('recordInteraction stores nothing while loading and says the score is not saved', async () => {
    const load = deferred<LessonProgressSnapshot>();
    fake.loadLesson.mockReturnValueOnce(load.promise);
    const loading = progress.load(lesson, 'proefcursus');
    await progress.recordInteraction('spel', game, finished);
    expect(fake.saveInteractionResult).not.toHaveBeenCalled();
    expect(fake.setStepStatus).not.toHaveBeenCalled();
    expect(progress.saveError('spel')).toBe(RESULT_NOT_SAVED);

    // The message stays after the load; the game was not stored and the step is not done.
    load.resolve(snapshot());
    await loading;
    await flush();
    expect(progress.state()).toBe('ready');
    expect(progress.saveError('spel')).toBe(RESULT_NOT_SAVED);
    expect(progress.latestResult('voel-spel')).toBeNull();
    expect(fake.saveInteractionResult).not.toHaveBeenCalled();
    expect(fake.setStepStatus).not.toHaveBeenCalled();
    expect(progress.doneSteps()).toEqual([]);
  });

  it('recordInteraction does nothing when progress is unavailable', async () => {
    fake.loadLesson.mockRejectedValueOnce(new ProgressError('unavailable', 'test'));
    await progress.load(lesson, 'proefcursus');
    expect(progress.state()).toBe('unavailable');
    await progress.recordInteraction('spel', game, finished);
    expect(fake.saveInteractionResult).not.toHaveBeenCalled();
    expect(fake.setStepStatus).not.toHaveBeenCalled();
    expect(progress.saveError('spel')).toBeNull();
  });

  it('ticking the first item marks the practice step started, the last one completed', async () => {
    await progress.load(lesson, 'proefcursus');
    await progress.toggle('zelf-doen', 'staal-en-tang', true, items);
    await flush();
    expect(progress.checked('zelf-doen')).toEqual(['staal-en-tang']);
    expect(fake.setStepStatus).toHaveBeenLastCalledWith(
      'a1',
      'proefcursus',
      'proefles',
      'zelf-doen',
      'started',
      2,
      undefined,
    );
    expect(progress.doneSteps()).toEqual([]);

    await progress.toggle('zelf-doen', 'vispas', true, items);
    await progress.toggle('zelf-doen', 'bodem-voelen', true, items);
    await flush();
    // Always the whole list, in item order.
    expect(fake.saveChecklist).toHaveBeenLastCalledWith('a1', 'proefles', 'zelf-doen', items, 'c1');
    expect(fake.setStepStatus).toHaveBeenLastCalledWith(
      'a1',
      'proefcursus',
      'proefles',
      'zelf-doen',
      'completed',
      2,
      { id: 'p-zelf-doen', status: 'started' },
    );
    expect(progress.doneSteps()).toEqual(['zelf-doen']);
  });

  it('unticking never makes a completed step started again', async () => {
    fake.loadLesson.mockResolvedValue(
      snapshot({
        steps: new Map<string, StepProgress>([['zelf-doen', { id: 'p3', status: 'completed' }]]),
        checklists: new Map<string, ChecklistProgress>([
          ['zelf-doen', { id: 'c1', checked: items }],
        ]),
      }),
    );
    await progress.load(lesson, 'proefcursus');
    await progress.toggle('zelf-doen', 'vispas', false, items);
    await flush();
    expect(progress.checked('zelf-doen')).toEqual(['staal-en-tang', 'bodem-voelen']);
    expect(fake.setStepStatus).not.toHaveBeenCalled();
    expect(progress.doneSteps()).toEqual(['zelf-doen']);
  });

  it('a failed tick is undone and sets saveError', async () => {
    await progress.load(lesson, 'proefcursus');
    const save = deferred<ChecklistProgress>();
    fake.saveChecklist.mockReturnValueOnce(save.promise);
    const toggling = progress.toggle('zelf-doen', 'vispas', true, items);
    // Shown at once.
    expect(progress.checked('zelf-doen')).toEqual(['vispas']);
    save.reject(new ProgressError('unavailable', 'test'));
    await toggling;
    expect(progress.checked('zelf-doen')).toEqual([]);
    expect(progress.saveError('zelf-doen')).toBe(TICK_NOT_SAVED);
    expect(fake.setStepStatus).not.toHaveBeenCalled();

    // The next tick that is saved clears the message.
    await progress.toggle('zelf-doen', 'vispas', true, items);
    expect(progress.saveError('zelf-doen')).toBeNull();
    expect(progress.checked('zelf-doen')).toEqual(['vispas']);
  });

  it('a failed answer keeps the answer and sets saveError', async () => {
    await progress.load(lesson, 'proefcursus');
    fake.recordAnswer.mockRejectedValueOnce(new ProgressError('unavailable', 'test'));
    await progress.answer('quiz', 'een', 'a', true, 1, questions);
    expect(fake.recordAnswer).toHaveBeenCalledWith('a1', 'proefles', 'een', 'a', true, 1, 2);
    expect(progress.saveError('quiz')).toBe(ANSWER_NOT_SAVED);
    expect(fake.setStepStatus).not.toHaveBeenCalled();

    // A saved answer: started after the first, completed when every question has an answer.
    await progress.answer('quiz', 'een', 'b', false, 0, questions);
    expect(progress.saveError('quiz')).toBeNull();
    expect(progress.latestAnswers(questions).get('een')?.option_id).toBe('b');
    expect(fake.setStepStatus).toHaveBeenLastCalledWith(
      'a1',
      'proefcursus',
      'proefles',
      'quiz',
      'started',
      2,
      undefined,
    );
    await progress.answer('quiz', 'twee', 'a', true, 0, questions);
    expect(progress.doneSteps()).toEqual(['quiz']);
  });

  it('writes to one checklist run one after the other and the last state wins', async () => {
    await progress.load(lesson, 'proefcursus');
    const first = deferred<ChecklistProgress>();
    fake.saveChecklist.mockReturnValueOnce(first.promise);
    const one = progress.toggle('zelf-doen', 'vispas', true, items);
    const two = progress.toggle('zelf-doen', 'bodem-voelen', true, items);
    await flush();
    // The second write waits for the first.
    expect(fake.saveChecklist).toHaveBeenCalledTimes(1);
    expect(fake.saveChecklist.mock.calls[0][3]).toEqual(['vispas', 'bodem-voelen']);
    first.resolve({ id: 'c7', checked: ['vispas', 'bodem-voelen'] });
    await Promise.all([one, two]);
    expect(fake.saveChecklist).toHaveBeenCalledTimes(2);
    // The second updates the record the first one created, with the last state.
    expect(fake.saveChecklist).toHaveBeenLastCalledWith(
      'a1',
      'proefles',
      'zelf-doen',
      ['vispas', 'bodem-voelen'],
      'c7',
    );
    expect(progress.checked('zelf-doen')).toEqual(['vispas', 'bodem-voelen']);
  });

  it('a failed load gives state unavailable and reload tries again', async () => {
    fake.loadLesson.mockRejectedValueOnce(new ProgressError('unavailable', 'test'));
    await progress.load(lesson, 'proefcursus');
    expect(progress.state()).toBe('unavailable');
    // Nothing is written while the progress is unknown.
    await progress.toggle('zelf-doen', 'vispas', true, items);
    await progress.answer('quiz', 'een', 'a', true, 0, questions);
    await progress.markStep('uitleg', 'completed');
    expect(fake.saveChecklist).not.toHaveBeenCalled();
    expect(fake.recordAnswer).not.toHaveBeenCalled();
    expect(fake.setStepStatus).not.toHaveBeenCalled();
    expect(progress.checked('zelf-doen')).toEqual([]);

    await progress.reload();
    expect(fake.loadLesson).toHaveBeenCalledTimes(2);
    expect(progress.state()).toBe('ready');
  });

  it('a step completed while loading is stored once the progress is ready', async () => {
    const load = deferred<LessonProgressSnapshot>();
    fake.loadLesson.mockReturnValueOnce(load.promise);
    const loading = progress.load(lesson, 'proefcursus');
    await progress.markStep('uitleg', 'completed');
    expect(fake.setStepStatus).not.toHaveBeenCalled();
    load.resolve(snapshot());
    await loading;
    await flush();
    expect(fake.setStepStatus).toHaveBeenCalledWith(
      'a1',
      'proefcursus',
      'proefles',
      'uitleg',
      'completed',
      2,
      undefined,
    );
    expect(progress.doneSteps()).toEqual(['uitleg']);
  });

  it('markStep does nothing when the status stays the same, and a failure is silent', async () => {
    await progress.load(lesson, 'proefcursus');
    fake.setStepStatus.mockRejectedValueOnce(new ProgressError('unavailable', 'test'));
    await progress.markStep('uitleg', 'completed');
    expect(progress.doneSteps()).toEqual([]);
    expect(progress.saveError('uitleg')).toBeNull();
    await progress.markStep('uitleg', 'completed');
    await progress.markStep('uitleg', 'completed');
    expect(fake.setStepStatus).toHaveBeenCalledTimes(2);
    expect(progress.doneSteps()).toEqual(['uitleg']);
  });

  it('without a logged-in user the progress is unavailable', async () => {
    user.set(null);
    await progress.load(lesson, 'proefcursus');
    expect(progress.state()).toBe('unavailable');
    expect(fake.loadLesson).not.toHaveBeenCalled();
  });
});
