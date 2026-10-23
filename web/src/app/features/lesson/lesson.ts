import {
  afterNextRender,
  ApplicationRef,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  Injector,
  resource,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { isContentError } from '../../core/content/content-error';
import { ContentService } from '../../core/content/content.service';
import type { Course, Lesson as LessonData } from '../../core/content/content.types';
import { InlineText } from '../../shared/inline-text/inline-text/inline-text';
import { plainText } from '../../shared/inline-text/inline-markup';
import { LessonContext } from '../../shared/lesson-context/lesson-context';
import { LessonProgress } from '../../shared/lesson-progress/lesson-progress';
import { Band } from '../../shared/ui/band/band';
import { Button } from '../../shared/ui/button/button';
import { STEP_ANCHOR_PREFIX, StepNav } from '../../shared/ui/step-nav/step-nav';
import { Sticker } from '../../shared/ui/sticker/sticker';
import { TedSays } from '../../shared/ui/ted-says/ted-says';
import { LessonEnd } from './lesson-end/lesson-end';
import { LessonStep, stepHeadingId, stepSectionId } from './lesson-step/lesson-step';
import { stepLabel } from './step-label';

export type LessonState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'loaded'; readonly lesson: LessonData; readonly course: Course }
  | { readonly kind: 'not-found' }
  | { readonly kind: 'planned'; readonly title: string }
  | { readonly kind: 'unavailable' }
  | { readonly kind: 'unsupported-version' };

type LoadResult = Exclude<LessonState, { kind: 'loading' }>;

/** The longest wait for a stable page before scrolling to the step from the url anchor. */
export const STEP_SCROLL_MAX_WAIT_MS = 1500;

/**
 * The lesson page (`/leren/:courseId/:lessonId`): one continuous page with the header, the step
 * navigation, every step and the end sections. Provides the lesson context and the progress of
 * the logged-in user in this lesson to everything in it.
 */
