import {
  afterNextRender,
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
import { isContentError } from '../../core/content/content-error';
import { ContentService } from '../../core/content/content.service';
import type { Course, Lesson as LessonData } from '../../core/content/content.types';
import { InlineText } from '../../shared/inline-text/inline-text/inline-text';
import { plainText } from '../../shared/inline-text/inline-markup';
import { LessonContext } from '../../shared/lesson-context/lesson-context';
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

/**
 * The lesson page (`/leren/:courseId/:lessonId`): one continuous page with the header, the step
 * navigation, every step and the end sections. Provides the lesson context to everything in it.
 */
@Component({
  selector: 'snf-lesson',
  imports: [Band, Button, InlineText, LessonEnd, LessonStep, RouterLink, StepNav, Sticker, TedSays],
  providers: [LessonContext],
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
    loader: ({ params }) => this.load(params.courseId, params.lessonId),
  });

  protected readonly state = computed((): LessonState => {
    if (this.loader.isLoading()) return { kind: 'loading' };
    return this.loader.hasValue() ? this.loader.value() : { kind: 'unavailable' };
  });

  protected readonly lesson = computed(() => {
    const state = this.state();
    return state.kind === 'loaded' ? state.lesson : null;
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
    effect(() => {
      if (this.state().kind !== 'loaded') return;
      const fragment = untracked(this.fragment);
      if (!fragment?.startsWith(STEP_ANCHOR_PREFIX)) return;
      const stepId = fragment.slice(STEP_ANCHOR_PREFIX.length);
      afterNextRender(() => this.goToStep(stepId), { injector: this.injector });
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

  private async load(courseId: string, lessonId: string): Promise<LoadResult> {
    try {
      const [course, lesson, assetUrls] = await Promise.all([
        this.content.loadCourse(courseId),
        this.content.loadLesson(courseId, lessonId),
        this.content.assetUrls(courseId),
      ]);
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
