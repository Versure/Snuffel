import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  resource,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { AccountsService } from '../../../core/accounts/accounts.service';
import { ContentService } from '../../../core/content/content.service';
import type { ContentManifest, Lesson, ManifestCourse } from '../../../core/content/content.types';
import type { UserRecord } from '../../../core/pocketbase/types';
import { lastActivity } from '../../../core/progress/child-progress';
import { courseProgress, type CourseProgressSummary } from '../../../core/progress/course-progress';
import {
  ProgressService,
  type LessonRecords,
  type UserProgressSnapshot,
} from '../../../core/progress/progress.service';
import { plainText } from '../../../shared/inline-text/inline-markup';
import { Button } from '../../../shared/ui/button/button';
import { ProgressBar } from '../../../shared/ui/progress-bar/progress-bar';
import { TedSays } from '../../../shared/ui/ted-says/ted-says';
import { HOME_TEXT } from '../../home/home-text';
import { activityText } from '../activity-text';
import { ChildLesson, NO_RECORDS } from '../child-lesson/child-lesson';
import { CHILD_TEXT } from '../parent-text';

export type ChildState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'loaded'; readonly child: UserRecord; readonly manifest: ContentManifest }
  | { readonly kind: 'not-found' }
  | { readonly kind: 'unavailable' };

type LoadResult = Exclude<ChildState, { kind: 'loading' }>;

export type ChildProgressState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly snapshot: UserProgressSnapshot }
  | { readonly kind: 'unavailable' };

export interface ChildSection {
  readonly id: 'courses' | 'practice';
  readonly heading: string;
  readonly courses: readonly ManifestCourse[];
}

type LessonContent = Lesson | 'unavailable';

/** A lesson file to load: the lessons of the manifest where the child has records. */
interface LessonFile {
  readonly courseId: string;
  readonly lessonId: string;
}

const byTitle = (a: ManifestCourse, b: ManifestCourse) => a.title.localeCompare(b.title, 'nl');

/**
 * The page of one child for the parent (`/ouder/:childId`): the name, the last activity and,
 * per course, the progress bar and every lesson with what the child did. The id from the URL
 * only goes to PocketBase as a parameter. The progress loads apart from the child and the
 * content, and the lesson files (quiz questions, checklist items, step titles) only for the
 * lessons with records, each on its own.
 */
