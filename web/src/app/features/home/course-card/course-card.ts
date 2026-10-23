import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { ManifestCourse } from '../../../core/content/content.types';
import type { CourseProgressSummary } from '../../../core/progress/course-progress';
import { ProgressBar } from '../../../shared/ui/progress-bar/progress-bar';
import { HOME_TEXT } from '../home-text';

/**
 * A course on the start page: one link to the course overview with the title, and the progress
 * bar when the progress is known (`null`: no bar, an empty bar would lie).
 */
@Component({
  selector: 'snf-course-card',
  imports: [ProgressBar, RouterLink],
  templateUrl: './course-card.html',
  styleUrl: './course-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CourseCard {
  readonly course = input.required<ManifestCourse>();
  readonly progress = input.required<CourseProgressSummary | null>();

  protected readonly link = computed(() => ['/leren', this.course().id]);
  protected readonly label = computed(() => {
    const progress = this.progress();
    return progress ? HOME_TEXT.lessonsCompleted(progress.completed, progress.total) : '';
  });
}
