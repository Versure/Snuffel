import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { LessonStep as LessonStepData, LessonTed } from '../../../core/content/content.types';
import { InteractionPlaceholder } from '../../../interactions/interaction-placeholder/interaction-placeholder';
import { Block } from '../../../shared/blocks/block/block';
import { InlineText } from '../../../shared/inline-text/inline-text/inline-text';
import { Checklist } from '../../../shared/practice/checklist/checklist';
import { Quiz } from '../../../shared/quiz/quiz/quiz';
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
  imports: [Block, Checklist, InlineText, InteractionPlaceholder, Quiz],
  templateUrl: './lesson-step.html',
  styleUrl: './lesson-step.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LessonStep {
  readonly step = input.required<LessonStepData>();
  readonly number = input.required<number>();
  /** Ted's lines of the lesson, for the quiz. */
  readonly ted = input.required<LessonTed>();

  protected readonly sectionId = computed(() => stepSectionId(this.step().id));
  protected readonly headingId = computed(() => stepHeadingId(this.step().id));
}
