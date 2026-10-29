// Record types as they come from PocketBase (see pocketbase/pb_migrations).

export type UserRole = 'child' | 'parent';

/** The fields of a `users` record that the app uses. */
export interface UserRecord {
  id: string;
  username: string;
  name: string;
  role: UserRole;
}

/** The status of a step in `lesson_progress`. */
export type StepStatus = 'started' | 'completed';

/** Fields every progress record has (see the *_create_* migrations). */
export interface ProgressRecordBase {
  id: string;
  user: string;
  created: string;
  updated: string;
}

/** A `lesson_progress` record: one per user, lesson and step. */
export interface LessonProgressRecord extends ProgressRecordBase {
  course_id: string;
  lesson_id: string;
  step_id: string;
  status: StepStatus;
  content_version: number;
}

/** A `quiz_attempts` record: one per answer, never changed. */
export interface QuizAttemptRecord extends ProgressRecordBase {
  lesson_id: string;
  question_id: string;
  option_id: string;
  correct: boolean;
  hints_used: number;
  content_version: number;
}

/** A `checklist_states` record: one per user, lesson and checklist (practice step). */
export interface ChecklistStateRecord extends ProgressRecordBase {
  lesson_id: string;
  checklist_id: string;
  /** Ids of the ticked items, in item order; PocketBase gives null for an empty json field. */
  checked: string[] | null;
}

/** An `interaction_results` record: one per finished game, never changed. */
export interface InteractionResultRecord extends ProgressRecordBase {
  lesson_id: string;
  interaction_id: string;
  /** The kind of interaction (`trace-game`, …). */
  kind: string;
  score: number;
  total: number;
  /** Json; PocketBase gives null for an empty json field. */
  detail: unknown;
  content_version: number;
}

/**
 * A `course_assignments` record: this child sees this course with `access: selected-children`.
 * Only the parent creates or deletes one; nobody changes one.
 */
export interface CourseAssignmentRecord {
  id: string;
  user: string;
  course_id: string;
  created: string;
  updated: string;
}
