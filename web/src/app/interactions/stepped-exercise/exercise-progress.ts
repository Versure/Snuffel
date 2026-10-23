// Progress within one series of a stepped exercise, as pure functions: when the worked solution
// may be shown, when an exercise is finished, and the result of a finished series.
import type { Exercise } from '../../core/content/content.types';
import type { InteractionResult } from '../interaction';
import type { AnswerOutcome } from './answer';

/** What the child did with one exercise in this series. */
export interface ExerciseProgress {
  /** Readable answers (empty and unreadable answers are no attempt). */
  readonly attempts: number;
  readonly hintsShown: number;
  /** The ids of the steps the child opened at least once. */
  readonly stepsOpened: ReadonlySet<string>;
  /** True once an answer was right. */
  readonly correct: boolean;
  /** True when the answer was right before the worked solution was shown ("zelf goed"). */
  readonly correctBeforeSolution: boolean;
  readonly solutionShown: boolean;
}

/** One exercise in `detail.exercises` of a stored result. */
export interface ExerciseDetail {
  readonly id: string;
  /** Right on its own, before the worked solution. */
  readonly correct: boolean;
  readonly attempts: number;
  readonly hints: number;
  readonly steps: number;
  readonly solution: boolean;
}

export const NO_PROGRESS: ExerciseProgress = {
  attempts: 0,
  hintsShown: 0,
  stepsOpened: new Set(),
  correct: false,
  correctBeforeSolution: false,
  solutionShown: false,
};

/** True when the outcome counts as an attempt (a readable answer). */
export function isAttempt(outcome: AnswerOutcome): boolean {
  return outcome === 'correct' || outcome === 'mistake' || outcome === 'wrong';
}

/** The progress after an answer with this outcome. */
export function afterAnswer(progress: ExerciseProgress, outcome: AnswerOutcome): ExerciseProgress {
  if (!isAttempt(outcome)) return progress;
  const right = outcome === 'correct';
  return {
    ...progress,
    attempts: progress.attempts + 1,
    correct: progress.correct || right,
    correctBeforeSolution: progress.correctBeforeSolution || (right && !progress.solutionShown),
  };
}

/** The progress after asking the next hint (never more than the exercise has). */
export function afterHint(progress: ExerciseProgress, exercise: Exercise): ExerciseProgress {
  return { ...progress, hintsShown: Math.min(progress.hintsShown + 1, exercise.hints.length) };
}

/** The progress after opening step `id`. */
export function afterStepOpened(progress: ExerciseProgress, id: string): ExerciseProgress {
  if (progress.stepsOpened.has(id)) return progress;
  return { ...progress, stepsOpened: new Set([...progress.stepsOpened, id]) };
}

/** The progress after opening the worked solution. */
export function afterSolution(progress: ExerciseProgress): ExerciseProgress {
  return { ...progress, solutionShown: true };
}

/**
 * True when the worked solution may be shown: after a right answer, or after an own attempt
 * and all hints (without hints: after one attempt).
 */
export function solutionAvailable(progress: ExerciseProgress, exercise: Exercise): boolean {
  if (progress.correct) return true;
  return progress.attempts >= 1 && progress.hintsShown >= exercise.hints.length;
}

/** True when the exercise is done: right, or its worked solution is shown. */
export function isFinished(progress: ExerciseProgress): boolean {
  return progress.correct || progress.solutionShown;
}

/**
 * The result of a finished series: `score` is the number of exercises that were right on their
 * own (before the worked solution), `total` the number of exercises, and `detail.exercises` per
 * exercise what the child did. What the child typed is not stored.
 */
export function seriesResult(
  exercises: readonly Exercise[],
  progresses: readonly ExerciseProgress[],
): InteractionResult {
  const details: ExerciseDetail[] = exercises.map((exercise, index) => {
    const progress = progresses[index] ?? NO_PROGRESS;
    return {
      id: exercise.id,
      correct: progress.correctBeforeSolution,
      attempts: progress.attempts,
      hints: progress.hintsShown,
      steps: progress.stepsOpened.size,
      solution: progress.solutionShown,
    };
  });
  return {
    score: details.filter((detail) => detail.correct).length,
    total: exercises.length,
    detail: { exercises: details },
  };
}
