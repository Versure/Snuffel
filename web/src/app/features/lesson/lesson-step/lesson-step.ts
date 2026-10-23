import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import type { LessonStep as LessonStepData, LessonTed } from '../../../core/content/content.types';
import { InteractionPlaceholder } from '../../../interactions/interaction-placeholder/interaction-placeholder';
import { Block } from '../../../shared/blocks/block/block';
import { InlineText } from '../../../shared/inline-text/inline-text/inline-text';
import { LessonProgress } from '../../../shared/lesson-progress/lesson-progress';
import { Checklist } from '../../../shared/practice/checklist/checklist';
import { Quiz } from '../../../shared/quiz/quiz/quiz';
import { Seen } from '../../../shared/seen/seen';
import { STEP_ANCHOR_PREFIX } from '../../../shared/ui/step-nav/step-nav';

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
  imports: [Block, Checklist, InlineText, InteractionPlaceholder, Quiz, Seen],
  templateUrl: './lesson-step.html',
  styleUrl: './lesson-step.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LessonStep {
  private readonly progress = inject(LessonProgress, { optional: true });

  readonly step = input.required<LessonStepData>();
  readonly number = input.required<number>();
  /** Ted's lines of the lesson, for the quiz. */
  readonly ted = input.required<LessonTed>();

  protected readonly sectionId = computed(() => stepSectionId(this.step().id));
  protected readonly headingId = computed(() => stepHeadingId(this.step().id));

  /** The end of an explanation came into view: read to the end, so the step is done. */
  protected onReadToEnd(): void {
    void this.progress?.markStep(this.step().id, 'completed');
  }
}
