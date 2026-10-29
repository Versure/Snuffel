import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import courseJson from '../../../../../content/fixtures/courses/proefcursus/course.json';
import practiceJson from '../../../../../content/fixtures/courses/proefhuiswerk/course.json';
import { CourseAccessService } from '../../core/access/course-access.service';
import { canSee } from '../../core/access/visible-courses';
import { AuthService } from '../../core/auth/auth.service';
import { ContentError, type ContentErrorReason } from '../../core/content/content-error';
import { ContentService } from '../../core/content/content.service';
import type {
  ContentManifest,
  Course as CourseData,
  ManifestCourse,
} from '../../core/content/content.types';
import type { UserRecord } from '../../core/pocketbase/types';
import {
  groupStepStatuses,
  type StepStatuses,
  type StepStatusRecord,
} from '../../core/progress/course-progress';
import { ProgressError } from '../../core/progress/progress-error';
import { ProgressService } from '../../core/progress/progress.service';
import { Course } from './course';

// The fixture courses from content/ (never copied into web/src).
const proefcursus = courseJson as unknown as CourseData;
const proefhuiswerk = practiceJson as unknown as CourseData;

const proefcursusEntry: ManifestCourse = {
  id: 'proefcursus',
  title: 'Proefcursus',
  kind: 'course',
  access: 'all-children',
  file: 'proefcursus/course.json',
  hash: '0123456789abcdef',
  lessons: [
    {
      id: 'proefles',
      title: 'Proefles: aanbeet of vastzitten?',
      status: 'published',
      version: 1,
      estimatedMinutes: 11,
      file: 'proefcursus/lessons/proefles.json',
      hash: 'fedcba9876543210',
      stepIds: ['uitleg', 'spel', 'quiz', 'zelf-doen'],
    },
    { id: 'proefles-later', title: 'Proefles: een les die nog komt', status: 'planned' },
  ],
  assets: [],
};

const proefhuiswerkEntry: ManifestCourse = {
  id: 'proefhuiswerk',
  title: 'Proefhuiswerk',
  kind: 'practice',
  access: 'all-children',
  file: 'proefhuiswerk/course.json',
  hash: '1111111111111111',
  lessons: [
    {
      id: 'proefles-breuken',
      title: 'Proefles: breuken optellen',
      status: 'published',
      version: 1,
      estimatedMinutes: 10,
      file: 'proefhuiswerk/lessons/proefles-breuken.json',
      hash: '2222222222222222',
      stepIds: ['uitleg', 'oefenen'],
    },
  ],
  assets: [],
};

/** A course for selected children only, with the same shape as the proefcursus. */
const geheimEntry: ManifestCourse = {
  ...proefcursusEntry,
  id: 'geheim',
  title: 'Geheim',
  access: 'selected-children',
  file: 'geheim/course.json',
};

const manifest: ContentManifest = {
  schemaVersion: 1,
  courses: [proefcursusEntry, proefhuiswerkEntry, geheimEntry],
};

const textOf = (element: Element | null | undefined) =>
  (element?.textContent ?? '').replace(/\s+/g, ' ').trim();

function moodOf(tedSays: Element | null | undefined): string {
  const svg = tedSays?.querySelector<SVGSVGElement>('snf-ted svg');
  const on = (name: string) => svg?.style.getPropertyValue(name).trim() === 'inline';
  if (on('--m-mond-oeps')) return 'oops';
  if (on('--m-mond-denk')) return 'thinking';
  if (on('--m-ogen-blij')) return 'happy';
  return 'cool';
}

const done = (lessonId: string, stepIds: string[]): StepStatusRecord[] =>
  stepIds.map((stepId) => ({ lesson_id: lessonId, step_id: stepId, status: 'completed' }));

