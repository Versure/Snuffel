import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

export interface StepNavItem {
  readonly id: string;
  readonly label: string;
}

/** Prefix of the anchor of a step, so it never clashes with fixed anchors such as woordenlijst. */
export const STEP_ANCHOR_PREFIX = 'stap-';

/**
 * The steps of a lesson as numbered circles with a short label. Each one links to the anchor of
 * its step on the same page; `navigate` tells the page which step after a plain left click, so it
 * can move the focus.
 * A step in `done` gets a filled circle (filled from M8 on).
 */
@Component({
  selector: 'snf-step-nav',
  imports: [RouterLink],
  templateUrl: './step-nav.html',
  styleUrl: './step-nav.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StepNav {
  readonly steps = input.required<readonly StepNavItem[]>();
  readonly done = input<readonly string[]>([]);
  readonly navigate = output<string>();

  protected readonly doneIds = computed(() => new Set(this.done()));
  protected readonly anchorPrefix = STEP_ANCHOR_PREFIX;

  /**
   * Only a plain left click moves on this page. A click with ctrl, meta, shift or alt (open in a
   * new tab or window, download) leaves the page as it is, just like RouterLink does.
   */
  protected onClick(event: MouseEvent, stepId: string): void {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
      return;
    }
    this.navigate.emit(stepId);
  }
}
