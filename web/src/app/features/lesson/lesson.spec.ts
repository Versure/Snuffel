import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import courseJson from '../../../../../content/fixtures/courses/proefcursus/course.json';
import lessonJson from '../../../../../content/fixtures/courses/proefcursus/lessons/01-proefles.json';
import { AuthService } from '../../core/auth/auth.service';
import { ContentError, type ContentErrorReason } from '../../core/content/content-error';
import { ContentService } from '../../core/content/content.service';
import type { UserRecord } from '../../core/pocketbase/types';
import { ProgressError } from '../../core/progress/progress-error';
import {
  ProgressService,
  type LessonProgressSnapshot,
  type StepProgress,
} from '../../core/progress/progress.service';
import { LessonContext } from '../../shared/lesson-context/lesson-context';
import type {
  ContentManifest,
  Course,
  Lesson as LessonData,
} from '../../core/content/content.types';
import { Lesson, STEP_SCROLL_MAX_WAIT_MS } from './lesson';

// The fixture lesson from content/ (never copied into web/src).
const course = courseJson as unknown as Course;
const lesson = lessonJson as unknown as LessonData;
const assetUrl = '/content/proefcursus/assets/hengeltop.svg?v=0123456789abcdef';

const manifest: ContentManifest = {
  schemaVersion: 1,
  courses: [
    {
      id: 'proefcursus',
      title: 'Proefcursus',
      kind: 'course',
      file: 'proefcursus/course.json',
      hash: '0123456789abcdef',
      lessons: [
        { id: 'proefles', title: lesson.title, status: 'published' },
        { id: 'proefles-later', title: 'Proefles: een les die nog komt', status: 'planned' },
      ],
      assets: [],
    },
  ],
};

/** The visible text: without hidden parts (closed definitions), whitespace collapsed. */
function textOf(element: Element | null | undefined): string {
  if (!element) return '';
  const copy = element.cloneNode(true) as Element;
  for (const hidden of copy.querySelectorAll('[hidden]')) hidden.remove();
  return (copy.textContent ?? '').replace(/\s+/g, ' ').trim();
}

