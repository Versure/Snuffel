import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { PracticeStep } from '../../../core/content/content.types';
import {
  LessonProgress,
  TICK_NOT_SAVED,
  type LessonProgressState,
} from '../../lesson-progress/lesson-progress';
import { Checklist } from './checklist';

const checkUrl = ['https', '://example.org/vispas-check'].join('');

const step: PracticeStep = {
  id: 'zelf-doen',
  type: 'practice',
  practiceKind: 'do-it-yourself',
  title: 'Aan het water',
  intro: 'Een spel voor *twee*.',
  items: [
    {
      id: 'vispas',
      text: 'Neem je VISpas mee.',
      links: [{ label: 'VISpas-check', url: checkUrl }],
      sourceRefs: [],
    },
    { id: 'tang', text: 'Stop een **onthaaktang** in de tas.', sourceRefs: [] },
    { id: 'bodem', text: 'Raak de bodem.', sourceRefs: [] },
  ],
  successCriterion: 'Gelukt als je het verschil voelt.',
};

const textOf = (element: Element | null): string =>
  (element?.textContent ?? '').replace(/\s+/g, ' ').trim();

/** A LessonProgress stand-in with the parts the checklist uses. */
function fakeProgress(checked: string[] = []) {
  const ticks = signal<readonly string[]>(checked);
  const state = signal<LessonProgressState>('ready');
  const error = signal<string | null>(null);
  return {
    ticks,
    stateSignal: state,
    error,
    state: state.asReadonly(),
    checked: vi.fn(() => ticks()),
    saveError: vi.fn(() => error()),
    toggle: vi.fn(async () => undefined),
    reload: vi.fn(async () => undefined),
  };
}

describe('Checklist', () => {
  async function render(progress?: ReturnType<typeof fakeProgress>) {
    TestBed.configureTestingModule({
      providers: progress ? [{ provide: LessonProgress, useValue: progress }] : [],
    });
    const fixture = TestBed.createComponent(Checklist);
    fixture.componentRef.setInput('step', step);
    await fixture.whenStable();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  const boxes = (element: HTMLElement) => [
    ...element.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
  ];

  it('shows every item with a checkbox and a label', async () => {
    const { element } = await render(fakeProgress());
    expect(textOf(element.querySelector('.intro'))).toBe('Een spel voor twee.');
    const items = [...element.querySelectorAll('snf-sticky-note ul.items > li')];
    expect(items).toHaveLength(3);
    for (const [index, item] of items.entries()) {
      const input = item.querySelector<HTMLInputElement>('input[type="checkbox"]');
      const label = item.querySelector('label');
      expect(input).not.toBeNull();
      expect(label?.contains(input)).toBe(true);
      expect(label?.getAttribute('for')).toBe(input?.id);
      expect(input?.checked).toBe(false);
      expect(textOf(label)).toBe(
        ['Neem je VISpas mee.', 'Stop een onthaaktang in de tas.', 'Raak de bodem.'][index],
      );
    }
    expect(new Set(boxes(element).map((box) => box.id)).size).toBe(3);
  });

  it('the label toggles the checkbox', async () => {
    const progress = fakeProgress();
    const { element } = await render(progress);
    element.querySelectorAll<HTMLElement>('label .text')[1].click();
    expect(progress.toggle).toHaveBeenCalledWith('zelf-doen', 'tang', true, [
      'vispas',
      'tang',
      'bodem',
    ]);
  });

  it('shows the saved ticks', async () => {
    const progress = fakeProgress(['vispas', 'bodem']);
    const { fixture, element } = await render(progress);
    expect(boxes(element).map((box) => box.checked)).toEqual([true, false, true]);
    expect(progress.checked).toHaveBeenCalledWith('zelf-doen');
    progress.ticks.set(['tang']);
    await fixture.whenStable();
    expect(boxes(element).map((box) => box.checked)).toEqual([false, true, false]);
  });

  it('ticking calls LessonProgress.toggle with all item ids', async () => {
    const progress = fakeProgress(['vispas']);
    const { element } = await render(progress);
    boxes(element)[2].click();
    expect(progress.toggle).toHaveBeenLastCalledWith('zelf-doen', 'bodem', true, [
      'vispas',
      'tang',
      'bodem',
    ]);
    boxes(element)[0].click();
    expect(progress.toggle).toHaveBeenLastCalledWith('zelf-doen', 'vispas', false, [
      'vispas',
      'tang',
      'bodem',
    ]);
  });

  it('links are outside the label and open in a new tab', async () => {
    const progress = fakeProgress();
    const { element } = await render(progress);
    const link = element.querySelector('ul.items > li a');
    expect(link?.closest('label')).toBeNull();
    expect(link?.getAttribute('href')).toBe(checkUrl);
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(textOf(link)).toBe('VISpas-check (opent in een nieuw tabblad)');
    link?.addEventListener('click', (event) => event.preventDefault());
    (link as HTMLElement).click();
    expect(progress.toggle).not.toHaveBeenCalled();
  });

  it('shows the success criterion without a checkbox', async () => {
    const { element } = await render(fakeProgress());
    const success = element.querySelector('snf-sticky-note .success');
    expect(textOf(success?.querySelector('strong') ?? null)).toBe(
      'Gelukt als je het verschil voelt.',
    );
    expect(success?.querySelector('input')).toBeNull();
    expect(success?.closest('label')).toBeNull();
  });

  it('checkboxes are disabled while progress is not ready', async () => {
    const progress = fakeProgress();
    progress.stateSignal.set('loading');
    const { fixture, element } = await render(progress);
    expect(boxes(element).every((box) => box.disabled)).toBe(true);
    expect(element.querySelector('.unavailable')).toBeNull();

    progress.stateSignal.set('unavailable');
    await fixture.whenStable();
    expect(boxes(element).every((box) => box.disabled)).toBe(true);
    expect(textOf(element.querySelector('.unavailable snf-speech-bubble'))).toBe(
      'Je voortgang kan ik nu niet ophalen.',
    );
    element.querySelector<HTMLButtonElement>('.unavailable button')?.click();
    expect(progress.reload).toHaveBeenCalled();

    progress.stateSignal.set('ready');
    await fixture.whenStable();
    expect(boxes(element).some((box) => box.disabled)).toBe(false);
    expect(element.querySelector('.unavailable')).toBeNull();
  });

  it('shows the save error as an alert', async () => {
    const progress = fakeProgress();
    const { fixture, element } = await render(progress);
    expect(element.querySelector('[role="alert"]')).toBeNull();
    progress.error.set(TICK_NOT_SAVED);
    await fixture.whenStable();
    expect(textOf(element.querySelector('[role="alert"]'))).toBe(
      'Dat vinkje is niet bewaard. Probeer het zo nog eens.',
    );
    expect(progress.saveError).toHaveBeenCalledWith('zelf-doen');
  });

  it('works without LessonProgress (in memory)', async () => {
    const { fixture, element } = await render();
    boxes(element)[1].click();
    await fixture.whenStable();
    expect(boxes(element).map((box) => box.checked)).toEqual([false, true, false]);
    boxes(element)[1].click();
    await fixture.whenStable();
    expect(boxes(element).map((box) => box.checked)).toEqual([false, false, false]);
    expect(boxes(element).some((box) => box.disabled)).toBe(false);
  });
});
