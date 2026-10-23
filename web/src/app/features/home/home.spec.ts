import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ContentError, type ContentErrorReason } from '../../core/content/content-error';
import { ContentService } from '../../core/content/content.service';
import type {
  ContentManifest,
  ManifestCourse,
  ManifestLesson,
} from '../../core/content/content.types';
import type { UserRecord } from '../../core/pocketbase/types';
import { groupStepStatuses, type StepStatuses } from '../../core/progress/course-progress';
import { ProgressError } from '../../core/progress/progress-error';
import { ProgressService } from '../../core/progress/progress.service';
import { Home } from './home';

const lesson = (id: string, stepIds: string[]): ManifestLesson => ({
  id,
  title: id,
  status: 'published',
  version: 1,
  estimatedMinutes: 10,
  file: `x/lessons/${id}.json`,
  hash: '0123456789abcdef',
  stepIds,
});

const course = (
  id: string,
  title: string,
  kind: ManifestCourse['kind'],
  lessons: ManifestLesson[],
): ManifestCourse => ({
  id,
  title,
  kind,
  file: `${id}/course.json`,
  hash: '0123456789abcdef',
  lessons,
  assets: [],
});

const proefcursus = course('proefcursus', 'Proefcursus', 'course', [
  lesson('proefles', ['uitleg', 'quiz']),
  { id: 'proefles-later', title: 'Later', status: 'planned' },
]);
const aardrijkskunde = course('aardrijkskunde', 'Aardrijkskunde', 'course', [
  lesson('kaart', ['uitleg']),
]);
const proefhuiswerk = course('proefhuiswerk', 'Proefhuiswerk', 'practice', [
  lesson('proefles-breuken', ['oefenen']),
]);

const fullManifest: ContentManifest = {
  schemaVersion: 1,
  courses: [proefcursus, proefhuiswerk, aardrijkskunde],
};

const textOf = (element: Element | null | undefined) =>
  (element?.textContent ?? '').replace(/\s+/g, ' ').trim();

/** The mood of the Ted in `tedSays`, from the face variables on its svg. */
function moodOf(tedSays: Element | null | undefined): string {
  const svg = tedSays?.querySelector<SVGSVGElement>('snf-ted svg');
  const on = (name: string) => svg?.style.getPropertyValue(name).trim() === 'inline';
  if (on('--m-mond-oeps')) return 'oops';
  if (on('--m-mond-denk')) return 'thinking';
  if (on('--m-ogen-blij')) return 'happy';
  return 'cool';
}

