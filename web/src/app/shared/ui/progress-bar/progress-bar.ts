import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

let nextId = 0;

/**
 * A progress bar with a visible label underneath (also the aria-valuetext), for example
 * "1 van 2 lessen klaar". No animation.
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

  /** The bar is named by the label underneath (read once, as the name and the value text). */
  protected readonly labelId = `snf-progress-${nextId++}`;

  protected readonly safeMax = computed(() => Math.max(1, Math.round(this.max())));
  protected readonly safeValue = computed(() =>
    Math.min(this.safeMax(), Math.max(0, Math.round(this.value()))),
  );
  protected readonly percent = computed(() => (this.safeValue() / this.safeMax()) * 100);
}
