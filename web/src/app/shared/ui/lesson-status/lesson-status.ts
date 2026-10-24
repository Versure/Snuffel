import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { LessonStatus } from '../../../core/progress/course-progress';
import { LESSON_STATUS_TEXT } from './lesson-status-text';

/**
 * The status of a lesson as a label with text and sign: "Klaar ✓", "Bezig: 2 van 4 stappen
 * klaar", "Nieuw" or "Komt nog". Colour is never the only sign: the text says it.
 */
@Component({
  selector: 'snf-lesson-status',
  templateUrl: './lesson-status.html',
  styleUrl: './lesson-status.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LessonStatusLabel {
  readonly status = input.required<LessonStatus>();
  /** Completed steps (only shown for a started lesson). */
  readonly done = input(0);
  /** Steps of the lesson (only shown for a started lesson). */
  readonly total = input(0);

  protected readonly text = LESSON_STATUS_TEXT;
}
