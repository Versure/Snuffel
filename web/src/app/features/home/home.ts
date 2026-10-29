import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  linkedSignal,
  resource,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { AccountsService } from '../../core/accounts/accounts.service';
import { CourseAccessService } from '../../core/access/course-access.service';
import {
  isForAllChildren,
  visibleCourses,
  type CourseViewer,
} from '../../core/access/visible-courses';
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

/**
 * Which `selected-children` courses the child may see: not needed for the parent; when they
 * cannot be loaded, the child sees only the `all-children` courses.
 */
export type HomeAccessState =
  | { readonly kind: 'not-needed' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly assigned: ReadonlySet<string> }
  | { readonly kind: 'unavailable' };

export type HomeProgressState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly statuses: StepStatuses }
  | { readonly kind: 'unavailable' };

const byTitle = (a: ManifestCourse, b: ManifestCourse) => a.title.localeCompare(b.title, 'nl');

/**
 * The start page (`/`): Ted greets whoever is logged in, and every course and practice course
 * the user may see is a card with the progress of the logged-in user. The parent sees every
 * course of the manifest; a child the `all-children` courses and the `selected-children` courses
 * assigned to it. The content (the shared manifest), the assignments of a child and the progress
 * load separately, so a progress failure still shows the courses.
 */
@Component({
  selector: 'snf-home',
  imports: [Button, CourseCard, RouterLink, TedSays],
  templateUrl: './home.html',
  styleUrl: './home.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Home {
  private readonly content = inject(ContentService);
  private readonly progress = inject(ProgressService);
  private readonly access = inject(CourseAccessService);
  private readonly accounts = inject(AccountsService);
  protected readonly user = inject(AuthService).user;
  protected readonly text = HOME_TEXT;
  /** Only for convenience in the UI; /ouder has its own guard and PocketBase its rules. */
  protected readonly isParent = computed(() => this.user()?.role === 'parent');

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

  /** The child whose assignments are needed; undefined for the parent (who sees everything). */
  private readonly childId = computed(() => {
    const user = this.user();
    return user && user.role !== 'parent' ? user.id : undefined;
  });
  private readonly assigned = resource({
    params: () => {
      const userId = this.childId();
      return userId ? { userId } : undefined;
    },
    loader: ({ params }) => this.access.loadAssignedCourseIds(params.userId),
  });

  protected readonly accessState = computed((): HomeAccessState => {
    const user = this.user();
    if (user?.role === 'parent') return { kind: 'not-needed' };
    // Without a user (never behind the auth guard) nothing is assigned.
    if (!user) return { kind: 'ready', assigned: new Set() };
    // While (re)loading, never use the assignments of before (they may be another child's).
    if (this.assigned.isLoading()) return { kind: 'loading' };
    if (this.assigned.hasValue()) return { kind: 'ready', assigned: this.assigned.value() };
    return this.assigned.status() === 'error' ? { kind: 'unavailable' } : { kind: 'loading' };
  });

  /** For the parent only: the children and every assignment, for the stickers "Voor: …". */
  private readonly parentId = computed(() => {
    const user = this.user();
    return user?.role === 'parent' ? user.id : undefined;
  });
  private readonly shownTo = resource({
    params: () => {
      const userId = this.parentId();
      return userId ? { userId } : undefined;
    },
    loader: async () => {
      const [children, assignments] = await Promise.all([
        this.accounts.loadChildren(),
        this.access.loadAssignments(),
      ]);
      return { children, assignments };
    },
  });

  /**
   * Who looks at the courses; null while the first assignments of a child load. When another
   * child logs in on the same page, the courses for every child stay while its assignments load
   * (never the assignments of the child before).
   */
  private readonly viewer = linkedSignal<HomeAccessState, CourseViewer | null>({
    source: this.accessState,
    computation: (access, previous) => {
      switch (access.kind) {
        case 'not-needed':
          return { role: 'parent' };
        case 'loading':
          return previous?.value ? { role: 'child', assigned: new Set() } : null;
        case 'ready':
          return { role: 'child', assigned: access.assigned };
        case 'unavailable':
          // Only the courses for every child: rather too little than too much.
          return { role: 'child', assigned: new Set() };
      }
    },
  });

  protected readonly contentState = computed((): HomeContentState => {
    if (this.manifest.isLoading()) return { kind: 'loading' };
    if (!this.manifest.hasValue()) {
      const error = this.manifest.error();
      return isContentError(error) && error.reason === 'unsupported-version'
        ? { kind: 'unsupported-version' }
        : { kind: 'unavailable' };
    }
    const viewer = this.viewer();
    if (!viewer) return { kind: 'loading' };
    const courses = visibleCourses(this.manifest.value().courses, viewer);
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

  /**
   * The sticker on a `selected-children` course for the parent: the names of the children who
   * see it. Null for a child, for an `all-children` course and when it cannot be loaded (the
   * parent sees it on /ouder).
   */
  protected shownToOf(course: ManifestCourse): string | null {
    if (!this.parentId() || isForAllChildren(course) || !this.shownTo.hasValue()) return null;
    const { children, assignments } = this.shownTo.value();
    const assigned = new Set(
      assignments
        .filter((assignment) => assignment.course_id === course.id)
        .map((assignment) => assignment.user),
    );
    const names = children
      .filter((child) => assigned.has(child.id))
      .map((child) => child.name || child.username);
    return HOME_TEXT.shownTo(names);
  }

  protected retryContent(): void {
    this.manifest.reload();
  }

  protected retryAccess(): void {
    this.assigned.reload();
  }

  protected retryProgress(): void {
    this.statuses.reload();
  }
}