describe('Home', () => {
  let user: ReturnType<typeof signal<UserRecord | null>>;
  let loadManifest: ReturnType<typeof vi.fn<() => Promise<ContentManifest>>>;
  let loadStepStatuses: ReturnType<typeof vi.fn<ProgressService['loadStepStatuses']>>;
  let manifest: ContentManifest;
  let contentFailure: ContentErrorReason | null;
  let progressFails: boolean;
  let statuses: StepStatuses;

  beforeEach(() => {
    manifest = fullManifest;
    contentFailure = null;
    progressFails = false;
    statuses = groupStepStatuses([]);
    user = signal<UserRecord | null>({
      id: 'a1',
      username: 'kind-a',
      name: 'Kind A',
      role: 'child',
    });
    loadManifest = vi.fn(async () => {
      if (contentFailure) throw new ContentError(contentFailure, 'test');
      return manifest;
    });
    loadStepStatuses = vi.fn<ProgressService['loadStepStatuses']>(async () => {
      if (progressFails) throw new ProgressError('unavailable', 'test');
      return statuses;
    });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { user } },
        { provide: ContentService, useValue: { loadManifest } },
        { provide: ProgressService, useValue: { loadStepStatuses } },
      ],
    });
  });

  async function render() {
    const fixture = TestBed.createComponent(Home);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const button = (label: string) =>
      Array.from(element.querySelectorAll<HTMLButtonElement>('button')).find(
        (candidate) => textOf(candidate) === label,
      );
    return { fixture, element, button };
  }

  it('renders the Snuffel heading', async () => {
    const { element } = await render();
    expect(element.querySelector('h1')?.textContent).toBe('Snuffel');
  });

  it('greets the user by name with a happy Ted', async () => {
    const { element } = await render();
    const ted = element.querySelector('.ted');
    expect(textOf(ted?.querySelector('.greeting'))).toBe('Hoi, Kind A!');
    expect(Array.from(ted?.querySelectorAll('p') ?? []).map(textOf)).toEqual([
      'Hoi, Kind A!',
      'Waar gaan we vandaag op snuffelen?',
    ]);
    expect(moodOf(ted)).toBe('happy');
  });

  it('follows a change of name', async () => {
    const { fixture, element } = await render();
    user.set({ id: 'a1', username: 'kind-a', name: 'Anna', role: 'child' });
    await fixture.whenStable();
    expect(textOf(element.querySelector('.greeting'))).toBe('Hoi, Anna!');
  });

  it('shows courses and practice courses in two sections sorted by title', async () => {
    const { element } = await render();
    const sections = Array.from(element.querySelectorAll('section'));
    expect(sections.map((section) => textOf(section.querySelector('h2')))).toEqual([
      'Leertrajecten',
      'Huiswerk oefenen',
    ]);
    const titles = sections.map((section) =>
      Array.from(section.querySelectorAll('snf-course-card h3')).map(textOf),
    );
    expect(titles).toEqual([['Aardrijkskunde', 'Proefcursus'], ['Proefhuiswerk']]);
    expect(element.querySelectorAll('snf-course-card [role="progressbar"]')).toHaveLength(3);
  });

  it('leaves out a section without courses', async () => {
    manifest = { schemaVersion: 1, courses: [proefhuiswerk] };
    const { element } = await render();
    expect(Array.from(element.querySelectorAll('section h2')).map(textOf)).toEqual([
      'Huiswerk oefenen',
    ]);
  });

  it('says there are no courses yet when the manifest is empty', async () => {
    manifest = { schemaVersion: 1, courses: [] };
    const { element } = await render();
    const ted = element.querySelector('.state-ted');
    expect(textOf(ted)).toBe(
      'Er staan nog geen leertrajecten klaar. Ted is nog aan het snuffelen.',
    );
    expect(moodOf(ted)).toBe('thinking');
    expect(element.querySelector('section')).toBeNull();
  });

  it('shows a retry when the content cannot be loaded', async () => {
    contentFailure = 'unavailable';
    const { fixture, element, button } = await render();
    const ted = element.querySelector('.state-ted');
    expect(textOf(ted)).toBe('Snuffel kan de leertrajecten nu niet laden.');
    expect(moodOf(ted)).toBe('oops');
    expect(element.querySelector('snf-course-card')).toBeNull();

    contentFailure = null;
    button('Opnieuw')?.click();
    await fixture.whenStable();
    expect(loadManifest).toHaveBeenCalledTimes(2);
    expect(element.querySelectorAll('snf-course-card')).toHaveLength(3);
  });

  it('asks to refresh for an unsupported schema version', async () => {
    contentFailure = 'unsupported-version';
    const { element, button } = await render();
    expect(textOf(element.querySelector('.state-ted'))).toBe(
      'Deze inhoud is gemaakt voor een nieuwere versie van Snuffel. Ververs de pagina.',
    );
    expect(button('Opnieuw')).toBeUndefined();
  });

  it('loads the step statuses of the logged-in user', async () => {
    statuses = groupStepStatuses([
      { lesson_id: 'proefles', step_id: 'uitleg', status: 'completed' },
      { lesson_id: 'proefles', step_id: 'quiz', status: 'completed' },
    ]);
    const { element } = await render();
    expect(loadStepStatuses).toHaveBeenCalledTimes(1);
    expect(loadStepStatuses).toHaveBeenCalledWith('a1');
    const card = Array.from(element.querySelectorAll('snf-course-card')).find(
      (candidate) => textOf(candidate.querySelector('h3')) === 'Proefcursus',
    );
    const bar = card?.querySelector('[role="progressbar"]');
    expect(bar?.getAttribute('aria-valuenow')).toBe('1');
    expect(bar?.getAttribute('aria-valuemax')).toBe('2');
    expect(textOf(card?.querySelector('.label'))).toBe('1 van 2 lessen klaar');
  });

  it('loads again for another user', async () => {
    const { fixture, element } = await render();
    expect(loadStepStatuses).toHaveBeenCalledTimes(1);

    // A renewed session of the same user does not load again.
    user.set({ id: 'a1', username: 'kind-a', name: 'Kind A', role: 'child' });
    await fixture.whenStable();
    expect(loadStepStatuses).toHaveBeenCalledTimes(1);

    statuses = groupStepStatuses([{ lesson_id: 'kaart', step_id: 'uitleg', status: 'completed' }]);
    user.set({ id: 'b1', username: 'kind-b', name: 'Kind B', role: 'child' });
    await fixture.whenStable();
    expect(loadStepStatuses).toHaveBeenCalledTimes(2);
    expect(loadStepStatuses).toHaveBeenLastCalledWith('b1');
    const labels = Array.from(element.querySelectorAll('snf-course-card .label')).map(textOf);
    expect(labels).toEqual(['Alle lessen klaar!', '0 van 2 lessen klaar', '0 van 1 lessen klaar']);
  });

  it('shows the courses without bars and a retry when progress cannot be loaded', async () => {
    progressFails = true;
    const { element, button } = await render();
    const ted = element.querySelector('.progress-error snf-ted-says');
    expect(textOf(ted)).toBe('Je voortgang kan ik nu niet ophalen.');
    expect(moodOf(ted)).toBe('oops');
    expect(button('Opnieuw')).toBeDefined();
    expect(element.querySelectorAll('snf-course-card')).toHaveLength(3);
    expect(element.querySelector('[role="progressbar"]')).toBeNull();
    expect(textOf(element)).not.toContain('lessen klaar');
  });

  it('retry loads the progress again', async () => {
    progressFails = true;
    const { fixture, element, button } = await render();
    progressFails = false;
    button('Opnieuw')?.click();
    await fixture.whenStable();
    expect(loadStepStatuses).toHaveBeenCalledTimes(2);
    expect(loadManifest).toHaveBeenCalledTimes(1);
    expect(element.querySelector('.progress-error')).toBeNull();
    expect(element.querySelectorAll('[role="progressbar"]')).toHaveLength(3);
  });
});
