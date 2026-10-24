import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AccountsService } from '../../core/accounts/accounts.service';
import { ContentService } from '../../core/content/content.service';
import type { ContentManifest, ManifestLesson } from '../../core/content/content.types';
import type { UserRecord } from '../../core/pocketbase/types';
import { groupStepStatuses } from '../../core/progress/course-progress';
import { ProgressError } from '../../core/progress/progress-error';
import { ProgressService, type ChildActivity } from '../../core/progress/progress.service';
import { Parent } from './parent';

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

const manifest: ContentManifest = {
  schemaVersion: 1,
  courses: [
    {
      id: 'proefcursus',
      title: 'Proefcursus',
      kind: 'course',
      file: 'proefcursus/course.json',
      hash: '0123456789abcdef',
      lessons: [lesson('proefles', ['uitleg', 'quiz']), lesson('tweede', ['uitleg'])],
      assets: [],
    },
  ],
};

const child = (id: string, name: string): UserRecord => ({
  id,
  name,
  username: name.toLowerCase().replace(' ', '-'),
  role: 'child',
});

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

describe('Parent', () => {
  let children: UserRecord[];
  let childrenFail: boolean;
  let activityFails: boolean;
  let activity: Map<string, ChildActivity>;
  let loadActivity: ReturnType<typeof vi.fn<ProgressService['loadActivity']>>;

  beforeEach(() => {
    children = [child('a1', 'Kind A'), child('b1', 'Kind B')];
    childrenFail = false;
    activityFails = false;
    activity = new Map([
      [
        'a1',
        {
          statuses: groupStepStatuses([
            { lesson_id: 'proefles', step_id: 'uitleg', status: 'completed' },
            { lesson_id: 'proefles', step_id: 'quiz', status: 'completed' },
          ]),
          lastActivity: new Date(2020, 0, 2, 9, 30).toISOString(),
        },
      ],
    ]);
    loadActivity = vi.fn<ProgressService['loadActivity']>(async () => {
      if (activityFails) throw new ProgressError('unavailable', 'test');
      return activity;
    });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AccountsService,
          useValue: {
            loadChildren: async () => {
              if (childrenFail) throw new ProgressError('unavailable', 'test');
              return children;
            },
          },
        },
        { provide: ContentService, useValue: { loadManifest: async () => manifest } },
        { provide: ProgressService, useValue: { loadActivity } },
      ],
    });
  });

  async function render() {
    const fixture = TestBed.createComponent(Parent);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const button = (label: string) =>
      Array.from(element.querySelectorAll<HTMLButtonElement>('button')).find(
        (candidate) => textOf(candidate) === label,
      );
    return { fixture, element, button };
  }

  it('shows the Ouderoverzicht heading and a happy Ted', async () => {
    const { element } = await render();
    expect(textOf(element.querySelector('h1'))).toBe('Ouderoverzicht');
    const ted = element.querySelector('.ted');
    expect(textOf(ted)).toBe('Zo gaat het met de kinderen.');
    expect(moodOf(ted)).toBe('happy');
  });

  it('shows a card per child in name order', async () => {
    const { element } = await render();
    const cards = Array.from(element.querySelectorAll('snf-child-card'));
    expect(cards.map((card) => textOf(card.querySelector('h2')))).toEqual(['Kind A', 'Kind B']);
    expect(textOf(cards[0].querySelector('.last-activity'))).toBe(
      'Laatst actief: 2 januari 2020 om 9:30',
    );
    expect(textOf(cards[0].querySelector('.lessons-completed'))).toBe('1 les klaar');
    expect(textOf(cards[1].querySelector('.last-activity'))).toBe('Nog niet actief');
    expect(textOf(cards[1].querySelector('.lessons-completed'))).toBe('0 lessen klaar');
  });

  it('does not show the parent itself', async () => {
    children = [
      child('a1', 'Kind A'),
      { id: 'p1', name: 'Ouder', username: 'ouder', role: 'parent' },
    ];
    const { element } = await render();
    const names = Array.from(element.querySelectorAll('snf-child-card h2')).map(textOf);
    expect(names).toEqual(['Kind A']);
  });

  it('says there are no children yet', async () => {
    children = [];
    const { element } = await render();
    expect(element.querySelector('snf-child-card')).toBeNull();
    const ted = element.querySelector('.state-ted');
    expect(textOf(ted)).toBe(
      'Er zijn nog geen kinderaccounts. Maak ze aan in het beheerscherm, zie de README.',
    );
    expect(moodOf(ted)).toBe('thinking');
  });

  it('shows a retry when the children cannot be loaded', async () => {
    childrenFail = true;
    const { fixture, element, button } = await render();
    const ted = element.querySelector('.state-ted');
    expect(textOf(ted)).toBe('Het ouderoverzicht kan ik nu niet laden.');
    expect(moodOf(ted)).toBe('oops');
    childrenFail = false;
    button('Opnieuw')?.click();
    await fixture.whenStable();
    expect(element.querySelectorAll('snf-child-card')).toHaveLength(2);
  });

  it('shows the cards without numbers and a retry when the activity cannot be loaded', async () => {
    activityFails = true;
    const { element, button } = await render();
    const cards = Array.from(element.querySelectorAll('snf-child-card'));
    expect(cards.map(textOf)).toEqual(['Kind A', 'Kind B']);
    expect(textOf(element.querySelector('.activity-error snf-ted-says'))).toBe(
      'De voortgang van de kinderen kan ik nu niet ophalen.',
    );
    expect(button('Opnieuw')).toBeDefined();
  });

  it('retry loads the activity again', async () => {
    activityFails = true;
    const { fixture, element, button } = await render();
    expect(loadActivity).toHaveBeenCalledTimes(1);
    activityFails = false;
    button('Opnieuw')?.click();
    await fixture.whenStable();
    expect(loadActivity).toHaveBeenCalledTimes(2);
    expect(element.querySelector('.activity-error')).toBeNull();
    expect(textOf(element.querySelector('snf-child-card .lessons-completed'))).toBe('1 les klaar');
  });
});
