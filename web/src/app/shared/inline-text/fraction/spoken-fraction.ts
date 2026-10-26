// What a screen reader says for a fraction: digits with the denominator as an ordinal, the way a
// teacher says it ("1 vijfde", "3 halve", "1 en 1 vierde"). The screen reader speaks the digits
// itself. A denominator of 1 is "hele" ("3 hele"); a denominator without a common word is read as
// a division ("3 gedeeld door 37").

export interface SpokenFractionParts {
  readonly numerator: string;
  readonly denominator: string;
  /** Only in a mixed number. */
  readonly whole?: string;
  /** A minus before the fraction (only in a typed answer; lesson text writes it as text). */
  readonly negative?: boolean;
}

const ORDINALS: Readonly<Record<number, string>> = {
  3: 'derde',
  4: 'vierde',
  5: 'vijfde',
  6: 'zesde',
  7: 'zevende',
  8: 'achtste',
  9: 'negende',
  10: 'tiende',
  11: 'elfde',
  12: 'twaalfde',
  13: 'dertiende',
  14: 'veertiende',
  15: 'vijftiende',
  16: 'zestiende',
  17: 'zeventiende',
  18: 'achttiende',
  19: 'negentiende',
  20: 'twintigste',
  30: 'dertigste',
  40: 'veertigste',
  50: 'vijftigste',
  60: 'zestigste',
  70: 'zeventigste',
  80: 'tachtigste',
  90: 'negentigste',
  100: 'honderdste',
  1000: 'duizendste',
};

/** The fraction in words for a screen reader, for example "1 vijfde" or "min 1 en 1 half". */
export function spokenFraction({
  numerator,
  denominator,
  whole,
  negative = false,
}: SpokenFractionParts): string {
  const value = Number(denominator);
  let fraction: string;
  if (value === 1) {
    fraction = `${numerator} hele`;
  } else if (value === 2) {
    fraction = `${numerator} ${Number(numerator) === 1 ? 'half' : 'halve'}`;
  } else if (ORDINALS[value] !== undefined) {
    fraction = `${numerator} ${ORDINALS[value]}`;
  } else {
    fraction = `${numerator} gedeeld door ${denominator}`;
  }
  const number = whole === undefined ? fraction : `${whole} en ${fraction}`;
  return negative ? `min ${number}` : number;
}
