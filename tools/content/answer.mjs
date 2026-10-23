// How the answer of a child to a stepped-exercise is read and compared.
//
// The app (web/src/app/interactions/stepped-exercise/answer.ts) has the same rules; both are
// tested against content/schema/v1/answer-matching.cases.json. content:check uses them to find
// common mistakes that would count as right or can never be recognised. A change starts with a
// new case in that file.
import { plainText } from './text.mjs';

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
export function parseNumber(input, unit) {
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
export function normalizeText(text) {
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
function near(a, b, tolerance) {
  return Math.abs(a - b) <= tolerance + NUMBER_MARGIN;
}

/**
 * Checks an answer (for a choice the id of the chosen option) against `answer` and its common
 * mistakes: `{ outcome: 'empty' | 'unreadable' | 'correct' | 'mistake' | 'wrong', feedback? }`.
 * Right is checked first; then the first common mistake that matches gives its feedback.
 */
export function checkAnswer(answer, input, mistakes) {
  const found = (match) => {
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
    default:
      return { outcome: 'wrong' };
  }
}
