import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { Lesson, ManifestLesson } from '../../../core/content/content.types';
import type { LessonRecords } from '../../../core/progress/progress.service';
import {
  attemptRecord,
  checklistRecord,
  proefles,
  proeflesEntry,
  records,
  resultRecord,
  stepRecord,
} from '../testing';
import { ChildLesson } from './child-lesson';

const now = new Date(2026, 9, 23, 16, 0);

@Component({
  imports: [ChildLesson],
  template: `<snf-child-lesson
    [lesson]="lesson()"
    [content]="content()"
    [progress]="progress()"
    [now]="now"
    (retry)="retries = retries + 1"
  />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class Host {
  readonly now = now;
  readonly lesson = signal<ManifestLesson>(proeflesEntry);
  readonly content = signal<Lesson | 'unavailable' | null>(proefles);
  readonly progress = signal<LessonRecords | null>(records());
  retries = 0;
}

const textOf = (element: Element | null | undefined) =>
  (element?.textContent ?? '').replace(/\s+/g, ' ').trim();

/** The tag names of what the lesson shows. */
const partsOf = (element: HTMLElement) =>
  Array.from(element.querySelector('snf-child-lesson')?.children ?? []).map((part) => part.tagName);

async function render(
  progress: LessonRecords | null,
  content: Lesson | 'unavailable' | null = proefles,
) {
  const fixture = TestBed.createComponent(Host);
  fixture.componentInstance.progress.set(progress);
  fixture.componentInstance.content.set(content);
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  /** The lines of the detail of one step, by its title. */
  const detail = (title: string) => {
    const row = Array.from(element.querySelectorAll('.detail')).find(
      (candidate) => textOf(candidate.querySelector('dt')) === `${title}:`,
    );
    return row ? Array.from(row.querySelectorAll('dd')).map(textOf) : null;
  };
  return { fixture, element, detail };
}

const started = [stepRecord('uitleg', 'completed')];

describe('ChildLesson', () => {
  it('a lesson without records shows only its title and Nieuw', async () => {
    const { element } = await render(records());
    expect(textOf(element.querySelector('h4'))).toBe('Proefles');
    expect(textOf(element.querySelector('snf-lesson-status'))).toBe('Nieuw');
    expect(element.querySelector('.details')).toBeNull();
    expect(element.querySelector('.last-activity')).toBeNull();
    expect(partsOf(element)).toEqual(['H4', 'SNF-LESSON-STATUS']);
  });

  it('shows the quiz score', async () => {
    const attempts = [
      attemptRecord('v1', 'b', '2026-01-01 10:00:00.000Z', 1),
      attemptRecord('v1', 'a', '2026-01-01 10:01:00.000Z'),
      attemptRecord('v2', 'a', '2026-01-01 10:02:00.000Z', 2),
      attemptRecord('v3', 'a', '2026-01-01 10:03:00.000Z'),
      attemptRecord('v4', 'b', '2026-01-01 10:04:00.000Z'),
    ].reverse();
    const { detail } = await render(records({ steps: started, attempts }));
    expect(detail('Quiz')).toEqual(['3 van 4 goed', '5 antwoorden, 3 hints']);
  });

  it('shows a partly answered quiz', async () => {
    const attempts = [
      attemptRecord('v1', 'a', '2026-01-01 10:00:00.000Z', 1),
      attemptRecord('v2', 'b', '2026-01-01 10:01:00.000Z'),
    ];
    const { detail } = await render(records({ steps: started, attempts }));
    expect(detail('Quiz')).toEqual(['2 van 4 beantwoord, 1 goed', '2 antwoorden, 1 hint']);
  });

  it('says the quiz is not done yet', async () => {
    // An answer of an older version does not count.
    const attempts = [attemptRecord('v1', 'a', '2026-01-01 10:00:00.000Z', 0, 1)];
    const { detail } = await render(records({ steps: started, attempts }));
    expect(detail('Quiz')).toEqual(['nog niet gemaakt']);
  });

  it('shows the ticked items of a checklist', async () => {
    const { detail } = await render(
      records({ checklists: [checklistRecord(['vispas', 'net', 'verdwenen'])] }),
    );
    expect(detail('Aan het water')).toEqual(['2 van 3 afgevinkt']);
  });

  it('shows the latest result and the number of plays of a game', async () => {
    const results = [
      resultRecord('voel-spel', 7, 8, '2026-01-02 10:00:00.000Z'),
      resultRecord('voel-spel', 5, 8, '2026-01-01 10:00:00.000Z'),
    ];
    const { detail } = await render(records({ steps: started, results }));
    expect(detail('Voel de lijn')).toEqual(['7 van 8 goed', '2 keer gespeeld']);
  });

  it('shows hints and solutions of a stepped exercise', async () => {
    const help = {
      exercises: [
        { hints: 2, solution: true, correct: false },
        { hints: 1, solution: false, correct: true },
        { hints: 0, solution: false, correct: true },
      ],
    };
    const results = [resultRecord('breuken', 2, 3, '2026-01-02 10:00:00.000Z', help)];
    const { detail } = await render(records({ steps: started, results }));
    expect(detail('Oefenen')).toEqual([
      '2 van 3 zelf goed',
      '1 keer gemaakt',
      '3 hints, uitwerking bekeken bij 1 van 3 opgaven',
    ]);
  });

  it('says a game is not played yet', async () => {
    const { detail } = await render(records({ steps: started }));
    expect(detail('Voel de lijn')).toEqual(['nog niet gespeeld']);
    expect(detail('Oefenen')).toEqual(['nog niet gemaakt']);
    // An explanation only counts in the status.
    expect(detail('Uitleg')).toBeNull();
  });

  it('shows the last activity of the lesson', async () => {
    const today = new Date(2026, 9, 23, 14, 5).toISOString();
    const { element } = await render(
      records({ steps: [stepRecord('uitleg', 'completed', today), stepRecord('quiz', 'started')] }),
    );
    expect(textOf(element.querySelector('.last-activity'))).toBe('Laatst actief: vandaag om 14:05');
    expect(textOf(element.querySelector('snf-lesson-status'))).toBe('Bezig: 1 van 5 stappen klaar');
  });

  it('a planned lesson says Komt nog', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.lesson.set({ id: 'later', title: 'Later', status: 'planned' });
    fixture.componentInstance.content.set(null);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(partsOf(element)).toEqual(['H4', 'SNF-LESSON-STATUS']);
    expect(textOf(element.querySelector('snf-lesson-status'))).toBe('Komt nog');
  });

  it('a lesson file that cannot be loaded says so with a retry', async () => {
    const { fixture, element } = await render(records({ steps: started }), 'unavailable');
    expect(element.querySelector('.details')).toBeNull();
    expect(textOf(element.querySelector('snf-lesson-status'))).toBe('Bezig: 1 van 5 stappen klaar');
    expect(textOf(element.querySelector('.content-error p'))).toBe(
      'De details van deze les kan ik nu niet laden.',
    );
    element.querySelector<HTMLButtonElement>('.content-error button')?.click();
    expect(fixture.componentInstance.retries).toBe(1);
  });

  it('without progress shows no status and no details', async () => {
    const { element } = await render(null);
    expect(textOf(element)).toBe('Proefles');
  });
});
