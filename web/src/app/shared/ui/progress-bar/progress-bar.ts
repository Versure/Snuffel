import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * A progress bar with a visible label underneath (also the aria-valuetext), for example
 * "1 van 2 lessen klaar". The bar has a short fixed name ("Voortgang"), so a screen reader
 * says the label once, as the value. No animation.
 */
@Component({
  selector: 'snf-progress-bar',
  templateUrl: './progress-bar.html',
  styleUrl: './progress-bar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProgressBar {
  /** Done so far; clamped between 0 and max. */
  readonly value = input.required<number>();
  /** At least 1. */
  readonly max = input.required<number>();
  /** The text under the bar and the aria-valuetext. */
  readonly label = input.required<string>();
  /** The accessible name of the bar; the label is its value text, not its name. */
  readonly name = input('Voortgang');

  protected readonly safeMax = computed(() => Math.max(1, Math.round(this.max())));
  protected readonly safeValue = computed(() =>
    Math.min(this.safeMax(), Math.max(0, Math.round(this.value()))),
  );
  protected readonly percent = computed(() => (this.safeValue() / this.safeMax()) * 100);
}
