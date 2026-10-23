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
import { ChildLesson, type ClearState } from './child-lesson';

const now = new Date(2026, 9, 23, 16, 0);

@Component({
  imports: [ChildLesson],
  template: `<snf-child-lesson
    [lesson]="lesson()"
    [content]="content()"
    [progress]="progress()"
    [now]="now"
    childName="Kind A"
    [clearState]="clearState()"
    (retry)="retries = retries + 1"
    (clear)="clears = clears + 1"
  />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class Host {
  readonly now = now;
  readonly lesson = signal<ManifestLesson>(proeflesEntry);
  readonly content = signal<Lesson | 'unavailable' | null>(proefles);
  readonly progress = signal<LessonRecords | null>(records());
  readonly clearState = signal<ClearState>('idle');
  retries = 0;
  clears = 0;
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

  const buttonIn = (element: HTMLElement, label: string) =>
    Array.from(element.querySelectorAll<HTMLButtonElement>('button')).find(
      (candidate) => textOf(candidate) === label,
    );

  it('the clear button is there only when the lesson has records', async () => {
    const empty = await render(records());
    expect(buttonIn(empty.element, 'Voortgang wissen')).toBeUndefined();
    empty.fixture.componentInstance.progress.set(null);
    await empty.fixture.whenStable();
    expect(buttonIn(empty.element, 'Voortgang wissen')).toBeUndefined();
    empty.fixture.componentInstance.progress.set(
      records({ checklists: [checklistRecord(['vispas'])] }),
    );
    await empty.fixture.whenStable();
    expect(buttonIn(empty.element, 'Voortgang wissen')).toBeDefined();
  });

  it('clear asks for confirmation with the lesson and the name', async () => {
    const { fixture, element } = await render(records({ steps: started }));
    buttonIn(element, 'Voortgang wissen')?.click();
    await fixture.whenStable();
    const question = element.querySelector<HTMLElement>('[role="group"]');
    expect(question).not.toBeNull();
    const label = document.getElementById(question?.getAttribute('aria-labelledby') ?? '');
    expect(textOf(label)).toBe(
      'Alles van Proefles voor Kind A wissen? Stappen, quizantwoorden, vinkjes en scores gaan weg. Dit kan niet terug.',
    );
    expect(document.activeElement).toBe(question);
    expect(buttonIn(element, 'Voortgang wissen')).toBeUndefined();
    expect(fixture.componentInstance.clears).toBe(0);
    buttonIn(element, 'Ja, wissen')?.click();
    expect(fixture.componentInstance.clears).toBe(1);
  });

  it('Annuleren and Escape close the question and give the focus back', async () => {
    const { fixture, element } = await render(records({ steps: started }));
    buttonIn(element, 'Voortgang wissen')?.click();
    await fixture.whenStable();
    buttonIn(element, 'Annuleren')?.click();
    await fixture.whenStable();
    expect(element.querySelector('[role="group"]')).toBeNull();
    expect(document.activeElement).toBe(buttonIn(element, 'Voortgang wissen'));

    buttonIn(element, 'Voortgang wissen')?.click();
    await fixture.whenStable();
    element
      .querySelector('[role="group"]')
      ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await fixture.whenStable();
    expect(element.querySelector('[role="group"]')).toBeNull();
    expect(document.activeElement).toBe(buttonIn(element, 'Voortgang wissen'));
    expect(fixture.componentInstance.clears).toBe(0);
  });

  it('the buttons are disabled while clearing', async () => {
    const { fixture, element } = await render(records({ steps: started }));
    buttonIn(element, 'Voortgang wissen')?.click();
    await fixture.whenStable();
    fixture.componentInstance.clearState.set('clearing');
    await fixture.whenStable();
    expect(textOf(element.querySelector('.clear-status'))).toBe('Bezig met wissen…');
    expect(buttonIn(element, 'Ja, wissen')?.disabled).toBe(true);
    expect(buttonIn(element, 'Annuleren')?.disabled).toBe(true);
    // Escape does not close the question while clearing.
    element
      .querySelector('[role="group"]')
      ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await fixture.whenStable();
    expect(element.querySelector('[role="group"]')).not.toBeNull();
  });

  it('a failed clear says not everything is cleared and offers Opnieuw', async () => {
    const { fixture, element } = await render(records({ steps: started }));
    buttonIn(element, 'Voortgang wissen')?.click();
    await fixture.whenStable();
    fixture.componentInstance.clearState.set('failed');
    await fixture.whenStable();
    expect(textOf(element.querySelector('.clear-status'))).toBe(
      'Niet alles is gewist. Probeer het nog eens.',
    );
    buttonIn(element, 'Opnieuw')?.click();
    expect(fixture.componentInstance.clears).toBe(1);
  });
});
