import { ChangeDetectionStrategy, Component, computed, inject, resource } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { isContentError } from '../../core/content/content-error';
import { ContentService } from '../../core/content/content.service';
import type { ManifestCourse } from '../../core/content/content.types';
import {
  courseProgress,
  type CourseProgressSummary,
  type StepStatuses,
} from '../../core/progress/course-progress';
import { ProgressService } from '../../core/progress/progress.service';
import { Button } from '../../shared/ui/button/button';
import { TedSays } from '../../shared/ui/ted-says/ted-says';
import { CourseCard } from './course-card/course-card';
import { HOME_TEXT } from './home-text';

export interface HomeSection {
  readonly id: 'courses' | 'practice';
  readonly heading: string;
  readonly courses: readonly ManifestCourse[];
}

export type HomeContentState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly sections: readonly HomeSection[] }
  | { readonly kind: 'empty' }
  | { readonly kind: 'unavailable' }
  | { readonly kind: 'unsupported-version' };

export type HomeProgressState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly statuses: StepStatuses }
  | { readonly kind: 'unavailable' };

const byTitle = (a: ManifestCourse, b: ManifestCourse) => a.title.localeCompare(b.title, 'nl');

/**
 * The start page (`/`): Ted greets whoever is logged in, and every course and practice course
 * of the manifest is a card with the progress of the logged-in user. The content (the shared
 * manifest) and the progress (one request) load separately, so a progress failure still shows
 * the courses.
 */
@Component({
  selector: 'snf-home',
  imports: [Button, CourseCard, TedSays],
  templateUrl: './home.html',
  styleUrl: './home.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Home {
  private readonly content = inject(ContentService);
  private readonly progress = inject(ProgressService);
  protected readonly user = inject(AuthService).user;
  protected readonly text = HOME_TEXT;

  private readonly manifest = resource({
    loader: () => this.content.loadManifest(),
  });

  /** Only the id: a renewed session of the same user is not a reason to load again. */
  private readonly userId = computed(() => this.user()?.id);
  private readonly statuses = resource({
    params: () => {
      const userId = this.userId();
      return userId ? { userId } : undefined;
    },
    loader: ({ params }) => this.progress.loadStepStatuses(params.userId),
  });

  protected readonly contentState = computed((): HomeContentState => {
    if (this.manifest.isLoading()) return { kind: 'loading' };
    if (!this.manifest.hasValue()) {
      const error = this.manifest.error();
      return isContentError(error) && error.reason === 'unsupported-version'
        ? { kind: 'unsupported-version' }
        : { kind: 'unavailable' };
    }
    const courses = this.manifest.value().courses;
    if (courses.length === 0) return { kind: 'empty' };
    const sections: HomeSection[] = [
      {
        id: 'courses',
        heading: HOME_TEXT.courses,
        courses: courses.filter((course) => course.kind === 'course').sort(byTitle),
      },
      {
        id: 'practice',
        heading: HOME_TEXT.practice,
        courses: courses.filter((course) => course.kind === 'practice').sort(byTitle),
      },
    ];
    return { kind: 'ready', sections: sections.filter((section) => section.courses.length > 0) };
  });

  protected readonly progressState = computed((): HomeProgressState => {
    // While (re)loading, never show the progress of before (it may be another user's).
    if (this.statuses.isLoading()) return { kind: 'loading' };
    if (this.statuses.hasValue()) return { kind: 'ready', statuses: this.statuses.value() };
    return this.statuses.status() === 'error' ? { kind: 'unavailable' } : { kind: 'loading' };
  });

  protected progressOf(course: ManifestCourse): CourseProgressSummary | null {
    const state = this.progressState();
    return state.kind === 'ready' ? courseProgress(course, state.statuses) : null;
  }

  protected retryContent(): void {
    this.manifest.reload();
  }

  protected retryProgress(): void {
    this.statuses.reload();
  }
}
