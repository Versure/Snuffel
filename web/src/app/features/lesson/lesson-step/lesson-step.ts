import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import type { LessonStep as LessonStepData, LessonTed } from '../../../core/content/content.types';
import { InteractionHost } from '../../../interactions/interaction-host/interaction-host';
import { Block } from '../../../shared/blocks/block/block';
import { InlineText } from '../../../shared/inline-text/inline-text/inline-text';
import { LessonProgress } from '../../../shared/lesson-progress/lesson-progress';
import { Checklist } from '../../../shared/practice/checklist/checklist';
import { Quiz } from '../../../shared/quiz/quiz/quiz';
import { Seen } from '../../../shared/seen/seen';
import { STEP_ANCHOR_PREFIX } from '../../../shared/ui/step-nav/step-nav';

/** Milliseconds the end of an explanation has to stay in view before it counts as read. */
export const READ_DWELL_MS = 1000;

/** The id of the section of a step (its anchor) and of its heading. */
export function stepSectionId(stepId: string): string {
  return `${STEP_ANCHOR_PREFIX}${stepId}`;
}

export function stepHeadingId(stepId: string): string {
  return `${STEP_ANCHOR_PREFIX}${stepId}-titel`;
}

/**
 * One step of a lesson: a section with a numbered heading (focusable, so the step navigation and
 * an anchor can move the focus there) and the content for its type.
 */
@Component({
  selector: 'snf-lesson-step',
  imports: [Block, Checklist, InlineText, InteractionHost, Quiz, Seen],
  templateUrl: './lesson-step.html',
  styleUrl: './lesson-step.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LessonStep {
  private readonly progress = inject(LessonProgress, { optional: true });

  readonly step = input.required<LessonStepData>();
  readonly number = input.required<number>();
  /** Ted's lines of the lesson, for the quiz and the interaction. */
  readonly ted = input.required<LessonTed>();

  protected readonly sectionId = computed(() => stepSectionId(this.step().id));
  protected readonly headingId = computed(() => stepHeadingId(this.step().id));

  /**
   * How long the end of an explanation has to stay in view: scrolling past it with the step
   * navigation (smooth scrolling) is not reading.
   */
  protected readonly readDwell = READ_DWELL_MS;

  /** The end of an explanation stayed in view: read to the end, so the step is done. */
  protected onReadToEnd(): void {
    void this.progress?.markStep(this.step().id, 'completed');
  }
}
