import { inject, Injectable } from '@angular/core';
import { ClientResponseError } from 'pocketbase';
import { PocketBaseService } from '../pocketbase/pocketbase.service';
import type { InteractionResult } from '../../interactions/interaction';
import type {
  ChecklistStateRecord,
  InteractionResultRecord,
  LessonProgressRecord,
  QuizAttemptRecord,
  StepStatus,
} from '../pocketbase/types';
import { lastActivity } from './child-progress';
import { groupStepStatuses, type StepStatuses, type StepStatusRecord } from './course-progress';
import { toProgressError } from './progress-error';

/** The status of one step, with the id of its record. */
export interface StepProgress {
  readonly id: string;
  readonly status: StepStatus;
}

/** The ticked items of one checklist, with the id of its record. */
export interface ChecklistProgress {
  readonly id: string;
  readonly checked: readonly string[];
}

/** Everything a user stored for one lesson. */
export interface LessonProgressSnapshot {
  /** By step id. */
  readonly steps: ReadonlyMap<string, StepProgress>;
  /** By checklist id (the id of the practice step). */
  readonly checklists: ReadonlyMap<string, ChecklistProgress>;
  /** Every quiz attempt of this lesson, newest first. */
  readonly attempts: readonly QuizAttemptRecord[];
  /** Every interaction result (finished game) of this lesson, newest first. */
  readonly results: readonly InteractionResultRecord[];
}

/** What the parent overview shows of one user: the step statuses and the last activity. */
export interface ChildActivity {
  readonly statuses: StepStatuses;
  /** The newest `updated` of every record of the user, or null without records. */
  readonly lastActivity: string | null;
}

/** Every record of one user for one lesson; attempts and results newest first. */
export interface LessonRecords {
  readonly steps: readonly LessonProgressRecord[];
  readonly checklists: readonly ChecklistStateRecord[];
  readonly attempts: readonly QuizAttemptRecord[];
  readonly results: readonly InteractionResultRecord[];
}

/** Everything one user stored, by lesson id. */
export interface UserProgressSnapshot {
  readonly statuses: StepStatuses;
  readonly lessons: ReadonlyMap<string, LessonRecords>;
}

/** The four progress collections; clearing a lesson empties all of them. */
const progressCollections = [
  'lesson_progress',
  'quiz_attempts',
  'checklist_states',
  'interaction_results',
] as const;

/**
 * Never cancel a request because another one to the same path starts (the SDK does that by
 * default): two answers in quick succession are two separate records.
 */
const noCancel = { requestKey: null } as const;

/**
 * Reads and writes progress in PocketBase (`lesson_progress`, `quiz_attempts`,
 * `checklist_states`, `interaction_results`). Every filter is built with parameters (`pb.filter`), and an update only
 * sends the fields a child may change; the access rules in PocketBase are the real protection.
 * Every failure becomes a ProgressError.
 */
@Injectable({ providedIn: 'root' })
export class ProgressService {
  private readonly pb = inject(PocketBaseService).client;

  /**
   * Loads the step statuses, checklists, quiz attempts and interaction results of one user for
   * one lesson.
   */
  async loadLesson(userId: string, lessonId: string): Promise<LessonProgressSnapshot> {
    const filter = this.pb.filter('lesson_id = {:lessonId} && user = {:userId}', {
      lessonId,
      userId,
    });
    try {
      const [steps, checklists, attempts, results] = await Promise.all([
        this.pb
          .collection('lesson_progress')
          .getFullList<LessonProgressRecord>({ filter, ...noCancel }),
        this.pb
          .collection('checklist_states')
          .getFullList<ChecklistStateRecord>({ filter, ...noCancel }),
        this.pb
          .collection('quiz_attempts')
          .getFullList<QuizAttemptRecord>({ filter, sort: '-created', ...noCancel }),
        this.pb
          .collection('interaction_results')
          .getFullList<InteractionResultRecord>({ filter, sort: '-created', ...noCancel }),
      ]);
      return {
        steps: new Map(steps.map((record) => [record.step_id, toStepProgress(record)])),
        checklists: new Map(
          checklists.map((record) => [record.checklist_id, toChecklistProgress(record)]),
        ),
        // Sorted here as well: the order must not depend on the server alone.
        attempts: [...attempts].sort(newestFirst),
        results: [...results].sort(newestFirst),
      };
    } catch (error) {
      throw toProgressError(error, 'Loading progress');
    }
  }

  /**
   * Loads the status of every step of one user, of every course or only of `courseId`, grouped
   * by lesson and step. The filter on `user` is essential: a parent may read every record.
   */
  async loadStepStatuses(userId: string, courseId?: string): Promise<StepStatuses> {
    const filter =
      courseId === undefined
        ? this.pb.filter('user = {:userId}', { userId })
        : this.pb.filter('user = {:userId} && course_id = {:courseId}', { userId, courseId });
    try {
      const records = await this.pb.collection('lesson_progress').getFullList<StepStatusRecord>({
        filter,
        fields: 'lesson_id,step_id,status',
        ...noCancel,
      });
      return groupStepStatuses(records);
    } catch (error) {
      throw toProgressError(error, 'Loading progress');
    }
  }

