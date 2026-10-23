import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { LessonStep as LessonStepData } from '../../../core/content/content.types';
import { InteractionPlaceholder } from '../../../interactions/interaction-placeholder/interaction-placeholder';
import { Block } from '../../../shared/blocks/block/block';
import { InlineText } from '../../../shared/inline-text/inline-text/inline-text';
import { PracticeList } from '../../../shared/practice/practice-list/practice-list';
import { QuizPreview } from '../../../shared/quiz/quiz-preview/quiz-preview';
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
  imports: [Block, InlineText, InteractionPlaceholder, PracticeList, QuizPreview],
  templateUrl: './lesson-step.html',
  styleUrl: './lesson-step.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LessonStep {
  readonly step = input.required<LessonStepData>();
  readonly number = input.required<number>();

  protected readonly sectionId = computed(() => stepSectionId(this.step().id));
  protected readonly headingId = computed(() => stepHeadingId(this.step().id));
}