@Component({
  selector: 'snf-lesson',
  imports: [Band, Button, InlineText, LessonEnd, LessonStep, RouterLink, StepNav, Sticker, TedSays],
  providers: [LessonContext, LessonProgress],
  templateUrl: './lesson.html',
  styleUrl: './lesson.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Lesson {
  private readonly route = inject(ActivatedRoute);
  private readonly content = inject(ContentService);
  private readonly context = inject(LessonContext);
  private readonly title = inject(Title);
  private readonly injector = inject(Injector);
  private readonly appRef = inject(ApplicationRef);
  private readonly auth = inject(AuthService);
  protected readonly progress = inject(LessonProgress);

  private readonly params = toSignal(
    this.route.paramMap.pipe(
      map((params) => ({
        courseId: params.get('courseId') ?? '',
        lessonId: params.get('lessonId') ?? '',
      })),
    ),
    { requireSync: true },
  );
  private readonly fragment = toSignal(this.route.fragment, { initialValue: null });

  private readonly loader = resource({
    params: () => this.params(),
    loader: ({ params, abortSignal }) => this.load(params.courseId, params.lessonId, abortSignal),
  });

  protected readonly state = computed((): LessonState => {
    if (this.loader.isLoading()) return { kind: 'loading' };
    return this.loader.hasValue() ? this.loader.value() : { kind: 'unavailable' };
  });

  protected readonly lesson = computed(() => {
    const state = this.state();
    return state.kind === 'loaded' ? state.lesson : null;
  });

  /**
   * The progress is loaded after the lesson, for the logged-in user: another user (or another
   * lesson) loads again. Opening a lesson only reads; it never writes progress.
   */
  private readonly progressTarget = computed(
    () => {
      const state = this.state();
      if (state.kind !== 'loaded') return undefined;
      return { lesson: state.lesson, courseId: state.course.id, userId: this.auth.user()?.id };
    },
    // A renewed session of the same user is not a reason to load again.
    {
      equal: (a, b) =>
        a?.lesson === b?.lesson && a?.courseId === b?.courseId && a?.userId === b?.userId,
    },
  );
  private readonly progressLoader = resource({
    params: () => this.progressTarget(),
    loader: ({ params }) => this.progress.load(params.lesson, params.courseId),
  });

  /** The title split in two: the last word goes on the band (no band for a single word). */
  protected readonly titleParts = computed(() => {
    const title = plainText(this.lesson()?.title ?? '').trim();
    const space = title.lastIndexOf(' ');
    return space < 0
      ? { head: title, band: '' }
      : { head: title.slice(0, space), band: title.slice(space + 1) };
  });

  protected readonly navItems = computed(() =>
    (this.lesson()?.steps ?? []).map((step) => ({ id: step.id, label: stepLabel(step) })),
  );

  protected readonly pageTitle = computed(() => {
    const state = this.state();
    switch (state.kind) {
      case 'loaded':
        return `${plainText(state.lesson.title)} · Snuffel`;
      case 'not-found':
        return 'Les niet gevonden · Snuffel';
      case 'planned':
        return `${plainText(state.title)} · Snuffel`;
      default:
        return 'Les · Snuffel';
    }
  });

  constructor() {
    // The document title lives outside the Angular templates.
    effect(() => this.title.setTitle(this.pageTitle()));

    // After loading: go to the step from the anchor in the url (#stap-<id>).
    effect((onCleanup) => {
      if (this.state().kind !== 'loaded') return;
      const fragment = untracked(this.fragment);
      if (!fragment?.startsWith(STEP_ANCHOR_PREFIX)) return;
      const stepId = fragment.slice(STEP_ANCHOR_PREFIX.length);
      // Wait until the page is stable: a lazily loaded game (snf-interaction) or restored
      // progress above the step would otherwise push it away after the scroll. Progress that
      // never arrives (the SDK has no timeout) must not stop the scroll: whichever comes first,
      // a stable page or STEP_SCROLL_MAX_WAIT_MS, scrolls, and only once.
      let done = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const scroll = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        // A child who already uses the page (typing in an exercise, a tapped button) keeps its
        // focus and place: a late anchor must not pull it away.
        const active = document.activeElement;
        if (active && active !== document.body) return;
        this.goToStep(stepId);
      };
      const render = afterNextRender(
        () => {
          timer = setTimeout(scroll, STEP_SCROLL_MAX_WAIT_MS);
          void this.appRef.whenStable().then(scroll);
        },
        { injector: this.injector },
      );
      // Another lesson (the state changes) or leaving the page: a late scroll is stale.
      onCleanup(() => {
        done = true;
        clearTimeout(timer);
        render.destroy();
      });
    });
  }

  protected retry(): void {
    this.loader.reload();
  }

  /** Scrolls to a step and puts the focus on its heading. */
  protected goToStep(stepId: string): void {
    const section = document.getElementById(stepSectionId(stepId));
    const heading = document.getElementById(stepHeadingId(stepId));
    if (!section || !heading) return;
    heading.focus({ preventScroll: true });
    // Smooth or not follows scroll-behavior in base.css (never with reduced motion).
    section.scrollIntoView({ block: 'start' });
  }

  /**
   * Loads a lesson and fills the lesson context. `abortSignal` is aborted when the params change
   * (or on reload) before this load is done; such a stale load leaves the context alone, so it
   * never overwrites the context of the lesson that is shown.
   */
  private async load(
    courseId: string,
    lessonId: string,
    abortSignal: AbortSignal,
  ): Promise<LoadResult> {
    try {
      const [course, lesson, assetUrls] = await Promise.all([
        this.content.loadCourse(courseId),
        this.content.loadLesson(courseId, lessonId),
        this.content.assetUrls(courseId),
      ]);
      // The resource ignores the result of an aborted load.
      if (abortSignal.aborted) return { kind: 'unavailable' };
      this.context.glossary.set(lesson.glossary);
      this.context.sources.set(course.sources);
      this.context.assetUrls.set(assetUrls);
      return { kind: 'loaded', course, lesson };
    } catch (error) {
      if (!isContentError(error)) return { kind: 'unavailable' };
      if (error.reason === 'not-found') return this.notFound(courseId, lessonId);
      return { kind: error.reason };
    }
  }

  /** A lesson that is only planned is in the manifest without a file. */
  private async notFound(courseId: string, lessonId: string): Promise<LoadResult> {
    try {
      const manifest = await this.content.loadManifest();
      const entry = manifest.courses
        .find((course) => course.id === courseId)
        ?.lessons.find((lesson) => lesson.id === lessonId);
      if (entry?.status === 'planned') return { kind: 'planned', title: entry.title };
    } catch {
      // Not found is the best answer we have.
    }
    return { kind: 'not-found' };
  }
}
