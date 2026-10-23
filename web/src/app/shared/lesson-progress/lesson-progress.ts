import { computed, inject, Injectable, signal } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import type { Interaction, Lesson } from '../../core/content/content.types';
import type {
  InteractionResultRecord,
  QuizAttemptRecord,
  StepStatus,
} from '../../core/pocketbase/types';
import {
  ProgressService,
  type LessonProgressSnapshot,
  type StepProgress,
} from '../../core/progress/progress.service';
import type { InteractionResult } from '../../interactions/interaction';

/** Whether the progress of this lesson is known: quiz and checklist only write when `ready`. */
export type LessonProgressState = 'loading' | 'ready' | 'unavailable';

export const TICK_NOT_SAVED = 'Dat vinkje is niet bewaard. Probeer het zo nog eens.';
export const ANSWER_NOT_SAVED = 'Je antwoord is niet bewaard.';
export const RESULT_NOT_SAVED = 'Je score is niet bewaard.';

interface Target {
  readonly lesson: Lesson;
  readonly courseId: string;
  readonly userId: string;
}

/**
 * The progress of the logged-in user in one lesson: step statuses, ticks per checklist, quiz
 * attempts and interaction results, as signals, and the actions that store them through ProgressService. Not provided in
 * root: the lesson page provides it, next to LessonContext. Quiz, checklist and interaction
 * inject it optionally; without it they work in memory only.
 *
 * Writes to one record run one after the other (a queue per record), so a quick series of ticks
 * never races and the last state wins.
 */
@Injectable()
export class LessonProgress {
  private readonly service = inject(ProgressService);
  private readonly auth = inject(AuthService);

  private readonly currentState = signal<LessonProgressState>('loading');
  private readonly steps = signal<ReadonlyMap<string, StepProgress>>(new Map());
  private readonly ticks = signal<ReadonlyMap<string, readonly string[]>>(new Map());
  private readonly attempts = signal<readonly QuizAttemptRecord[]>([]);
  private readonly results = signal<readonly InteractionResultRecord[]>([]);
  private readonly errors = signal<ReadonlyMap<string, string>>(new Map());
  private readonly loadCount = signal(0);

  private target: Target | null = null;
  private loadToken = 0;
  /** Record ids of the checklists, known after a load or the first save. */
  private readonly checklistIds = new Map<string, string>();
  private readonly queues = new Map<string, Promise<void>>();
  /** Steps that were completed while the progress was still loading. */
  private readonly pendingMarks = new Map<string, StepStatus>();

  readonly state = this.currentState.asReadonly();
  /** Goes up after every successful load: a sign for the quiz to restore its answers. */
  readonly loads = this.loadCount.asReadonly();
  /** The ids of the steps with status completed. */
  readonly doneSteps = computed(() =>
    [...this.steps()].filter(([, step]) => step.status === 'completed').map(([id]) => id),
  );

  /** Loads the progress of the logged-in user for `lesson`; a failure gives `unavailable`. */
  load(lesson: Lesson, courseId: string): Promise<void> {
    this.target = { lesson, courseId, userId: this.auth.user()?.id ?? '' };
    return this.fetch();
  }

  /** Tries the last load again (the "Opnieuw" button). */
  reload(): Promise<void> {
    return this.fetch();
  }

  /** The ticked item ids of a checklist, in item order. */
  checked(checklistId: string): readonly string[] {
    return this.ticks().get(checklistId) ?? [];
  }

  /** The message of a failed save in a step (quiz or checklist), or null. */
  saveError(stepId: string): string | null {
    return this.errors().get(stepId) ?? null;
  }

