import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  resource,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { CourseAccessService } from '../../core/access/course-access.service';
import { AuthService } from '../../core/auth/auth.service';
import { isContentError } from '../../core/content/content-error';
import { ContentService } from '../../core/content/content.service';
import type { Course as CourseData, ManifestCourse } from '../../core/content/content.types';
import {
  courseProgress,
  lessonProgress,
  nextLesson,
  type LessonProgressSummary,
  type StepStatuses,
} from '../../core/progress/course-progress';
import { ProgressService } from '../../core/progress/progress.service';
import { InlineText } from '../../shared/inline-text/inline-text/inline-text';
import { plainText } from '../../shared/inline-text/inline-markup';
import { Button } from '../../shared/ui/button/button';
import { ProgressBar } from '../../shared/ui/progress-bar/progress-bar';
import { TedSays } from '../../shared/ui/ted-says/ted-says';
import { COURSE_TEXT } from './course-text';
import { LessonItem } from './lesson-item/lesson-item';

export type CourseState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'loaded'; readonly course: CourseData; readonly entry: ManifestCourse }
  | { readonly kind: 'not-found' }
  | { readonly kind: 'unavailable' }
  | { readonly kind: 'unsupported-version' };

type LoadResult = Exclude<CourseState, { kind: 'loading' }>;

type ProgressState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly statuses: StepStatuses }
  | { readonly kind: 'unavailable' };

/**
 * The course overview (`/leren/:courseId`): Ted with the greeting of the course, its goal, the
 * progress of the logged-in user, a button to the next lesson and every lesson with its status.
 * The lessons come from the manifest, in the order of course.json (content:build keeps it).
 */
@Component({
  selector: 'snf-course',
  imports: [Button, InlineText, LessonItem, ProgressBar, RouterLink, TedSays],
  templateUrl: './course.html',
  styleUrl: './course.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Course {
  private readonly route = inject(ActivatedRoute);
  private readonly content = inject(ContentService);
  private readonly progress = inject(ProgressService);
  private readonly title = inject(Title);
  private readonly auth = inject(AuthService);
  private readonly access = inject(CourseAccessService);
  protected readonly text = COURSE_TEXT;

  private readonly courseId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('courseId') ?? '')),
    { requireSync: true },
  );

  private readonly loader = resource({
    params: () => ({ courseId: this.courseId() }),
    loader: ({ params }) => this.load(params.courseId),
  });

  protected readonly state = computed((): CourseState => {
    if (this.loader.isLoading()) return { kind: 'loading' };
    return this.loader.hasValue() ? this.loader.value() : { kind: 'unavailable' };
  });

  /** The progress of the logged-in user in this course, after the course has loaded. */
  private readonly progressTarget = computed(
    () => {
      const state = this.state();
      const userId = this.auth.user()?.id;
      if (state.kind !== 'loaded' || !userId) return undefined;
      return { userId, courseId: state.entry.id };
    },
    // A renewed session of the same user is not a reason to load again.
    { equal: (a, b) => a?.userId === b?.userId && a?.courseId === b?.courseId },
  );
  private readonly statuses = resource({
    params: () => this.progressTarget(),
    loader: ({ params }) => this.progress.loadStepStatuses(params.userId, params.courseId),
  });

  protected readonly progressState = computed((): ProgressState => {
    // While (re)loading, never show the progress of before (it may be another user's).
    if (this.statuses.isLoading()) return { kind: 'loading' };
    if (this.statuses.hasValue()) return { kind: 'ready', statuses: this.statuses.value() };
    return this.statuses.status() === 'error' ? { kind: 'unavailable' } : { kind: 'loading' };
  });

  /** Everything that depends on the progress; null while it is unknown. */
  protected readonly overview = computed(() => {
    const state = this.state();
    const progress = this.progressState();
    if (state.kind !== 'loaded' || progress.kind !== 'ready') return null;
    const { entry } = state;
    const summary = courseProgress(entry, progress.statuses);
    const next = nextLesson(entry, progress.statuses);
    const anyPublished = entry.lessons.some((lesson) => lesson.status === 'published');
    return {
      summary,
      label: COURSE_TEXT.lessonsCompleted(summary.completed, summary.total),
      next: next ? { ...next, title: plainText(next.lesson.title) } : null,
      allDone: next === null && anyPublished,
      lessons: new Map<string, LessonProgressSummary>(
        entry.lessons.map((lesson) => [lesson.id, lessonProgress(lesson, progress.statuses)]),
      ),
    };
  });

  /** subject · schoolLevel · chapter of a practice course (what there is). */
  protected readonly practiceLine = computed(() => {
    const state = this.state();
    if (state.kind !== 'loaded' || state.course.kind !== 'practice') return '';
    const { subject, schoolLevel, chapter } = state.course;
    return [subject, schoolLevel, chapter]
      .filter((part): part is string => !!part)
      .map(plainText)
      .join(' · ');
  });

  protected readonly heading = computed(() => {
    const state = this.state();
    return state.kind === 'loaded' ? plainText(state.course.title) : '';
  });

  protected readonly pageTitle = computed(() => {
    const state = this.state();
    switch (state.kind) {
      case 'loaded':
        return COURSE_TEXT.pageTitle(plainText(state.course.title));
      case 'not-found':
        return COURSE_TEXT.notFoundTitle;
      default:
        return COURSE_TEXT.defaultTitle;
    }
  });

  constructor() {
    // The document title lives outside the Angular templates.
    effect(() => this.title.setTitle(this.pageTitle()));
  }

  protected retry(): void {
    this.loader.reload();
  }

  protected retryProgress(): void {
    this.statuses.reload();
  }

  /**
   * First the manifest and whether the logged-in user may see the course; only then the course
   * itself. A course that is not for this child looks exactly like an unknown course, and its
   * course.json is never fetched.
   */
  private async load(courseId: string): Promise<LoadResult> {
    try {
      const manifest = await this.content.loadManifest();
      const entry = manifest.courses.find((candidate) => candidate.id === courseId);
      if (!entry) return { kind: 'not-found' };
      const user = this.auth.user();
      if (!user) return { kind: 'not-found' };
      if (!(await this.access.canOpen(entry, user))) return { kind: 'not-found' };
      const course = await this.content.loadCourse(courseId);
      return { kind: 'loaded', course, entry };
    } catch (error) {
      if (!isContentError(error)) return { kind: 'unavailable' };
      return { kind: error.reason };
    }
  }
}
