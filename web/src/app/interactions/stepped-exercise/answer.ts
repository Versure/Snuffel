// How the answer of a child to a stepped exercise is read and compared.
//
// A port of tools/content/answer.mjs (used by content:check) with the same rules; both are tested
// against content/schema/v1/answer-matching.cases.json. A change starts with a new case there.
import type { CommonMistake, ExerciseAnswer } from '../../core/content/content.types';
import { plainText } from '../../shared/inline-text/inline-markup';

/** What an answer of the child is. Empty and unreadable answers are no attempt. */
export type AnswerOutcome = 'empty' | 'unreadable' | 'correct' | 'mistake' | 'wrong';

export interface AnswerCheck {
  readonly outcome: AnswerOutcome;
  /** The feedback of the common mistake that was recognised (outcome `mistake`). */
  readonly feedback?: string;
}

/** A small margin against rounding errors of the computer (0.1 + 0.2). */
export const NUMBER_MARGIN = 1e-9;

const DECIMAL = /^(-?)\s*(\d+(?:[.,]\d+)?)$/;
const FRACTION = /^(-?)\s*(?:(\d+)\s+)?(\d+)\s*\/\s*(\d+)$/;

/**
 * Reads what the child typed as a number: a decimal with a comma or a point, a fraction (`3/4`)
 * or a mixed number (`1 1/4`), with a minus (`-` or `−`) and, when the answer has a unit, that
 * unit after it (capitals do not count). No thousands separator: `1.000` is one. Null when it is
 * no number (empty, letters, two decimal separators, another unit, a division by zero).
 */
export function parseNumber(input: string, unit?: string): number | null {
  let text = input.trim().replace(/−/g, '-');
  const shownUnit = unit === undefined ? '' : plainText(unit).trim().toLocaleLowerCase('nl');
  if (shownUnit && text.toLocaleLowerCase('nl').endsWith(shownUnit)) {
    text = text.slice(0, text.length - shownUnit.length).trimEnd();
  }
  const decimal = DECIMAL.exec(text);
  if (decimal) {
    const value = Number(decimal[2].replace(',', '.'));
    return decimal[1] ? -value : value;
  }
  const fraction = FRACTION.exec(text);
  if (fraction) {
    const whole = fraction[2] === undefined ? 0 : Number(fraction[2]);
    const denominator = Number(fraction[4]);
    if (denominator === 0) return null;
    const value = whole + Number(fraction[3]) / denominator;
    return fraction[1] ? -value : value;
  }
  return null;
}

/**
 * Makes a text answer (of the child or from the content) comparable: markup out, spaces at the
 * ends out, more spaces become one, no spaces around a slash, capitals do not count, curly quotes
 * and apostrophes become straight ones, one full stop at the end does not count. Accents count.
 */
export function normalizeText(text: string): string {
  const plain = plainText(text)
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .replace(/ ?\/ ?/g, '/')
    .trim()
    .toLocaleLowerCase('nl');
  return (plain.endsWith('.') ? plain.slice(0, -1) : plain).trim();
}

/** True when two numbers are at most `tolerance` apart (the edge counts, plus the margin). */
function near(a: number, b: number, tolerance: number): boolean {
  return Math.abs(a - b) <= tolerance + NUMBER_MARGIN;
}

/**
 * Checks the answer of the child (for a choice the id of the chosen option). Right is checked
 * first; then the first common mistake that matches gives its feedback.
 */
export function checkAnswer(
  answer: ExerciseAnswer,
  input: string,
  mistakes: readonly CommonMistake[],
): AnswerCheck {
  const found = (match: (mistake: CommonMistake) => boolean): AnswerCheck => {
    const mistake = mistakes.find(match);
    return mistake ? { outcome: 'mistake', feedback: mistake.feedback } : { outcome: 'wrong' };
  };
  switch (answer.type) {
    case 'number': {
      if (input.trim() === '') return { outcome: 'empty' };
      const value = parseNumber(input, answer.unit);
      if (value === null) return { outcome: 'unreadable' };
      if (near(value, answer.value, answer.tolerance)) return { outcome: 'correct' };
      return found((mistake) => {
        const wrong = parseNumber(mistake.answer, answer.unit);
        return wrong !== null && near(value, wrong, answer.tolerance);
      });
    }
    case 'text': {
      const text = normalizeText(input);
      if (text === '') return { outcome: 'empty' };
      if (answer.accepted.some((form) => normalizeText(form) === text)) {
        return { outcome: 'correct' };
      }
      return found((mistake) => normalizeText(mistake.answer) === text);
    }
    case 'choice': {
      const id = input.trim();
      if (id === '') return { outcome: 'empty' };
      if (id === answer.correctOptionId) return { outcome: 'correct' };
      return found((mistake) => mistake.answer.trim() === id);
    }
  }
}
