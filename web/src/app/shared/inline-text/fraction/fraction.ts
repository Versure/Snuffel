import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { spokenFraction } from './spoken-fraction';

/**
 * A stacked fraction (numerator above denominator) in the font and colour of the text around
 * it, as MathML. A screen reader reads visually hidden words ("1 vijfde"); the MathML itself is
 * hidden from it, because MathML support differs too much between screen readers (plan M14,
 * questions 2 and 3).
 */
@Component({
  selector: 'snf-fraction',
  templateUrl: './fraction.html',
  styleUrl: './fraction.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Fraction {
  /** Digits as written. */
  readonly numerator = input.required<string>();
  readonly denominator = input.required<string>();
  /** The whole number of a mixed number. */
  readonly whole = input<string | undefined>(undefined);
  /** A minus before the number (a typed answer such as -1/2). */
  readonly negative = input(false);

  protected readonly spoken = computed(() =>
    spokenFraction({
      numerator: this.numerator(),
      denominator: this.denominator(),
      whole: this.whole(),
      negative: this.negative(),
    }),
  );
}
