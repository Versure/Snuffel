import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

export interface StepNavItem {
  readonly id: string;
  readonly label: string;
}

export type StepNavStatus = 'open' | 'started' | 'done';

/** What a screen reader hears after the step name, and the visible status under the label. */
export const STEP_STATUS_TEXT: Record<
  StepNavStatus,
  { readonly spoken: string; readonly shown: string }
> = {
  open: { spoken: '', shown: '' },
  started: { spoken: ' (bezig)', shown: 'bezig' },
  done: { spoken: ' (klaar)', shown: 'klaar ✓' },
};

/** Prefix of the anchor of a step, so it never clashes with fixed anchors such as woordenlijst. */
export const STEP_ANCHOR_PREFIX = 'stap-';

/**
 * The steps of a lesson as numbered circles with a short label. Each one links to the anchor of
 * its step on the same page; `navigate` tells the page which step after a plain left click, so it
 * can move the focus.
 * A step in `done` gets a filled circle and "klaar ✓", a step in `started` a yellow circle and
 * "bezig": so a child sees at a glance which steps are still open. Colour is never the only sign.
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
  /** Steps that are begun but not done; a step in `done` as well counts as done. */
  readonly started = input<readonly string[]>([]);
  readonly navigate = output<string>();

  protected readonly doneIds = computed(() => new Set(this.done()));
  protected readonly startedIds = computed(() => new Set(this.started()));
  protected readonly anchorPrefix = STEP_ANCHOR_PREFIX;
  protected readonly statusText = STEP_STATUS_TEXT;

  protected status(stepId: string): StepNavStatus {
    if (this.doneIds().has(stepId)) return 'done';
    return this.startedIds().has(stepId) ? 'started' : 'open';
  }

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