describe('Lesson', () => {
  let failure: ContentErrorReason | null;
  let loadLesson: ReturnType<
    typeof vi.fn<(courseId: string, lessonId: string) => Promise<LessonData>>
  >;
  let loadProgress: ReturnType<typeof vi.fn<ProgressService['loadLesson']>>;
  let user: ReturnType<typeof signal<UserRecord | null>>;

  beforeEach(() => {
    failure = null;
    loadLesson = vi.fn(async (courseId: string, lessonId: string) => {
      if (failure) throw new ContentError(failure, 'test');
      if (courseId !== 'proefcursus' || lessonId !== 'proefles') {
        throw new ContentError('not-found', 'test');
      }
      return lesson;
    });
    const fake: Partial<ContentService> = {
      loadManifest: async () => manifest,
      loadCourse: async (courseId: string) => {
        if (courseId !== 'proefcursus') throw new ContentError('not-found', 'test');
        return course;
      },
      loadLesson,
      assetUrls: async () => new Map([['assets/hengeltop.svg', assetUrl]]),
    };
    loadProgress = vi.fn<ProgressService['loadLesson']>(
      async (): Promise<LessonProgressSnapshot> => ({
        steps: new Map(),
        checklists: new Map(),
        attempts: [],
        results: [],
      }),
    );
    user = signal<UserRecord | null>({
      id: 'a1',
      username: 'kind-a',
      name: 'Kind A',
      role: 'child',
    });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'leren/:courseId/:lessonId', component: Lesson }]),
        { provide: ContentService, useValue: fake },
        { provide: ProgressService, useValue: { loadLesson: loadProgress } },
        { provide: AuthService, useValue: { user } },
      ],
    });
  });

  async function open(url = '/leren/proefcursus/proefles') {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    await harness.fixture.whenStable();
    return { harness, element: harness.routeNativeElement as HTMLElement };
  }

  it('renders the lesson header, steps and end sections', async () => {
    const { element } = await open();
    expect(textOf(element.querySelector('snf-sticker'))).toBe('Proefcursus · proefles');
    expect(textOf(element.querySelector('.minutes'))).toBe('Ongeveer 11 minuten');
    expect(textOf(element.querySelector('h1'))).toBe('Proefles: aanbeet of vastzitten?');
    expect(textOf(element.querySelector('h1 snf-band'))).toBe('vastzitten?');
    expect(textOf(element.querySelector('.intro snf-speech-bubble'))).toBe(
      'Yo! Ik ben Ted. Bij kunstaas is je hand de beetmelder.',
    );
    expect(element.querySelector('.intro snf-ted')?.classList).toContain('snf-ted--wiggle');
    expect(textOf(element.querySelector('.objective'))).toBe(lesson.objective);
    expect(element.querySelector('a.back')?.getAttribute('href')).toBe('/');
    expect(element.querySelectorAll('snf-step-nav li')).toHaveLength(4);

    const headings = [...element.querySelectorAll('snf-lesson-step h2')].map(textOf);
    expect(headings).toEqual([
      '1 Wachten kost je de vis',
      '2 Voel de lijn',
      '3 Quiz',
      '4 Aan het water',
    ]);
    expect(element.querySelectorAll('snf-block')).toHaveLength(8);
    expect(element.querySelector('snf-interaction')).not.toBeNull();
    expect(element.querySelector('snf-quiz')).not.toBeNull();
    expect(element.querySelector('snf-checklist')).not.toBeNull();
    expect(textOf(element.querySelector('.finished'))).toBe(
      'Tijd voor het echte werk aan de waterkant.',
    );
    expect(
      [...element.querySelectorAll('snf-lesson-end h2')].map((heading) => textOf(heading)),
    ).toEqual(['Woordenlijst', 'Verder lezen', 'Vragen']);
    expect(element.querySelector('main')?.hasAttribute('aria-busy')).toBe(false);
  });

  it('sets the page title to the lesson title', async () => {
    await open();
    expect(TestBed.inject(Title).getTitle()).toBe('Proefles: aanbeet of vastzitten? · Snuffel');
  });

  it('shows the not-found state for an unknown lesson', async () => {
    const { element } = await open('/leren/proefcursus/bestaat-niet');
    expect(textOf(element.querySelector('snf-ted-says'))).toBe('Deze les kan ik niet vinden.');
    expect(
      element.querySelector<SVGElement>('snf-ted svg')?.style.getPropertyValue('--m-mond-oeps'),
    ).toBe('inline');
    expect(element.querySelector('a[href="/"]')).not.toBeNull();
    expect(TestBed.inject(Title).getTitle()).toBe('Les niet gevonden · Snuffel');
  });

  it('shows the not-found state for an unknown course', async () => {
    const { element } = await open('/leren/bestaat-niet/proefles');
    expect(textOf(element.querySelector('snf-ted-says'))).toBe('Deze les kan ik niet vinden.');
  });

  it('shows the planned state for a planned lesson', async () => {
    const { element } = await open('/leren/proefcursus/proefles-later');
    expect(textOf(element.querySelector('snf-ted-says'))).toBe(
      'Aan deze les wordt nog gewerkt. Hij komt eraan!',
    );
    expect(
      element.querySelector<SVGElement>('snf-ted svg')?.style.getPropertyValue('--m-mond-denk'),
    ).toBe('inline');
    expect(textOf(element.querySelector('h1'))).toBe('Proefles: een les die nog komt');
    expect(element.querySelector('a[href="/"]')).not.toBeNull();
  });

  it('shows a retry button when content is unavailable and loads after retry', async () => {
    failure = 'unavailable';
    const { harness, element } = await open();
    expect(textOf(element.querySelector('snf-ted-says'))).toBe('Snuffel kan de les nu niet laden.');
    const retry = [...element.querySelectorAll('button')].find(
      (button) => textOf(button) === 'Opnieuw',
    );
    expect(retry).toBeDefined();
    expect(element.querySelector('a[href="/"]')).not.toBeNull();

    failure = null;
    retry?.click();
    await harness.fixture.whenStable();
    expect(loadLesson).toHaveBeenCalledTimes(2);
    expect(textOf(element.querySelector('h1'))).toBe('Proefles: aanbeet of vastzitten?');
  });

  it('shows the unsupported-version state', async () => {
    failure = 'unsupported-version';
    const { element } = await open();
    expect(textOf(element.querySelector('snf-ted-says'))).toBe(
      'Deze les is gemaakt voor een nieuwere versie van Snuffel. Ververs de pagina.',
    );
    expect(element.querySelector('button')).toBeNull();
  });

  it('shows Ted thinking while loading, with aria-busy', async () => {
    let release: (value: LessonData) => void = () => undefined;
    loadLesson.mockImplementation(() => new Promise<LessonData>((resolve) => (release = resolve)));
    const harness = await RouterTestingHarness.create();
    void harness.navigateByUrl('/leren/proefcursus/proefles');
    await new Promise((resolve) => setTimeout(resolve, 0));
    harness.fixture.detectChanges();
    const element = harness.fixture.nativeElement as HTMLElement;
    expect(textOf(element.querySelector('snf-lesson snf-ted-says'))).toBe('Even snuffelen…');
    expect(element.querySelector('snf-lesson main')?.getAttribute('aria-busy')).toBe('true');
    expect(TestBed.inject(Title).getTitle()).toBe('Les · Snuffel');
    release(lesson);
    await harness.fixture.whenStable();
    expect(textOf(element.querySelector('snf-lesson h1'))).toBe('Proefles: aanbeet of vastzitten?');
  });

  it('provides the glossary, sources and asset urls to the blocks', async () => {
    const { element } = await open();
    // Glossary: a term in the example is a button.
    const term = [...element.querySelectorAll('snf-glossary-term button')].find(
      (button) => textOf(button) === 'shad',
    );
    expect(term).toBeDefined();
    // Sources: the example block names its source.
    const source = element.querySelector('snf-example-block .sources a');
    expect(source?.textContent).toContain('Sportvisserij Nederland');
    // Asset urls: the figure loads with the hash.
    expect(element.querySelector('snf-figure-block img')?.getAttribute('src')).toBe(assetUrl);
  });

  it('keeps the context of the shown lesson when an older load finishes later', async () => {
    const other: LessonData = {
      ...lesson,
      title: 'Andere les',
      glossary: [{ term: 'loodkop', definition: 'een kop van lood' }],
    };
    let releaseFirst: (value: LessonData) => void = () => undefined;
    loadLesson.mockImplementation(async (_courseId, lessonId) => {
      if (lessonId === 'andere-les') return other;
      return new Promise<LessonData>((resolve) => (releaseFirst = resolve));
    });
    const harness = await RouterTestingHarness.create();
    void harness.navigateByUrl('/leren/proefcursus/proefles');
    await new Promise((resolve) => setTimeout(resolve, 0));
    harness.fixture.detectChanges();
    const context = harness.routeDebugElement?.injector.get(LessonContext);
    if (!context) throw new Error('no lesson context');

    await harness.navigateByUrl('/leren/proefcursus/andere-les');
    await harness.fixture.whenStable();
    expect(harness.routeDebugElement?.injector.get(LessonContext)).toBe(context);
    expect(context.glossary()).toEqual(other.glossary);

    releaseFirst(lesson);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await harness.fixture.whenStable();
    expect(context.glossary()).toEqual(other.glossary);
    const element = harness.routeNativeElement as HTMLElement;
    expect(textOf(element.querySelector('h1'))).toBe('Andere les');
  });
  it('loads the progress for the logged-in user', async () => {
    const { harness } = await open();
    expect(loadProgress).toHaveBeenCalledTimes(1);
    expect(loadProgress).toHaveBeenCalledWith('a1', 'proefles');

    // Another user loads again; a renewed session of the same user does not.
    user.set({ id: 'a1', username: 'kind-a', name: 'Kind A', role: 'child' });
    await harness.fixture.whenStable();
    expect(loadProgress).toHaveBeenCalledTimes(1);
    user.set({ id: 'b1', username: 'kind-b', name: 'Kind B', role: 'child' });
    await harness.fixture.whenStable();
    expect(loadProgress).toHaveBeenCalledTimes(2);
    expect(loadProgress).toHaveBeenLastCalledWith('b1', 'proefles');
  });

  it('fills the step navigation with completed steps', async () => {
    loadProgress.mockResolvedValue({
      steps: new Map<string, StepProgress>([
        ['uitleg', { id: 'p1', status: 'completed' }],
        ['quiz', { id: 'p2', status: 'started' }],
      ]),
      checklists: new Map(),
      attempts: [],
      results: [],
    });
    const { element } = await open();
    const items = [...element.querySelectorAll('snf-step-nav li')];
    expect(items.map((item) => item.classList.contains('done'))).toEqual([
      true,
      false,
      false,
      false,
    ]);
    expect(textOf(items[0].querySelector('.snf-visually-hidden'))).toBe('Stap 1: Uitleg (klaar)');
  });

  it('the lesson stays readable when progress cannot be loaded', async () => {
    loadProgress.mockRejectedValue(new ProgressError('unavailable', 'test'));
    const { element } = await open();
    expect(textOf(element.querySelector('h1'))).toBe('Proefles: aanbeet of vastzitten?');
    expect(element.querySelectorAll('snf-block')).toHaveLength(8);
    expect(textOf(element.querySelector('snf-quiz .unavailable snf-speech-bubble'))).toBe(
      'Je voortgang kan ik nu niet ophalen.',
    );
    const options = [...element.querySelectorAll<HTMLButtonElement>('snf-quiz button.option')];
    expect(options.length).toBe(16);
    expect(options.every((option) => option.disabled)).toBe(true);
    const boxes = [...element.querySelectorAll<HTMLInputElement>('snf-checklist input')];
    expect(boxes.length).toBe(4);
    expect(boxes.every((box) => box.disabled)).toBe(true);
    expect(element.querySelectorAll('snf-step-nav li.done')).toHaveLength(0);
  });

  describe('the step anchor in the url', () => {
    let scrolled: ReturnType<typeof vi.fn<(this: Element) => void>>;
    let original: typeof Element.prototype.scrollIntoView;

    beforeEach(() => {
      original = Element.prototype.scrollIntoView;
      scrolled = vi.fn<(this: Element) => void>();
      Element.prototype.scrollIntoView = scrolled;
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
      Element.prototype.scrollIntoView = original;
    });

    /** Progress that only arrives when the test says so (or never). */
    function holdProgress() {
      let release: (value: LessonProgressSnapshot) => void = () => undefined;
      loadProgress.mockImplementation(
        () => new Promise<LessonProgressSnapshot>((resolve) => (release = resolve)),
      );
      return (value: LessonProgressSnapshot) => release(value);
    }

    /** Navigates without waiting for a stable page (hanging progress keeps it unstable). */
    async function openWithoutStable(url: string) {
      const harness = await RouterTestingHarness.create();
      void harness.navigateByUrl(url);
      await vi.advanceTimersByTimeAsync(50);
      const element = harness.routeNativeElement as HTMLElement;
      expect(textOf(element.querySelector('h1'))).toBe('Proefles: aanbeet of vastzitten?');
      return { harness, element };
    }

    const scrolledIds = () => scrolled.mock.contexts.map((element) => element.id);

    it('scrolls to the step once the page is stable, and only once', async () => {
      const { harness } = await openWithoutStable('/leren/proefcursus/proefles#stap-quiz');
      await harness.fixture.whenStable();
      await vi.advanceTimersByTimeAsync(0);
      expect(scrolledIds()).toEqual(['stap-quiz']);
      expect(document.activeElement?.id).toBe('stap-quiz-titel');
      await vi.advanceTimersByTimeAsync(STEP_SCROLL_MAX_WAIT_MS * 2);
      expect(scrolled).toHaveBeenCalledTimes(1);
    });

    it('scrolls after at most STEP_SCROLL_MAX_WAIT_MS when the progress hangs, and only once', async () => {
      const release = holdProgress();
      const { harness } = await openWithoutStable('/leren/proefcursus/proefles#stap-quiz');
      await vi.advanceTimersByTimeAsync(STEP_SCROLL_MAX_WAIT_MS - 100);
      expect(scrolled).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(100);
      expect(scrolledIds()).toEqual(['stap-quiz']);

      // The progress arrives later: the page becomes stable, but there is no second scroll.
      release({ steps: new Map(), checklists: new Map(), attempts: [], results: [] });
      await vi.advanceTimersByTimeAsync(50);
      await harness.fixture.whenStable();
      expect(scrolled).toHaveBeenCalledTimes(1);
    });

    it('does not scroll for a lesson that is no longer shown', async () => {
      const other: LessonData = { ...lesson, title: 'Andere les' };
      loadLesson.mockImplementation(async (_courseId, lessonId) =>
        lessonId === 'andere-les' ? other : lesson,
      );
      // The progress of the first lesson hangs; the other lesson loads its progress at once,
      // so the page becomes stable while the first scroll is still waiting.
      loadProgress.mockImplementationOnce(
        () => new Promise<LessonProgressSnapshot>(() => undefined),
      );
      const { harness, element } = await openWithoutStable('/leren/proefcursus/proefles#stap-quiz');
      void harness.navigateByUrl('/leren/proefcursus/andere-les');
      await vi.advanceTimersByTimeAsync(50);
      await harness.fixture.whenStable();
      expect(textOf(element.querySelector('h1'))).toBe('Andere les');
      expect(loadProgress).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(STEP_SCROLL_MAX_WAIT_MS * 2);
      expect(scrolled).not.toHaveBeenCalled();
    });

    it('does not scroll after the page is left', async () => {
      holdProgress();
      const { harness } = await openWithoutStable('/leren/proefcursus/proefles#stap-quiz');
      harness.fixture.destroy();
      await vi.advanceTimersByTimeAsync(STEP_SCROLL_MAX_WAIT_MS * 2);
      expect(scrolled).not.toHaveBeenCalled();
    });
  });
});