  /**
   * The latest attempt per question, only for attempts with the current version of the lesson
   * (an older answer may belong to a question that has changed since).
   */
  latestAnswers(questionIds: readonly string[]): ReadonlyMap<string, QuizAttemptRecord> {
    const version = this.target?.lesson.version;
    const wanted = new Set(questionIds);
    const latest = new Map<string, QuizAttemptRecord>();
    for (const attempt of this.attempts()) {
      if (attempt.content_version !== version || !wanted.has(attempt.question_id)) continue;
      if (!latest.has(attempt.question_id)) latest.set(attempt.question_id, attempt);
    }
    return latest;
  }

  /**
   * The newest result of an interaction with the current version of the lesson (an older result
   * may belong to a game that has changed since), or null.
   */
  latestResult(interactionId: string): InteractionResultRecord | null {
    const version = this.target?.lesson.version;
    return (
      this.results().find(
        (result) => result.interaction_id === interactionId && result.content_version === version,
      ) ?? null
    );
  }

  /**
   * Stores the status of a step. Does nothing when the step is completed already or the status
   * stays the same; a failure is silent (the circle stays empty, the next time tries again).
   */
  markStep(stepId: string, status: StepStatus): Promise<void> {
    if (this.currentState() === 'loading') {
      if (this.pendingMarks.get(stepId) !== 'completed') this.pendingMarks.set(stepId, status);
      return Promise.resolve();
    }
    if (this.currentState() !== 'ready') return Promise.resolve();
    return this.enqueue(`step:${stepId}`, async () => {
      const target = this.target;
      const existing = this.steps().get(stepId);
      if (!target || existing?.status === 'completed' || existing?.status === status) return;
      try {
        const saved = await this.service.setStepStatus(
          target.userId,
          target.courseId,
          target.lesson.id,
          stepId,
          status,
          target.lesson.version,
          existing,
        );
        if (this.target !== target) return;
        this.steps.update((steps) => new Map(steps).set(stepId, saved));
      } catch {
        // Silent: the circle stays empty and the next time tries again.
      }
    });
  }

  /**
   * Ticks or unticks an item of a checklist (a practice step): shown at once, stored in the
   * background. A failed save undoes the tick and sets the save error. After a save the practice
   * step becomes started (something ticked) or completed (everything ticked).
   */
  toggle(
    checklistId: string,
    itemId: string,
    on: boolean,
    allItemIds: readonly string[],
  ): Promise<void> {
    if (this.currentState() !== 'ready' || !this.target) return Promise.resolve();
    const target = this.target;
    const current = new Set(this.checked(checklistId));
    if (on) current.add(itemId);
    else current.delete(itemId);
    this.ticks.update((ticks) =>
      new Map(ticks).set(
        checklistId,
        allItemIds.filter((id) => current.has(id)),
      ),
    );
    this.clearError(checklistId);

    return this.enqueue(`checklist:${checklistId}`, async () => {
      if (this.target !== target) return;
      // Send the state as it is now: an earlier tick in the queue may have been undone.
      const shown = new Set(this.checked(checklistId));
      const list = allItemIds.filter((id) => shown.has(id));
      try {
        const saved = await this.service.saveChecklist(
          target.userId,
          target.lesson.id,
          checklistId,
          list,
          this.checklistIds.get(checklistId),
        );
        if (this.target !== target) return;
        this.checklistIds.set(checklistId, saved.id);
      } catch {
        if (this.target !== target) return;
        // Undo only this tick: later ticks in the queue keep their own state.
        const now = new Set(this.checked(checklistId));
        if (on) now.delete(itemId);
        else now.add(itemId);
        this.ticks.update((ticks) =>
          new Map(ticks).set(
            checklistId,
            allItemIds.filter((id) => now.has(id)),
          ),
        );
        this.setError(checklistId, TICK_NOT_SAVED);
        return;
      }
      if (list.length > 0) {
        void this.markStep(
          checklistId,
          list.length === allItemIds.length ? 'completed' : 'started',
        );
      }
    });
  }