  /**
   * Loads, for the parent overview, the step statuses and the last activity of every user, in
   * four requests with only the fields needed. Grouped by `user`; the caller keeps the children.
   */
  async loadActivity(): Promise<ReadonlyMap<string, ChildActivity>> {
    try {
      const [steps, attempts, checklists, results] = await Promise.all([
        this.pb
          .collection('lesson_progress')
          .getFullList<StepStatusRecord & { user: string; updated: string }>({
            fields: 'user,lesson_id,step_id,status,updated',
            ...noCancel,
          }),
        ...(['quiz_attempts', 'checklist_states', 'interaction_results'] as const).map((name) =>
          this.pb.collection(name).getFullList<{ user: string; updated: string }>({
            fields: 'user,updated',
            ...noCancel,
          }),
        ),
      ]);
      const stepsByUser = groupBy(steps, (record) => record.user);
      const updatedByUser = groupBy(
        [...steps, ...attempts, ...checklists, ...results],
        (record) => record.user,
      );
      const activity = new Map<string, ChildActivity>();
      for (const [userId, records] of updatedByUser) {
        activity.set(userId, {
          statuses: groupStepStatuses(stepsByUser.get(userId) ?? []),
          lastActivity: lastActivity(records),
        });
      }
      return activity;
    } catch (error) {
      throw toProgressError(error, 'Loading the activity');
    }
  }

  /**
   * Loads every record of one user in the four collections, grouped by lesson (attempts and
   * results newest first). The filter on `user` is essential: a parent may read every record.
   */
  async loadUserProgress(userId: string): Promise<UserProgressSnapshot> {
    const filter = this.pb.filter('user = {:userId}', { userId });
    try {
      const [steps, checklists, attempts, results] = await Promise.all([
        this.pb
          .collection('lesson_progress')
          .getFullList<LessonProgressRecord>({ filter, ...noCancel }),
        this.pb
          .collection('checklist_states')
          .getFullList<ChecklistStateRecord>({ filter, ...noCancel }),
        this.pb
          .collection('quiz_attempts')
          .getFullList<QuizAttemptRecord>({ filter, sort: '-created', ...noCancel }),
        this.pb
          .collection('interaction_results')
          .getFullList<InteractionResultRecord>({ filter, sort: '-created', ...noCancel }),
      ]);
      const byLesson = (record: { lesson_id: string }) => record.lesson_id;
      const stepsByLesson = groupBy(steps, byLesson);
      const checklistsByLesson = groupBy(checklists, byLesson);
      const attemptsByLesson = groupBy([...attempts].sort(newestFirst), byLesson);
      const resultsByLesson = groupBy([...results].sort(newestFirst), byLesson);
      const lessonIds = new Set([
        ...stepsByLesson.keys(),
        ...checklistsByLesson.keys(),
        ...attemptsByLesson.keys(),
        ...resultsByLesson.keys(),
      ]);
      const lessons = new Map<string, LessonRecords>();
      for (const lessonId of lessonIds) {
        lessons.set(lessonId, {
          steps: stepsByLesson.get(lessonId) ?? [],
          checklists: checklistsByLesson.get(lessonId) ?? [],
          attempts: attemptsByLesson.get(lessonId) ?? [],
          results: resultsByLesson.get(lessonId) ?? [],
        });
      }
      return { statuses: groupStepStatuses(steps), lessons };
    } catch (error) {
      throw toProgressError(error, 'Loading progress');
    }
  }

  /**
   * Deletes every record of one user for one lesson, in all four collections, one by one (the
   * batch API is off). Safe to repeat: a record that is already gone (404) counts as deleted.
   * Any other failure becomes a ProgressError, after deleting what could be deleted.
   */
  async clearLesson(userId: string, lessonId: string): Promise<void> {
    if (userId === '' || lessonId === '') {
      throw new Error('Clearing a lesson needs a user id and a lesson id.');
    }
    const filter = this.pb.filter('user = {:userId} && lesson_id = {:lessonId}', {
      userId,
      lessonId,
    });
    let failure: unknown = null;
    for (const name of progressCollections) {
      const collection = this.pb.collection(name);
      let ids: string[];
      try {
        const records = await collection.getFullList<{ id: string }>({
          filter,
          fields: 'id',
          ...noCancel,
        });
        ids = records.map((record) => record.id);
      } catch (error) {
        failure ??= error;
        continue;
      }
      for (const id of ids) {
        try {
          await collection.delete(id, noCancel);
        } catch (error) {
          if (error instanceof ClientResponseError && error.status === 404) continue;
          failure ??= error;
        }
      }
    }
    if (failure !== null) throw toProgressError(failure, 'Clearing the lesson');
  }

