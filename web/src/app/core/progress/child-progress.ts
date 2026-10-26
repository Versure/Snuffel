import type { InteractionStep, PracticeStep, QuizStep } from '../content/content.types';
import type { InteractionResultRecord, QuizAttemptRecord } from '../pocketbase/types';

/** What a child did in one quiz step, with the lesson as it is now. */
export interface QuizSummary {
  /** Questions whose latest answer (current version, existing option) is right. */
  readonly correct: number;
  /** Questions with a latest answer (current version, existing option). */
  readonly answered: number;
  /** Questions the step has now. */
  readonly questions: number;
  /** Every answer to a question of this step with the current version. */
  readonly answers: number;
  /** The hints of those answers, added up. */
  readonly hints: number;
}

/** The ticked items of one checklist that the lesson still has. */
export interface ChecklistSummary {
  readonly checked: number;
  readonly total: number;
}

/** The latest result of one interaction with the current version, and how often it was played. */
export interface InteractionSummary {
  readonly latest: { readonly score: number; readonly total: number } | null;
  /** Results of this interaction with the current version. */
  readonly plays: number;
}

/** The help a child used in a stepped exercise, read from `detail` (M10). */
export interface ExerciseHelp {
  /** Hints shown, over every exercise. */
  readonly hints: number;
  /** Exercises whose worked solution was shown. */
  readonly solutions: number;
  /** Exercises in the series. */
  readonly exercises: number;
}

/** Speed and the most missed keys of a typing drill, read from `detail` (M15). */
export interface TypingSummary {
  readonly keysPerMinute: number;
  /** The most missed keys as the app names them (`f`, `spatie`), most first, at most three. */
  readonly mistakes: readonly string[];
}

/** How many missed keys the parent sees, as on the end screen of the drill. */
const SHOWN_MISTAKES = 3;

/**
 * The newest `updated` of the records, or null without records. PocketBase dates
 * (`2026-10-23 12:05:00.000Z`) sort as text.
 */
export function lastActivity(records: readonly { readonly updated: string }[]): string | null {
  let newest: string | null = null;
  for (const record of records) {
    if (typeof record.updated !== 'string' || record.updated === '') continue;
    if (newest === null || record.updated > newest) newest = record.updated;
  }
  return newest;
}

/** Newest first by `created`, without relying on the order the records came in. */
function newestFirst<T extends { readonly created: string }>(records: readonly T[]): T[] {
  return [...records].sort((a, b) => (a.created < b.created ? 1 : a.created > b.created ? -1 : 0));
}

/**
 * Sums up a quiz step the way the quiz restores its answers after a reload (M8): per question
 * the latest answer with the current version counts, and only when its option still exists.
 * Right or wrong follows the lesson as it is now (`correctOptionId`).
 */
export function quizSummary(
  step: QuizStep,
  version: number,
  attempts: readonly QuizAttemptRecord[],
): QuizSummary {
  const questions = new Map(step.questions.map((question) => [question.id, question]));
  const current = newestFirst(attempts).filter(
    (attempt) => attempt.content_version === version && questions.has(attempt.question_id),
  );
  const latest = new Map<string, QuizAttemptRecord>();
  for (const attempt of current) {
    if (!latest.has(attempt.question_id)) latest.set(attempt.question_id, attempt);
  }
  let answered = 0;
  let correct = 0;
  for (const [questionId, attempt] of latest) {
    const question = questions.get(questionId);
    if (!question?.options.some((option) => option.id === attempt.option_id)) continue;
    answered += 1;
    if (attempt.option_id === question.correctOptionId) correct += 1;
  }
  const hints = current.reduce(
    (sum, attempt) =>
      sum + (Number.isFinite(attempt.hints_used) ? Math.max(0, attempt.hints_used) : 0),
    0,
  );
  return { correct, answered, questions: questions.size, answers: current.length, hints };
}

/** Counts the ticked items the practice step has now; a missing checklist counts zero. */
export function checklistSummary(
  step: PracticeStep,
  checked: readonly string[] | null,
): ChecklistSummary {
  const ticked = new Set(checked ?? []);
  return {
    checked: step.items.filter((item) => ticked.has(item.id)).length,
    total: step.items.length,
  };
}

/** The newest result of the interaction of this step with the current version, and the plays. */
export function interactionSummary(
  step: InteractionStep,
  version: number,
  results: readonly InteractionResultRecord[],
): InteractionSummary {
  const current = newestFirst(results).filter(
    (result) => result.interaction_id === step.interaction.id && result.content_version === version,
  );
  const newest = current[0];
  return {
    latest: newest ? { score: newest.score, total: newest.total } : null,
    plays: current.length,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Reads the help from the `detail` of a stepped-exercise result (`{ exercises: [{ hints,
 * solution, … }] }`, M10). Any other shape gives null, never an error.
 */
export function exerciseHelp(detail: unknown): ExerciseHelp | null {
  if (!isRecord(detail) || !Array.isArray(detail['exercises'])) return null;
  let hints = 0;
  let solutions = 0;
  for (const exercise of detail['exercises'] as unknown[]) {
    if (!isRecord(exercise)) return null;
    const shown = exercise['hints'];
    const solution = exercise['solution'];
    if (typeof shown !== 'number' || !Number.isFinite(shown) || shown < 0) return null;
    if (typeof solution !== 'boolean') return null;
    hints += shown;
    if (solution) solutions += 1;
  }
  return { hints, solutions, exercises: detail['exercises'].length };
}

/** The name of a key in a text, as in the typing drill: `spatie`, `Shift`, or the key itself. */
function keyName(key: string): string {
  if (key === 'space') return 'spatie';
  if (key === 'shift') return 'Shift';
  return key;
}

/**
 * Reads speed and the most missed keys from the `detail` of a typing-drill result
 * (`{ keysPerMinute, durationMs, mistakes: [{ key, count }] }`, M15). Any other shape gives null,
 * never an error.
 */
export function typingSummary(detail: unknown): TypingSummary | null {
  if (!isRecord(detail)) return null;
  const speed = detail['keysPerMinute'];
  const mistakes = detail['mistakes'];
  if (typeof speed !== 'number' || !Number.isFinite(speed) || speed < 0) return null;
  if (!Array.isArray(mistakes)) return null;
  const keys: string[] = [];
  for (const mistake of mistakes as unknown[]) {
    if (!isRecord(mistake)) return null;
    const key = mistake['key'];
    const count = mistake['count'];
    if (typeof key !== 'string' || key === '') return null;
    if (typeof count !== 'number' || !Number.isFinite(count) || count < 1) return null;
    keys.push(keyName(key));
  }
  return { keysPerMinute: Math.round(speed), mistakes: keys.slice(0, SHOWN_MISTAKES) };
}
