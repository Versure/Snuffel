// The logic of a typing drill, without Angular: one key press at a time on the cursor, right or
// wrong, the cursor always moves on ("keep typing", plan M15 question 6), and after the last line
// the result with accuracy, speed and the most missed keys (question 1 and 7).
import type { TypingGoals, TypingKey } from '../../core/content/content.types';
import type { InteractionResult } from '../interaction';
import { keyForChar } from './keyboard-layout';

/** The state of one char of a line. */
export type CharMark = 'pending' | 'correct' | 'wrong';

/** A drill in progress; every function returns a new state. */
export interface DrillState {
  /** The chars of every line. */
  readonly lines: readonly (readonly string[])[];
  /** The line of the cursor (equals `lines.length` when finished). */
  readonly line: number;
  /** The char of the cursor in its line. */
  readonly position: number;
  /** Per line per char: still to type, typed right or typed wrong. */
  readonly marks: readonly (readonly CharMark[])[];
  /** The time (ms, from the CLOCK) of every key press, in order. */
  readonly times: readonly number[];
  /** Right key presses. */
  readonly correct: number;
  /** Per key id (`a`, `space`; a mistake on `A` counts for `a`) how often it went wrong. */
  readonly mistakes: Readonly<Partial<Record<TypingKey, number>>>;
  readonly finished: boolean;
}

/** A key that went wrong and how often, as stored in `detail.mistakes`. */
export interface KeyMistake {
  readonly key: TypingKey;
  readonly count: number;
}

/** What is stored in `detail` (never the typed text). */
export interface DrillDetail {
  readonly keysPerMinute: number;
  readonly durationMs: number;
  readonly mistakes: readonly KeyMistake[];
}

/** A pause between two key presses counts at most this long. */
export const MAX_PAUSE_MS = 5000;
/** The measured time is at least this long. */
export const MIN_DURATION_MS = 1000;
/** At most this many keys in `detail.mistakes`. */
export const MAX_MISTAKES = 10;

export function startDrill(lines: readonly string[]): DrillState {
  const chars = lines.map((line) => [...line]);
  return {
    lines: chars,
    line: 0,
    position: 0,
    marks: chars.map((line) => line.map((): CharMark => 'pending')),
    times: [],
    correct: 0,
    mistakes: {},
    finished: chars.length === 0,
  };
}

/** The char under the cursor, or null when the drill is finished. */
export function expectedChar(state: DrillState): string | null {
  if (state.finished) return null;
  return state.lines[state.line]?.[state.position] ?? null;
}

/**
 * One key press at `time`: right or wrong on the cursor, and the cursor moves on either way. At
 * the end of a line the next line starts; after the last line the drill is finished and further
 * chars are ignored.
 */
export function typeChar(state: DrillState, char: string, time: number): DrillState {
  const expected = expectedChar(state);
  if (expected === null) return state;
  const right = char === expected;
  const marks = state.marks.map((line, index) =>
    index === state.line
      ? line.map((mark, position) =>
          position === state.position ? (right ? 'correct' : 'wrong') : mark,
        )
      : line,
  );
  let mistakes = state.mistakes;
  if (!right) {
    const key = keyForChar(expected)?.key;
    if (key) mistakes = { ...mistakes, [key]: (mistakes[key] ?? 0) + 1 };
  }
  const endOfLine = state.position + 1 >= (state.lines[state.line]?.length ?? 0);
  const line = endOfLine ? state.line + 1 : state.line;
  return {
    ...state,
    marks,
    mistakes,
    times: [...state.times, time],
    correct: state.correct + (right ? 1 : 0),
    line,
    position: endOfLine ? 0 : state.position + 1,
    finished: line >= state.lines.length,
  };
}

/** All key presses so far. */
export function keyCount(state: DrillState): number {
  return state.times.length;
}

/**
 * The measured time from the first to the last key press: every pause counts at most
 * MAX_PAUSE_MS, and the whole at least MIN_DURATION_MS. In whole ms.
 */
export function drillDuration(times: readonly number[]): number {
  let duration = 0;
  for (let index = 1; index < times.length; index++) {
    duration += Math.min(Math.max((times[index] ?? 0) - (times[index - 1] ?? 0), 0), MAX_PAUSE_MS);
  }
  return Math.round(Math.max(duration, MIN_DURATION_MS));
}

/** Right key presses per minute over the measured time, a whole number. */
export function keysPerMinute(correct: number, times: readonly number[]): number {
  return Math.round((correct * 60000) / drillDuration(times));
}

/** The most missed keys, most first (equal counts by key id), at most `max`. */
export function topMistakes(
  counts: Readonly<Partial<Record<TypingKey, number>>>,
  max = MAX_MISTAKES,
): KeyMistake[] {
  return (Object.entries(counts) as [TypingKey, number][])
    .filter(([, count]) => count > 0)
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    .slice(0, max);
}

/** The result of a finished drill: `score` right keys of `total` keys, and the detail. */
export function drillResult(state: DrillState): InteractionResult & { detail: DrillDetail } {
  return {
    score: state.correct,
    total: keyCount(state),
    // A literal, so it is both a DrillDetail and an InteractionDetail (a record).
    detail: {
      keysPerMinute: keysPerMinute(state.correct, state.times),
      durationMs: drillDuration(state.times),
      mistakes: topMistakes(state.mistakes),
    },
  };
}

/** True when every given goal is reached; without goals nothing is required. */
export function goalsMet(
  scores: { readonly accuracy: number; readonly keysPerMinute: number },
  goals: TypingGoals | undefined,
): boolean {
  if (!goals) return true;
  if (goals.accuracy !== undefined && scores.accuracy < goals.accuracy) return false;
  if (goals.keysPerMinute !== undefined && scores.keysPerMinute < goals.keysPerMinute) {
    return false;
  }
  return true;
}
