import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { AccountsService } from '../../../core/accounts/accounts.service';
import { ContentError } from '../../../core/content/content-error';
import { ContentService } from '../../../core/content/content.service';
import type { ContentManifest, ManifestCourse } from '../../../core/content/content.types';
import type { UserRecord } from '../../../core/pocketbase/types';
import { groupStepStatuses } from '../../../core/progress/course-progress';
import { ProgressError } from '../../../core/progress/progress-error';
import {
  ProgressService,
  type LessonRecords,
  type UserProgressSnapshot,
} from '../../../core/progress/progress.service';
import { checklistRecord, proefles, proeflesEntry, records, stepRecord } from '../testing';
import { ChildOverview } from './child';

const proefcursus: ManifestCourse = {
  id: 'proefcursus',
  title: 'Proefcursus',
  kind: 'course',
  file: 'proefcursus/course.json',
  hash: '0123456789abcdef',
  lessons: [
    proeflesEntry,
    {
      id: 'tweede',
      title: 'Tweede les',
      status: 'published',
      version: 1,
      file: 'proefcursus/lessons/02-tweede.json',
      hash: '0123456789abcdef',
      stepIds: ['uitleg'],
    },
    { id: 'later', title: 'Later', status: 'planned' },
  ],
  assets: [],
};
const proefhuiswerk: ManifestCourse = {
  id: 'proefhuiswerk',
  title: 'Proefhuiswerk',
  kind: 'practice',
  file: 'proefhuiswerk/course.json',
  hash: '0123456789abcdef',
  lessons: [
    {
      id: 'proefles-breuken',
      title: 'Breuken',
      status: 'published',
      version: 1,
      file: 'proefhuiswerk/lessons/01-proefles-breuken.json',
      hash: '0123456789abcdef',
      stepIds: ['oefenen'],
    },
  ],
  assets: [],
};
const manifest: ContentManifest = { schemaVersion: 1, courses: [proefhuiswerk, proefcursus] };

const lastYear = new Date().getFullYear() - 1;

const kindA: UserRecord = { id: 'a1', name: 'Kind A', username: 'kind-a', role: 'child' };

function snapshotOf(lessons: Record<string, LessonRecords>): UserProgressSnapshot {
  return {
    statuses: groupStepStatuses(Object.values(lessons).flatMap((lesson) => lesson.steps)),
    lessons: new Map(Object.entries(lessons)),
  };
}

const textOf = (element: Element | null | undefined) =>
  (element?.textContent ?? '').replace(/\s+/g, ' ').trim();