@Component({
  selector: 'snf-child-overview',
  imports: [Button, ChildLesson, ProgressBar, RouterLink, TedSays],
  templateUrl: './child.html',
  styleUrl: './child.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChildOverview {
  private readonly route = inject(ActivatedRoute);
  private readonly accounts = inject(AccountsService);
  private readonly content = inject(ContentService);
  private readonly progress = inject(ProgressService);
  private readonly title = inject(Title);
  protected readonly text = CHILD_TEXT;
  /** Loaded again on every visit, so the moment of the visit is "now". */
  protected readonly now = new Date();

  protected readonly childId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('childId') ?? '')),
    { requireSync: true },
  );

  private readonly loader = resource({
    params: () => ({ childId: this.childId() }),
    loader: ({ params }) => this.load(params.childId),
  });

  protected readonly state = computed((): ChildState => {
    if (this.loader.isLoading()) return { kind: 'loading' };
    return this.loader.hasValue() ? this.loader.value() : { kind: 'unavailable' };
  });

  /** The child whose progress loads, once it is known to be a child. */
  private readonly progressTarget = computed(() => {
    const state = this.state();
    return state.kind === 'loaded' ? state.child.id : undefined;
  });
  private readonly snapshot = resource({
    params: () => {
      const userId = this.progressTarget();
      return userId ? { userId } : undefined;
    },
    loader: ({ params }) => this.progress.loadUserProgress(params.userId),
  });

  protected readonly progressState = computed((): ChildProgressState => {
    if (this.snapshot.isLoading()) return { kind: 'loading' };
    if (this.snapshot.hasValue()) return { kind: 'ready', snapshot: this.snapshot.value() };
    return this.snapshot.status() === 'error' ? { kind: 'unavailable' } : { kind: 'loading' };
  });

  /** The lesson files to load; the same set never loads again. */
  private readonly lessonFiles = computed(
    (): readonly LessonFile[] => {
      const state = this.state();
      const progress = this.progressState();
      if (state.kind !== 'loaded' || progress.kind !== 'ready') return [];
      return state.manifest.courses.flatMap((course) =>
        course.lessons
          .filter(
            (lesson) => lesson.status === 'published' && progress.snapshot.lessons.has(lesson.id),
          )
          .map((lesson) => ({ courseId: course.id, lessonId: lesson.id })),
      );
    },
    { equal: (a, b) => keyOf(a) === keyOf(b) },
  );
  private readonly files = resource({
    params: () => {
      const files = this.lessonFiles();
      return files.length > 0 ? { files } : undefined;
    },
    loader: async ({ params }) => {
      const settled = await Promise.allSettled(
        params.files.map((file) => this.content.loadLesson(file.courseId, file.lessonId)),
      );
      return new Map<string, LessonContent>(
        params.files.map((file, index) => {
          const result = settled[index];
          return [file.lessonId, result.status === 'fulfilled' ? result.value : 'unavailable'];
        }),
      );
    },
  });
  /** Lesson files loaded again one by one with "Opnieuw" ('loading' while it runs). */
  private readonly retried = signal<ReadonlyMap<string, LessonContent | 'loading'>>(new Map());

  protected readonly name = computed(() => {
    const state = this.state();
    return state.kind === 'loaded' ? state.child.name || state.child.username : '';
  });

  protected readonly lastActivity = computed(() => {
    const progress = this.progressState();
    if (progress.kind !== 'ready') return null;
    const records = [...progress.snapshot.lessons.values()].flatMap((lesson) => [
      ...lesson.steps,
      ...lesson.checklists,
      ...lesson.attempts,
      ...lesson.results,
    ]);
    const updated = lastActivity(records);
    return updated === null
      ? CHILD_TEXT.notActive
      : CHILD_TEXT.lastActivity(activityText(updated, this.now));
  });

  protected readonly sections = computed((): readonly ChildSection[] => {
    const state = this.state();
    if (state.kind !== 'loaded') return [];
    const courses = state.manifest.courses;
    const sections: ChildSection[] = [
      {
        id: 'courses',
        heading: CHILD_TEXT.courses,
        courses: courses.filter((course) => course.kind === 'course').sort(byTitle),
      },
      {
        id: 'practice',
        heading: CHILD_TEXT.practice,
        courses: courses.filter((course) => course.kind === 'practice').sort(byTitle),
      },
    ];
    return sections.filter((section) => section.courses.length > 0);
  });

  protected readonly pageTitle = computed(() => {
    const state = this.state();
    switch (state.kind) {
      case 'loaded':
        return CHILD_TEXT.pageTitle(this.name());
      case 'not-found':
        return CHILD_TEXT.notFoundTitle;
      default:
        return CHILD_TEXT.defaultTitle;
    }
  });

  constructor() {
    // The document title lives outside the Angular templates.
    effect(() => this.title.setTitle(this.pageTitle()));
  }

  protected courseTitle(course: ManifestCourse): string {
    return plainText(course.title);
  }

  protected barName(course: ManifestCourse): string {
    return HOME_TEXT.progressName(plainText(course.title));
  }

  protected progressOf(course: ManifestCourse): CourseProgressSummary | null {
    const progress = this.progressState();
    return progress.kind === 'ready' ? courseProgress(course, progress.snapshot.statuses) : null;
  }

  protected barLabel(summary: CourseProgressSummary): string {
    return HOME_TEXT.lessonsCompleted(summary.completed, summary.total);
  }

  protected recordsOf(lessonId: string): LessonRecords | null {
    const progress = this.progressState();
    if (progress.kind !== 'ready') return null;
    return progress.snapshot.lessons.get(lessonId) ?? NO_RECORDS;
  }

  protected contentOf(lessonId: string): LessonContent | null {
    const retried = this.retried().get(lessonId);
    if (retried !== undefined) return retried === 'loading' ? null : retried;
    if (!this.files.hasValue()) return null;
    return this.files.value().get(lessonId) ?? null;
  }

  protected retry(): void {
    this.loader.reload();
  }

  protected retryProgress(): void {
    this.snapshot.reload();
  }

  protected async retryLesson(courseId: string, lessonId: string): Promise<void> {
    const set = (value: LessonContent | 'loading') =>
      this.retried.update((current) => new Map(current).set(lessonId, value));
    set('loading');
    try {
      set(await this.content.loadLesson(courseId, lessonId));
    } catch {
      set('unavailable');
    }
  }

  private async load(childId: string): Promise<LoadResult> {
    try {
      const [child, manifest] = await Promise.all([
        this.accounts.loadChild(childId),
        this.content.loadManifest(),
      ]);
      return child ? { kind: 'loaded', child, manifest } : { kind: 'not-found' };
    } catch {
      return { kind: 'unavailable' };
    }
  }
}

function keyOf(files: readonly LessonFile[]): string {
  return files.map((file) => `${file.courseId}/${file.lessonId}`).join(' ');
}
