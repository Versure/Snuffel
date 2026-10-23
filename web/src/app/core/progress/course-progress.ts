import type { ManifestCourse, ManifestLesson } from '../content/content.types';
import type { LessonProgressRecord, StepStatus } from '../pocketbase/types';

/** The stored status of every step of a user: by lesson id, then by step id. */
export type StepStatuses = ReadonlyMap<string, ReadonlyMap<string, StepStatus>>;

/**
 * - `planned`: the lesson is not published yet (no file, no link);
 * - `new`: no record for any step the lesson has now;
 * - `started`: at least one step has a record, but not every step is completed;
 * - `completed`: every step the lesson has now is completed (whatever the content version).
 */
export type LessonStatus = 'planned' | 'new' | 'started' | 'completed';

export interface LessonProgressSummary {
  readonly status: LessonStatus;
  /** Completed steps of the lesson as it is now. */
  readonly done: number;
  /** Steps of the lesson as it is now (0 for a planned lesson). */
  readonly total: number;
}

export interface CourseProgressSummary {
  /** Completed lessons. */
  readonly completed: number;
  /** Every lesson of the course, planned ones included. */
  readonly total: number;
}

export interface NextLesson {
  readonly lesson: ManifestLesson;
  readonly status: 'new' | 'started';
}

/** The fields of a `lesson_progress` record that the status depends on. */
export type StepStatusRecord = Pick<LessonProgressRecord, 'lesson_id' | 'step_id' | 'status'>;

/**
 * Groups records by lesson and step. `content_version` plays no part: a step that was ever
 * completed stays completed.
 */
export function groupStepStatuses(records: readonly StepStatusRecord[]): StepStatuses {
  const byLesson = new Map<string, Map<string, StepStatus>>();
  for (const record of records) {
    let steps = byLesson.get(record.lesson_id);
    if (!steps) {
      steps = new Map();
      byLesson.set(record.lesson_id, steps);
    }
    // One record per user, lesson and step (unique index); completed wins just in case.
    if (steps.get(record.step_id) !== 'completed') steps.set(record.step_id, record.status);
  }
  return byLesson;
}

/** The status of one lesson. Only the steps the lesson has now (`stepIds`) count. */
export function lessonProgress(
  entry: ManifestLesson,
  statuses: StepStatuses,
): LessonProgressSummary {
  if (entry.status !== 'published') return { status: 'planned', done: 0, total: 0 };
  const stepIds = entry.stepIds ?? [];
  const steps = statuses.get(entry.id);
  let done = 0;
  let touched = 0;
  for (const stepId of stepIds) {
    const status = steps?.get(stepId);
    if (status === undefined) continue;
    touched += 1;
    if (status === 'completed') done += 1;
  }
  const total = stepIds.length;
  const status: LessonStatus =
    touched === 0 ? 'new' : total > 0 && done === total ? 'completed' : 'started';
  return { status, done, total };
}

/** How many lessons of a course are completed, of all its lessons (planned ones included). */
export function courseProgress(
  course: ManifestCourse,
  statuses: StepStatuses,
): CourseProgressSummary {
  const completed = course.lessons.filter(
    (lesson) => lessonProgress(lesson, statuses).status === 'completed',
  ).length;
  return { completed, total: course.lessons.length };
}

/** The first published lesson that is not completed, or null when there is none. */
export function nextLesson(course: ManifestCourse, statuses: StepStatuses): NextLesson | null {
  for (const lesson of course.lessons) {
    const { status } = lessonProgress(lesson, statuses);
    if (status === 'new' || status === 'started') return { lesson, status };
  }
  return null;
}
