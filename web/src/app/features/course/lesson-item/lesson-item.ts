import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { ManifestLesson } from '../../../core/content/content.types';
import type { LessonProgressSummary } from '../../../core/progress/course-progress';
import { plainText } from '../../../shared/inline-text/inline-markup';
import { COURSE_TEXT } from '../course-text';

/**
 * One lesson in the course overview: its number, the title (a link, unless it is planned), the
 * minutes and a label with text and sign. Without progress (`null`) a published lesson has no
 * label; a planned lesson always says "Komt nog".
 */
@Component({
  selector: 'snf-lesson-item',
  imports: [RouterLink],
  templateUrl: './lesson-item.html',
  styleUrl: './lesson-item.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LessonItem {
  readonly courseId = input.required<string>();
  readonly lesson = input.required<ManifestLesson>();
  readonly number = input.required<number>();
  readonly progress = input.required<LessonProgressSummary | null>();

  protected readonly text = COURSE_TEXT;
  protected readonly title = computed(() => plainText(this.lesson().title));
  protected readonly planned = computed(() => this.lesson().status !== 'published');
  protected readonly link = computed(() => ['/leren', this.courseId(), this.lesson().id]);
  protected readonly status = computed(() =>
    this.planned() ? 'planned' : (this.progress()?.status ?? null),
  );
}