  /**
   * Stores an answer to a quiz question as a new attempt. A failed save keeps the answer on the
   * page (the quiz holds it) and sets the save error. After a save the quiz step becomes started,
   * or completed when every question has an answer.
   */
  async answer(
    stepId: string,
    questionId: string,
    optionId: string,
    correct: boolean,
    hintsUsed: number,
    allQuestionIds: readonly string[],
  ): Promise<void> {
    if (this.currentState() !== 'ready' || !this.target) return;
    const target = this.target;
    this.clearError(stepId);
    try {
      const attempt = await this.service.recordAnswer(
        target.userId,
        target.lesson.id,
        questionId,
        optionId,
        correct,
        hintsUsed,
        target.lesson.version,
      );
      if (this.target !== target) return;
      this.attempts.update((attempts) => [attempt, ...attempts]);
    } catch {
      if (this.target === target) this.setError(stepId, ANSWER_NOT_SAVED);
      return;
    }
    const answered = this.latestAnswers(allQuestionIds);
    const complete = allQuestionIds.every((id) => answered.has(id));
    await this.markStep(stepId, complete ? 'completed' : 'started');
  }

  /**
   * Stores a finished game as a new interaction result, and then marks the step completed. A
   * failed save keeps the score on the page (the game holds it) and sets the save error.
   */
  async recordInteraction(
    stepId: string,
    interaction: Interaction,
    result: InteractionResult,
  ): Promise<void> {
    if (this.currentState() !== 'ready' || !this.target) return;
    const target = this.target;
    this.clearError(stepId);
    try {
      const saved = await this.service.saveInteractionResult(
        target.userId,
        target.lesson.id,
        interaction.id,
        interaction.kind,
        result,
        target.lesson.version,
      );
      if (this.target !== target) return;
      this.results.update((results) => [saved, ...results]);
    } catch {
      if (this.target === target) this.setError(stepId, RESULT_NOT_SAVED);
      return;
    }
    await this.markStep(stepId, 'completed');
  }

  private async fetch(): Promise<void> {
    const target = this.target;
    if (!target) return;
    const token = ++this.loadToken;
    this.currentState.set('loading');
    this.steps.set(new Map());
    this.ticks.set(new Map());
    this.attempts.set([]);
    this.results.set([]);
    this.errors.set(new Map());
    this.checklistIds.clear();
    if (!target.userId) {
      this.currentState.set('unavailable');
      return;
    }
    let snapshot: LessonProgressSnapshot;
    try {
      snapshot = await this.service.loadLesson(target.userId, target.lesson.id);
    } catch {
      if (token !== this.loadToken) return;
      this.pendingMarks.clear();
      this.currentState.set('unavailable');
      return;
    }
    if (token !== this.loadToken) return;
    this.steps.set(new Map(snapshot.steps));
    this.ticks.set(
      new Map([...snapshot.checklists].map(([id, checklist]) => [id, checklist.checked])),
    );
    for (const [id, checklist] of snapshot.checklists) this.checklistIds.set(id, checklist.id);
    this.attempts.set(snapshot.attempts);
    this.results.set(snapshot.results);
    this.currentState.set('ready');
    this.loadCount.update((count) => count + 1);

    const pending = [...this.pendingMarks];
    this.pendingMarks.clear();
    for (const [stepId, status] of pending) void this.markStep(stepId, status);
  }

  /** Runs `task` after every earlier task with the same key (also after a failed one). */
  private enqueue(key: string, task: () => Promise<void>): Promise<void> {
    const previous = this.queues.get(key) ?? Promise.resolve();
    const next = previous.then(task, task);
    this.queues.set(key, next);
    void next.finally(() => {
      if (this.queues.get(key) === next) this.queues.delete(key);
    });
    return next;
  }

  private setError(stepId: string, message: string): void {
    this.errors.update((errors) => new Map(errors).set(stepId, message));
  }

  private clearError(stepId: string): void {
    if (!this.errors().has(stepId)) return;
    this.errors.update((errors) => {
      const next = new Map(errors);
      next.delete(stepId);
      return next;
    });
  }
}
