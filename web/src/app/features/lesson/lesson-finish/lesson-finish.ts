import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { InlineText } from '../../../shared/inline-text/inline-text/inline-text';
import { STEP_ANCHOR_PREFIX } from '../../../shared/ui/step-nav/step-nav';
import { TedSays } from '../../../shared/ui/ted-says/ted-says';

/** A step of the lesson as the end of the lesson lists it. */
export interface LessonFinishStep {
  readonly id: string;
  /** The short label from the step navigation ("Oefenen"). */
  readonly label: string;
  /** The title of the step (lesson text with inline markup). */
  readonly title: string;
}

export const LESSON_FINISH_TEXT = {
  notYet: 'Nog niet af:',
  started: 'bezig',
  open: 'nog niet begonnen',
} as const;

/**
 * The end of a lesson, after the last step: Ted's `finished` line, and when the progress is known
 * and steps are not done yet, a list of them with a link to each, so a step that is easy to miss
 * (the next exercise of a series, a quiz further down) is never overlooked. Works the same for
 * every lesson: it only uses the steps and their status.
 */
@Component({
  selector: 'snf-lesson-finish',
  imports: [InlineText, RouterLink, TedSays],
  templateUrl: './lesson-finish.html',
  styleUrl: './lesson-finish.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LessonFinish {
  readonly steps = input.required<readonly LessonFinishStep[]>();
  readonly done = input<readonly string[]>([]);
  readonly started = input<readonly string[]>([]);
  /** False while the progress is loading or unavailable: then nothing is said about open steps. */
  readonly known = input(false);
  /** Ted's line for a finished lesson. */
  readonly finished = input.required<string>();
  readonly navigate = output<string>();

  protected readonly text = LESSON_FINISH_TEXT;
  protected readonly anchorPrefix = STEP_ANCHOR_PREFIX;

  /** The steps that are not done, with their number in the lesson. */
  protected readonly openSteps = computed(() => {
    if (!this.known()) return [];
    const done = new Set(this.done());
    const started = new Set(this.started());
    return this.steps()
      .map((step, index) => ({ ...step, number: index + 1, started: started.has(step.id) }))
      .filter((step) => !done.has(step.id));
  });

  /** Only a plain left click moves on this page, as in the step navigation. */
  protected onClick(event: MouseEvent, stepId: string): void {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
      return;
    }
    this.navigate.emit(stepId);
  }
}