describe('Course', () => {
  let failure: ContentErrorReason | null;
  let progressFails: boolean;
  let statuses: StepStatuses;
  let loadCourse: ReturnType<typeof vi.fn<(courseId: string) => Promise<CourseData>>>;
  let loadStepStatuses: ReturnType<typeof vi.fn<ProgressService['loadStepStatuses']>>;
  let user: ReturnType<typeof signal<UserRecord | null>>;
  let assigned: string[];
  let accessFails: boolean;
  let canOpen: ReturnType<typeof vi.fn<CourseAccessService['canOpen']>>;

  beforeEach(() => {
    assigned = [];
    accessFails = false;
    canOpen = vi.fn<CourseAccessService['canOpen']>(async (entry, viewer) => {
      if (accessFails) throw new ProgressError('unavailable', 'test');
      return canSee(
        entry,
        viewer.role === 'parent'
          ? { role: 'parent' }
          : { role: 'child', assigned: new Set(assigned) },
      );
    });
    failure = null;
    progressFails = false;
    statuses = groupStepStatuses([]);
    loadCourse = vi.fn(async (courseId: string) => {
      if (failure) throw new ContentError(failure, 'test');
      if (courseId === 'proefcursus') return proefcursus;
      if (courseId === 'proefhuiswerk') return proefhuiswerk;
      if (courseId === 'geheim') return { ...proefcursus, id: 'geheim', title: 'Geheim' };
      throw new ContentError('not-found', 'test');
    });
    loadStepStatuses = vi.fn<ProgressService['loadStepStatuses']>(async () => {
      if (progressFails) throw new ProgressError('unavailable', 'test');
      return statuses;
    });
    user = signal<UserRecord | null>({
      id: 'a1',
      username: 'kind-a',
      name: 'Kind A',
      role: 'child',
    });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'leren/:courseId', component: Course }]),
        { provide: ContentService, useValue: { loadCourse, loadManifest: async () => manifest } },
        { provide: ProgressService, useValue: { loadStepStatuses } },
        { provide: AuthService, useValue: { user } },
        { provide: CourseAccessService, useValue: { canOpen } },
      ],
    });
  });

  async function open(url = '/leren/proefcursus') {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    await harness.fixture.whenStable();
    const element = harness.routeNativeElement as HTMLElement;
    const button = (label: string) =>
      Array.from(element.querySelectorAll<HTMLElement>('button, a')).find(
        (candidate) => textOf(candidate) === label,
      );
    return { harness, element, button };
  }

  it('shows the course title, Ted with the greeting, the goal and the success criterion', async () => {
    const { element } = await open();
    expect(textOf(element.querySelector('h1'))).toBe('Proefcursus');
    const back = element.querySelector('a.back');
    expect(textOf(back)).toBe('Naar de start');
    expect(back?.getAttribute('href')).toBe('/');
    const greeting = element.querySelector('.greeting');
    expect(textOf(greeting)).toBe('Dit is een proefcursus. Hier test ik alles uit!');
    expect(moodOf(greeting)).toBe('happy');
    const goal = Array.from(element.querySelectorAll('.goal p')).map(textOf);
    expect(goal).toEqual([
      `Doel: ${proefcursus.goal}`,
      `Gelukt als: ${proefcursus.successCriterion}`,
    ]);
    expect(element.querySelector('.practice')).toBeNull();
  });

  it('shows subject, school level and chapter for a practice course', async () => {
    const { element } = await open('/leren/proefhuiswerk');
    expect(textOf(element.querySelector('.practice'))).toBe(
      'Rekenen · groep 7-8 · Hoofdstuk 0: breuken (testdata)',
    );
  });

  it('lists every lesson in course order with its number', async () => {
    const { element } = await open();
    // role="list" keeps the list semantics in Safari, despite list-style: none.
    expect(element.querySelector('ol.lessons')?.getAttribute('role')).toBe('list');
    const items = Array.from(element.querySelectorAll('ol.lessons > li snf-lesson-item'));
    expect(items.map((item) => textOf(item.querySelector('.number')))).toEqual(['1', '2']);
    expect(items.map((item) => textOf(item.querySelector('.title')))).toEqual([
      'Proefles: aanbeet of vastzitten?',
      'Proefles: een les die nog komt',
    ]);
    expect(items[0].querySelector('a')?.getAttribute('href')).toBe('/leren/proefcursus/proefles');
    expect(items[1].querySelector('a')).toBeNull();
  });

  it('shows the progress bar of the course', async () => {
    statuses = groupStepStatuses(done('proefles', ['uitleg', 'spel', 'quiz', 'zelf-doen']));
    const { element } = await open();
    const bar = element.querySelector('snf-progress-bar [role="progressbar"]');
    expect(bar?.getAttribute('aria-valuenow')).toBe('1');
    expect(bar?.getAttribute('aria-valuemax')).toBe('2');
    expect(textOf(element.querySelector('snf-progress-bar .label'))).toBe('1 van 2 lessen klaar');
  });

  it('offers Begin met for a new next lesson and Verder met for a started one', async () => {
    const { harness, button } = await open();
    const begin = button('Begin met: Proefles: aanbeet of vastzitten?');
    expect(begin?.getAttribute('href')).toBe('/leren/proefcursus/proefles');
    expect(textOf(harness.routeNativeElement?.querySelector('snf-lesson-item .label'))).toBe(
      'Nieuw',
    );

    // Away and back: the overview loads the progress again on every visit.
    statuses = groupStepStatuses([{ lesson_id: 'proefles', step_id: 'uitleg', status: 'started' }]);
    await harness.navigateByUrl('/leren/proefhuiswerk');
    await harness.navigateByUrl('/leren/proefcursus');
    await harness.fixture.whenStable();
    const element = harness.routeNativeElement as HTMLElement;
    const links = Array.from(element.querySelectorAll('a')).map(textOf);
    expect(links).toContain('Verder met: Proefles: aanbeet of vastzitten?');
    expect(links).not.toContain('Begin met: Proefles: aanbeet of vastzitten?');
    expect(element.querySelector('.next')?.getAttribute('href')).toBe(
      '/leren/proefcursus/proefles',
    );
    expect(textOf(element.querySelector('snf-lesson-item .label'))).toBe(
      'Bezig: 0 van 4 stappen klaar',
    );
  });

  it('says Alles klaar with Ted cool when every published lesson is completed', async () => {
    statuses = groupStepStatuses(done('proefles', ['uitleg', 'spel', 'quiz', 'zelf-doen']));
    const { element } = await open();
    const allDone = element.querySelector('.all-done');
    expect(textOf(allDone)).toBe('Alles klaar! Goed gesnuffeld.');
    expect(moodOf(allDone)).toBe('cool');
    expect(element.querySelector('.next')).toBeNull();
    expect(textOf(element.querySelector('snf-lesson-item .label'))).toBe('Klaar ✓');
  });

  it('loads the step statuses of the logged-in user for this course', async () => {
    await open();
    expect(loadStepStatuses).toHaveBeenCalledTimes(1);
    expect(loadStepStatuses).toHaveBeenCalledWith('a1', 'proefcursus');
  });

  it('shows no progress of the previous user while the new one is still loading', async () => {
    statuses = groupStepStatuses(done('proefles', ['uitleg', 'spel', 'quiz', 'zelf-doen']));
    const { harness, element } = await open();
    expect(textOf(element.querySelector('snf-lesson-item .label'))).toBe('Klaar ✓');

    // The request for the next user hangs.
    let resolve!: (value: StepStatuses) => void;
    loadStepStatuses.mockImplementation(
      () => new Promise<StepStatuses>((finish) => (resolve = finish)),
    );
    user.set({ id: 'b1', username: 'kind-b', name: 'Kind B', role: 'child' });
    for (let i = 0; i < 5; i++) await Promise.resolve();
    // Not whenStable: it would wait for the request that hangs.
    harness.fixture.detectChanges();
    expect(loadStepStatuses).toHaveBeenLastCalledWith('b1', 'proefcursus');
    expect(textOf(element.querySelector('h1'))).toBe('Proefcursus');
    expect(element.querySelectorAll('snf-lesson-item')).toHaveLength(2);
    expect(element.querySelector('[role="progressbar"]')).toBeNull();
    expect(element.querySelector('.label--new, .label--started, .label--completed')).toBeNull();
    expect(element.querySelector('.all-done')).toBeNull();
    expect(element.querySelector('.next')).toBeNull();
    expect(textOf(element)).not.toContain('lessen klaar');

    // Then the progress of the new user, and only that.
    resolve(groupStepStatuses([]));
    await harness.fixture.whenStable();
    expect(textOf(element.querySelector('snf-lesson-item .label'))).toBe('Nieuw');
    expect(
      element.querySelector('snf-progress-bar [role="progressbar"]')?.getAttribute('aria-valuenow'),
    ).toBe('0');
  });

  it('shows Ted oops for an unknown course', async () => {
    const { element, button } = await open('/leren/bestaat-niet');
    expect(textOf(element.querySelector('h1'))).toBe('Leertraject niet gevonden');
    const ted = element.querySelector('.state-ted');
    expect(textOf(ted)).toBe('Dit leertraject kan ik niet vinden.');
    expect(moodOf(ted)).toBe('oops');
    expect(button('Naar de start')?.getAttribute('href')).toBe('/');
    expect(loadStepStatuses).not.toHaveBeenCalled();
  });

  it('shows a retry when the course cannot be loaded', async () => {
    failure = 'unavailable';
    const { harness, element, button } = await open();
    expect(textOf(element.querySelector('.state-ted'))).toBe(
      'Snuffel kan dit leertraject nu niet laden.',
    );
    expect(button('Naar de start')?.getAttribute('href')).toBe('/');
    failure = null;
    button('Opnieuw')?.click();
    await harness.fixture.whenStable();
    expect(loadCourse).toHaveBeenCalledTimes(2);
    expect(textOf(harness.routeNativeElement?.querySelector('h1'))).toBe('Proefcursus');
  });

  it('shows the lessons without labels and a retry when progress cannot be loaded', async () => {
    progressFails = true;
    const { harness, element, button } = await open();
    const ted = element.querySelector('.progress-error snf-ted-says');
    expect(textOf(ted)).toBe('Je voortgang kan ik nu niet ophalen.');
    expect(moodOf(ted)).toBe('oops');
    expect(element.querySelectorAll('snf-lesson-item')).toHaveLength(2);
    expect(element.querySelector('.label--new, .label--started, .label--completed')).toBeNull();
    expect(element.querySelector('[role="progressbar"]')).toBeNull();
    expect(element.querySelector('.next')).toBeNull();

    progressFails = false;
    button('Opnieuw')?.click();
    await harness.fixture.whenStable();
    expect(loadStepStatuses).toHaveBeenCalledTimes(2);
    expect(element.querySelector('.progress-error')).toBeNull();
    expect(textOf(element.querySelector('.label--new'))).toBe('Nieuw');
  });

  it('sets the page title', async () => {
    const title = TestBed.inject(Title);
    const { harness } = await open();
    expect(title.getTitle()).toBe('Proefcursus · Snuffel');
    await harness.navigateByUrl('/leren/bestaat-niet');
    await harness.fixture.whenStable();
    expect(title.getTitle()).toBe('Leertraject niet gevonden · Snuffel');
  });
  describe('a course for selected children', () => {
    it('looks like an unknown course to a child without an assignment', async () => {
      const title = TestBed.inject(Title);
      const { harness } = await open('/leren/bestaat-niet');
      const element = () => harness.routeNativeElement as HTMLElement;
      const unknown = {
        heading: textOf(element().querySelector('h1')),
        ted: textOf(element().querySelector('.state-ted')),
        title: title.getTitle(),
      };
      loadCourse.mockClear();

      await harness.navigateByUrl('/leren/geheim');
      await harness.fixture.whenStable();
      expect(canOpen).toHaveBeenCalledWith(geheimEntry, expect.objectContaining({ id: 'a1' }));
      expect({
        heading: textOf(element().querySelector('h1')),
        ted: textOf(element().querySelector('.state-ted')),
        title: title.getTitle(),
      }).toEqual(unknown);
      expect(unknown.title).toBe('Leertraject niet gevonden · Snuffel');
      expect(loadCourse).not.toHaveBeenCalled();
      expect(loadStepStatuses).not.toHaveBeenCalled();
    });

    it('opens for a child with an assignment', async () => {
      assigned = ['geheim'];
      const { element } = await open('/leren/geheim');
      expect(textOf(element.querySelector('h1'))).toBe('Geheim');
    });

    it('opens for the parent without an assignment', async () => {
      user.set({ id: 'p1', username: 'ouder', name: 'Ouder', role: 'parent' });
      const { element } = await open('/leren/geheim');
      expect(textOf(element.querySelector('h1'))).toBe('Geheim');
    });

    it('shows a retry when the assignments cannot be loaded', async () => {
      accessFails = true;
      const { harness, element, button } = await open('/leren/geheim');
      expect(textOf(element.querySelector('.state-ted'))).toBe(
        'Snuffel kan dit leertraject nu niet laden.',
      );
      expect(loadCourse).not.toHaveBeenCalled();
      accessFails = false;
      assigned = ['geheim'];
      button('Opnieuw')?.click();
      await harness.fixture.whenStable();
      expect(textOf(harness.routeNativeElement?.querySelector('h1'))).toBe('Geheim');
    });
  });
});