  /**
   * Stores the status of a step: creates the record the first time, then only updates `status`
   * and `content_version`. A completed step never goes back to started. When the record turns
   * out to exist already (another tab, a lost answer), it is looked up and updated.
   */
  async setStepStatus(
    userId: string,
    courseId: string,
    lessonId: string,
    stepId: string,
    status: StepStatus,
    contentVersion: number,
    existing?: StepProgress,
  ): Promise<StepProgress> {
    const collection = this.pb.collection('lesson_progress');
    const update = async (current: StepProgress): Promise<StepProgress> => {
      if (current.status === 'completed' || current.status === status) return current;
      const record = await collection.update<LessonProgressRecord>(
        current.id,
        { status, content_version: contentVersion },
        noCancel,
      );
      return toStepProgress(record);
    };
    try {
      if (existing) return await update(existing);
      try {
        const record = await collection.create<LessonProgressRecord>(
          {
            user: userId,
            course_id: courseId,
            lesson_id: lessonId,
            step_id: stepId,
            status,
            content_version: contentVersion,
          },
          noCancel,
        );
        return toStepProgress(record);
      } catch (error) {
        if (!isBadRequest(error)) throw error;
        const found = await collection.getFirstListItem<LessonProgressRecord>(
          this.pb.filter('user = {:userId} && lesson_id = {:lessonId} && step_id = {:stepId}', {
            userId,
            lessonId,
            stepId,
          }),
          noCancel,
        );
        return await update(toStepProgress(found));
      }
    } catch (error) {
      throw toProgressError(error, 'Saving the step status');
    }
  }

  /**
   * Stores the ticked items of a checklist: the whole list, as given (in item order). Creates
   * the record the first time, then only updates `checked`, with the same fallback as
   * setStepStatus.
   */
  async saveChecklist(
    userId: string,
    lessonId: string,
    checklistId: string,
    checked: readonly string[],
    existingId?: string,
  ): Promise<ChecklistProgress> {
    const collection = this.pb.collection('checklist_states');
    const update = async (id: string): Promise<ChecklistProgress> => {
      const record = await collection.update<ChecklistStateRecord>(
        id,
        { checked: [...checked] },
        noCancel,
      );
      return toChecklistProgress(record);
    };
    try {
      if (existingId) return await update(existingId);
      try {
        const record = await collection.create<ChecklistStateRecord>(
          { user: userId, lesson_id: lessonId, checklist_id: checklistId, checked: [...checked] },
          noCancel,
        );
        return toChecklistProgress(record);
      } catch (error) {
        if (!isBadRequest(error)) throw error;
        const found = await collection.getFirstListItem<ChecklistStateRecord>(
          this.pb.filter(
            'user = {:userId} && lesson_id = {:lessonId} && checklist_id = {:checklistId}',
            { userId, lessonId, checklistId },
          ),
          noCancel,
        );
        return await update(found.id);
      }
    } catch (error) {
      throw toProgressError(error, 'Saving the checklist');
    }
  }

  /** Stores one answer to a quiz question: always a new record. */
  async recordAnswer(
    userId: string,
    lessonId: string,
    questionId: string,
    optionId: string,
    correct: boolean,
    hintsUsed: number,
    contentVersion: number,
  ): Promise<QuizAttemptRecord> {
    try {
      return await this.pb.collection('quiz_attempts').create<QuizAttemptRecord>(
        {
          user: userId,
          lesson_id: lessonId,
          question_id: questionId,
          option_id: optionId,
          correct,
          hints_used: hintsUsed,
          content_version: contentVersion,
        },
        noCancel,
      );
    } catch (error) {
      throw toProgressError(error, 'Saving the answer');
    }
  }

  /** Stores one finished game (an interaction): always a new record. */
  async saveInteractionResult(
    userId: string,
    lessonId: string,
    interactionId: string,
    kind: string,
    result: InteractionResult,
    contentVersion: number,
  ): Promise<InteractionResultRecord> {
    try {
      return await this.pb.collection('interaction_results').create<InteractionResultRecord>(
        {
          user: userId,
          lesson_id: lessonId,
          interaction_id: interactionId,
          kind,
          score: result.score,
          total: result.total,
          detail: result.detail,
          content_version: contentVersion,
        },
        noCancel,
      );
    } catch (error) {
      throw toProgressError(error, 'Saving the result');
    }
  }
}

function toStepProgress(record: LessonProgressRecord): StepProgress {
  return { id: record.id, status: record.status };
}

function toChecklistProgress(record: ChecklistStateRecord): ChecklistProgress {
  const checked = Array.isArray(record.checked)
    ? record.checked.filter((id): id is string => typeof id === 'string')
    : [];
  return { id: record.id, checked };
}

function groupBy<T>(records: readonly T[], key: (record: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const record of records) {
    const group = groups.get(key(record));
    if (group) group.push(record);
    else groups.set(key(record), [record]);
  }
  return groups;
}

function newestFirst(a: { created: string }, b: { created: string }): number {
  return a.created < b.created ? 1 : a.created > b.created ? -1 : 0;
}

/** A 400 on create: for these collections that is the unique index (the record exists). */
function isBadRequest(error: unknown): boolean {
  return error instanceof ClientResponseError && error.status === 400;
}
