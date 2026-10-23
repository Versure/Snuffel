import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import courseJson from '../../../../../content/fixtures/courses/proefcursus/course.json';
import lessonJson from '../../../../../content/fixtures/courses/proefcursus/lessons/01-proefles.json';
import { ContentError, type ContentErrorReason } from '../../core/content/content-error';
import { ContentService } from '../../core/content/content.service';
import type {
  ContentManifest,
  Course,
  Lesson as LessonData,
} from '../../core/content/content.types';
import { Lesson } from './lesson';

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
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'leren/:courseId/:lessonId', component: Lesson }]),
        { provide: ContentService, useValue: fake },
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
    expect(element.querySelector('snf-interaction-placeholder')).not.toBeNull();
    expect(element.querySelector('snf-quiz-preview')).not.toBeNull();
    expect(element.querySelector('snf-practice-list')).not.toBeNull();
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
    expect(textOf(element.querySelector('snf-example-block .sources'))).toContain(
      'Bron: Sportvisserij Nederland',
    );
    // Asset urls: the figure loads with the hash.
    expect(element.querySelector('snf-figure-block img')?.getAttribute('src')).toBe(assetUrl);
  });
});