describe('ChildOverview', () => {
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let loadChild: ReturnType<typeof vi.fn<AccountsService['loadChild']>>;
  let loadUserProgress: ReturnType<typeof vi.fn<ProgressService['loadUserProgress']>>;
  let clearLesson: ReturnType<typeof vi.fn<ProgressService['clearLesson']>>;
  let loadLesson: ReturnType<typeof vi.fn<ContentService['loadLesson']>>;
  let snapshot: UserProgressSnapshot;
  let progressFails: boolean;
  let setTitle: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    params = new BehaviorSubject(convertToParamMap({ childId: 'a1' }));
    progressFails = false;
    snapshot = snapshotOf({
      proefles: records({
        steps: [
          stepRecord('uitleg', 'completed', new Date(lastYear, 0, 2, 9, 30).toISOString()),
          stepRecord('quiz', 'started', '2024-05-01 10:00:00.000Z'),
        ],
      }),
    });
    loadChild = vi.fn<AccountsService['loadChild']>(async (id) => (id === 'a1' ? kindA : null));
    loadUserProgress = vi.fn<ProgressService['loadUserProgress']>(async () => {
      if (progressFails) throw new ProgressError('unavailable', 'test');
      return snapshot;
    });
    clearLesson = vi.fn<ProgressService['clearLesson']>(async () => {
      snapshot = snapshotOf({});
    });
    loadLesson = vi.fn<ContentService['loadLesson']>(async (courseId, lessonId) => {
      if (lessonId === 'proefles') return proefles;
      throw new ContentError('unavailable', `${courseId}/${lessonId}`);
    });
    setTitle = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: params } },
        { provide: AccountsService, useValue: { loadChild } },
        {
          provide: ContentService,
          useValue: { loadManifest: async () => manifest, loadLesson },
        },
        { provide: ProgressService, useValue: { loadUserProgress, clearLesson } },
        { provide: Title, useValue: { setTitle } },
      ],
    });
  });

  async function render() {
    const fixture = TestBed.createComponent(ChildOverview);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const lesson = (title: string) =>
      Array.from(element.querySelectorAll('snf-child-lesson')).find(
        (candidate) => textOf(candidate.querySelector('h4')) === title,
      );
    return { fixture, element, lesson };
  }

  it('shows the name of the child and the last activity', async () => {
    const { element } = await render();
    expect(textOf(element.querySelector('h1'))).toBe('Kind A');
    expect(textOf(element.querySelector('main > .last-activity'))).toBe(
      `Laatst actief: 2 januari ${lastYear} om 9:30`,
    );
  });

  it('shows the courses in two sections with a progress bar', async () => {
    const { element } = await render();
    const sections = Array.from(element.querySelectorAll('section.section'));
    expect(sections.map((section) => textOf(section.querySelector('h2')))).toEqual([
      'Leertrajecten',
      'Huiswerk oefenen',
    ]);
    expect(textOf(sections[0].querySelector('h3'))).toBe('Proefcursus');
    const bar = sections[0].querySelector('[role="progressbar"]');
    expect(bar?.getAttribute('aria-valuenow')).toBe('0');
    expect(bar?.getAttribute('aria-valuemax')).toBe('3');
    expect(bar?.getAttribute('aria-label')).toBe('Voortgang Proefcursus');
    expect(textOf(sections[1].querySelector('h3'))).toBe('Proefhuiswerk');
  });

  it('lists the lessons in course order with their status', async () => {
    const { element } = await render();
    const lessons = Array.from(element.querySelectorAll('snf-child-lesson'));
    expect(
      lessons.map((lesson) => [
        textOf(lesson.querySelector('h4')),
        textOf(lesson.querySelector('snf-lesson-status')),
      ]),
    ).toEqual([
      ['Proefles', 'Bezig: 1 van 6 stappen klaar'],
      ['Tweede les', 'Nieuw'],
      ['Later', 'Komt nog'],
      ['Breuken', 'Nieuw'],
    ]);
  });

  it('loads only the lesson files of lessons with progress', async () => {
    const { lesson } = await render();
    expect(loadLesson).toHaveBeenCalledTimes(1);
    expect(loadLesson).toHaveBeenCalledWith('proefcursus', 'proefles');
    expect(lesson('Proefles')?.querySelector('.details')).not.toBeNull();
  });

  it('says Kind niet gevonden for an unknown id or a parent', async () => {
    params.next(convertToParamMap({ childId: 'ouder-id' }));
    const { element } = await render();
    expect(loadChild).toHaveBeenCalledWith('ouder-id');
    expect(textOf(element.querySelector('h1'))).toBe('Kind niet gevonden');
    expect(textOf(element.querySelector('snf-ted-says'))).toBe('Dit kind kan ik niet vinden.');
    expect(loadUserProgress).not.toHaveBeenCalled();
    expect(setTitle).toHaveBeenLastCalledWith('Kind niet gevonden · Ouderoverzicht · Snuffel');
  });

  it('shows a retry when the progress cannot be loaded', async () => {
    progressFails = true;
    const { fixture, element, lesson } = await render();
    expect(textOf(element.querySelector('.progress-error snf-ted-says'))).toBe(
      'De voortgang van dit kind kan ik nu niet ophalen.',
    );
    // The lessons are there, without bar and without numbers.
    expect(element.querySelector('[role="progressbar"]')).toBeNull();
    expect(lesson('Proefles')?.querySelector('snf-lesson-status')).toBeNull();
    expect(textOf(lesson('Later')?.querySelector('snf-lesson-status'))).toBe('Komt nog');
    progressFails = false;
    element.querySelector<HTMLButtonElement>('.progress-error button')?.click();
    await fixture.whenStable();
    expect(element.querySelector('.progress-error')).toBeNull();
    expect(element.querySelector('[role="progressbar"]')).not.toBeNull();
  });

  it('a lesson file that cannot be loaded shows a retry in that lesson only', async () => {
    snapshot = snapshotOf({
      proefles: records({ steps: [stepRecord('uitleg', 'completed')] }),
      tweede: records({ steps: [{ ...stepRecord('uitleg', 'started'), lesson_id: 'tweede' }] }),
    });
    const { fixture, element, lesson } = await render();
    expect(element.querySelectorAll('.content-error')).toHaveLength(1);
    expect(lesson('Tweede les')?.querySelector('.content-error')).not.toBeNull();
    expect(lesson('Proefles')?.querySelector('.details')).not.toBeNull();
    loadLesson.mockResolvedValue({ ...proefles, id: 'tweede', steps: [proefles.steps[0]] });
    lesson('Tweede les')?.querySelector<HTMLButtonElement>('.content-error button')?.click();
    await fixture.whenStable();
    expect(loadLesson).toHaveBeenLastCalledWith('proefcursus', 'tweede');
    expect(element.querySelectorAll('.content-error')).toHaveLength(0);
  });

  it('sets the page title', async () => {
    await render();
    expect(setTitle).toHaveBeenLastCalledWith('Kind A · Ouderoverzicht · Snuffel');
  });

  it('links back to the parent overview', async () => {
    const { element } = await render();
    const back = element.querySelector('a.back');
    expect(textOf(back)).toBe('Naar het ouderoverzicht');
    expect(back?.getAttribute('href')).toBe('/ouder');
  });

  const buttonIn = (element: Element | undefined, label: string) =>
    Array.from(element?.querySelectorAll<HTMLButtonElement>('button') ?? []).find(
      (candidate) => textOf(candidate) === label,
    );

  async function clearProefles() {
    const rendered = await render();
    buttonIn(rendered.lesson('Proefles'), 'Voortgang wissen')?.click();
    await rendered.fixture.whenStable();
    buttonIn(rendered.lesson('Proefles'), 'Ja, wissen')?.click();
    await rendered.fixture.whenStable();
    return rendered;
  }

  it('Ja, wissen clears the lesson of this child only', async () => {
    await clearProefles();
    expect(clearLesson).toHaveBeenCalledTimes(1);
    expect(clearLesson).toHaveBeenCalledWith('a1', 'proefles');
  });

  it('after clearing says it is cleared, moves the focus there and loads again', async () => {
    const { element, lesson } = await clearProefles();
    const message = element.querySelector<HTMLElement>('.cleared');
    expect(message?.getAttribute('aria-live')).toBe('polite');
    expect(textOf(message)).toBe('De voortgang van Proefles is gewist.');
    expect(document.activeElement).toBe(message);
    expect(loadUserProgress).toHaveBeenCalledTimes(2);
    expect(textOf(lesson('Proefles')?.querySelector('snf-lesson-status'))).toBe('Nieuw');
    expect(buttonIn(lesson('Proefles'), 'Voortgang wissen')).toBeUndefined();
  });

  it('after clearing the question is closed, also when the lesson has records again', async () => {
    // The child works on the lesson again while the parent clears it.
    clearLesson.mockImplementationOnce(async () => undefined);
    const { lesson } = await clearProefles();
    expect(loadUserProgress).toHaveBeenCalledTimes(2);
    expect(lesson('Proefles')?.querySelector('[role="group"]')).toBeNull();
    expect(buttonIn(lesson('Proefles'), 'Voortgang wissen')).toBeDefined();
  });

  it('a failed clear says not everything is cleared and offers Opnieuw', async () => {
    clearLesson.mockRejectedValueOnce(new ProgressError('unavailable', 'test'));
    const { fixture, element, lesson } = await clearProefles();
    expect(textOf(lesson('Proefles')?.querySelector('.clear-status'))).toBe(
      'Niet alles is gewist. Probeer het nog eens.',
    );
    expect(textOf(element.querySelector('.cleared'))).toBe('');
    // The progress loads again after the failed clear.
    expect(loadUserProgress).toHaveBeenCalledTimes(2);
    buttonIn(lesson('Proefles'), 'Opnieuw')?.click();
    await fixture.whenStable();
    expect(clearLesson).toHaveBeenCalledTimes(2);
    expect(textOf(element.querySelector('.cleared'))).toBe('De voortgang van Proefles is gewist.');
  });

  it('a failed clear shows what is left of the lesson', async () => {
    clearLesson.mockImplementationOnce(async () => {
      // The step records are gone, the checklist is not.
      snapshot = snapshotOf({ proefles: records({ checklists: [checklistRecord(['vispas'])] }) });
      throw new ProgressError('unavailable', 'test');
    });
    const { lesson } = await clearProefles();
    expect(loadUserProgress).toHaveBeenCalledTimes(2);
    expect(textOf(lesson('Proefles')?.querySelector('snf-lesson-status'))).toBe('Nieuw');
    expect(textOf(lesson('Proefles')?.querySelector('.clear-status'))).toBe(
      'Niet alles is gewist. Probeer het nog eens.',
    );
    expect(buttonIn(lesson('Proefles'), 'Opnieuw')).toBeDefined();
  });

  it('the buttons are disabled while clearing', async () => {
    let finish: () => void = () => undefined;
    clearLesson.mockImplementationOnce(() => new Promise<void>((resolve) => (finish = resolve)));
    const { fixture, lesson } = await render();
    buttonIn(lesson('Proefles'), 'Voortgang wissen')?.click();
    await fixture.whenStable();
    buttonIn(lesson('Proefles'), 'Ja, wissen')?.click();
    fixture.detectChanges();
    expect(buttonIn(lesson('Proefles'), 'Ja, wissen')?.disabled).toBe(true);
    expect(textOf(lesson('Proefles')?.querySelector('.clear-status'))).toBe('Bezig met wissen…');
    buttonIn(lesson('Proefles'), 'Ja, wissen')?.click();
    expect(clearLesson).toHaveBeenCalledTimes(1);
    finish();
    await fixture.whenStable();
  });

  /** Lets the app render while a load still runs (whenStable would wait for the load). */
  async function settle() {
    for (let round = 0; round < 3; round++) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }

  describe('while the progress loads again', () => {
    const tweedeRecords = records({
      steps: [{ ...stepRecord('uitleg', 'started'), lesson_id: 'tweede' }],
    });
    let finishClear: (error?: Error) => void;
    let finishLoad: () => void;

    beforeEach(() => {
      snapshot = snapshotOf({
        proefles: records({ steps: [stepRecord('uitleg', 'completed')] }),
        tweede: tweedeRecords,
      });
      finishClear = () => undefined;
      finishLoad = () => undefined;
      clearLesson.mockImplementationOnce(
        () =>
          new Promise<void>((resolve, reject) => {
            finishClear = (error) => (error ? reject(error) : resolve());
          }),
      );
    });

    /** Asks to clear Proefles and confirms, then opens the question in Tweede les. */
    async function startClearing() {
      const rendered = await render();
      const { fixture, lesson } = rendered;
      buttonIn(lesson('Proefles'), 'Voortgang wissen')?.click();
      await fixture.whenStable();
      buttonIn(lesson('Proefles'), 'Ja, wissen')?.click();
      buttonIn(lesson('Tweede les'), 'Voortgang wissen')?.click();
      await fixture.whenStable();
      const question = lesson('Tweede les')?.querySelector<HTMLElement>('[role="group"]');
      expect(question).toBeTruthy();
      expect(document.activeElement).toBe(question);
      // The next load waits until the test lets it finish.
      loadUserProgress.mockImplementationOnce(
        () =>
          new Promise<UserProgressSnapshot>((resolve) => {
            finishLoad = () => resolve(snapshot);
          }),
      );
      return { ...rendered, question };
    }

    it('an open question in another row stays open and keeps the focus', async () => {
      const { fixture, lesson, question } = await startClearing();
      snapshot = snapshotOf({ proefles: records(), tweede: tweedeRecords });
      finishClear(new ProgressError('unavailable', 'test'));
      await settle();
      expect(loadUserProgress).toHaveBeenCalledTimes(2);
      // Still loading: the rows keep the previous progress.
      expect(lesson('Tweede les')?.querySelector('[role="group"]')).toBe(question);
      expect(document.activeElement).toBe(question);
      expect(textOf(lesson('Proefles')?.querySelector('snf-lesson-status'))).not.toBe('');
      finishLoad();
      await fixture.whenStable();
      expect(lesson('Tweede les')?.querySelector('[role="group"]')).toBe(question);
      expect(document.activeElement).toBe(question);
    });

    it('an open question in another row stays open after a clear that succeeded', async () => {
      const { fixture, lesson, question } = await startClearing();
      snapshot = snapshotOf({ tweede: tweedeRecords });
      finishClear();
      await settle();
      expect(lesson('Tweede les')?.querySelector('[role="group"]')).toBe(question);
      finishLoad();
      await fixture.whenStable();
      expect(lesson('Tweede les')?.querySelector('[role="group"]')).toBe(question);
      expect(textOf(lesson('Proefles')?.querySelector('snf-lesson-status'))).toBe('Nieuw');
    });
  });

  describe('on the page of another child', () => {
    const kindB: UserRecord = { id: 'b1', name: 'Kind B', username: 'kind-b', role: 'child' };

    beforeEach(() => {
      loadChild.mockImplementation(async (id) =>
        id === 'a1' ? kindA : id === 'b1' ? kindB : null,
      );
    });

    it('shows nothing of a clear of the previous child', async () => {
      clearLesson.mockRejectedValueOnce(new ProgressError('unavailable', 'test'));
      const { fixture, element, lesson } = await clearProefles();
      expect(textOf(lesson('Proefles')?.querySelector('.clear-status'))).toBe(
        'Niet alles is gewist. Probeer het nog eens.',
      );
      snapshot = snapshotOf({ proefles: records({ steps: [stepRecord('uitleg', 'completed')] }) });
      params.next(convertToParamMap({ childId: 'b1' }));
      await fixture.whenStable();
      expect(textOf(element.querySelector('h1'))).toBe('Kind B');
      expect(lesson('Proefles')?.querySelector('.clear-status')).toBeNull();
      expect(lesson('Proefles')?.querySelector('[role="group"]')).toBeNull();
      // The question for child B asks again; it does not carry on the failed clear of child A.
      buttonIn(lesson('Proefles'), 'Voortgang wissen')?.click();
      await fixture.whenStable();
      expect(buttonIn(lesson('Proefles'), 'Ja, wissen')).toBeDefined();
      expect(buttonIn(lesson('Proefles'), 'Opnieuw')).toBeUndefined();
      expect(textOf(lesson('Proefles')?.querySelector('.clear-status'))).toBe('');
    });

    it('says nothing when a clear of the previous child ends there', async () => {
      let finish: () => void = () => undefined;
      clearLesson.mockImplementationOnce(() => new Promise<void>((resolve) => (finish = resolve)));
      const { fixture, element, lesson } = await render();
      buttonIn(lesson('Proefles'), 'Voortgang wissen')?.click();
      await fixture.whenStable();
      buttonIn(lesson('Proefles'), 'Ja, wissen')?.click();
      await settle();
      expect(clearLesson).toHaveBeenCalledWith('a1', 'proefles');
      params.next(convertToParamMap({ childId: 'b1' }));
      await fixture.whenStable();
      finish();
      await settle();
      await fixture.whenStable();
      expect(textOf(element.querySelector('h1'))).toBe('Kind B');
      expect(textOf(element.querySelector('.cleared'))).toBe('');
      expect(lesson('Proefles')?.querySelector('.clear-status')).toBeNull();
      expect(loadUserProgress).toHaveBeenLastCalledWith('b1');
    });
  });

  it('never shows the progress of the previous child while another child loads', async () => {
    const kindB: UserRecord = { id: 'b1', name: 'Kind B', username: 'kind-b', role: 'child' };
    loadChild.mockImplementation(async (id) => (id === 'a1' ? kindA : id === 'b1' ? kindB : null));
    const { fixture, element, lesson } = await render();
    expect(textOf(lesson('Proefles')?.querySelector('snf-lesson-status'))).toBe(
      'Bezig: 1 van 6 stappen klaar',
    );
    let finish: (value: UserProgressSnapshot) => void = () => undefined;
    loadUserProgress.mockImplementationOnce(
      () => new Promise<UserProgressSnapshot>((resolve) => (finish = resolve)),
    );
    params.next(convertToParamMap({ childId: 'b1' }));
    await settle();
    expect(textOf(element.querySelector('h1'))).toBe('Kind B');
    expect(loadUserProgress).toHaveBeenLastCalledWith('b1');
    expect(lesson('Proefles')?.querySelector('snf-lesson-status')).toBeNull();
    expect(element.querySelector('main > .last-activity')).toBeNull();
    finish(snapshotOf({}));
    await fixture.whenStable();
    expect(textOf(lesson('Proefles')?.querySelector('snf-lesson-status'))).toBe('Nieuw');
  });
});
