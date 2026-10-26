import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  signal,
  type Type,
} from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { InteractionStep, LessonTed, TraceGameConfig } from '../../core/content/content.types';
import type { InteractionResultRecord } from '../../core/pocketbase/types';
import {
  LessonProgress,
  RESULT_NOT_SAVED,
  type LessonProgressState,
} from '../../shared/lesson-progress/lesson-progress';
import type { InteractionComponent, InteractionResult } from '../interaction';
import { INTERACTION_REGISTRY, type InteractionRegistry } from '../registry';
import { InteractionHost } from './interaction-host';

const result: InteractionResult = { score: 5, total: 8, detail: { rounds: [] } };

/** A stand-in for a game: shows its inputs and has buttons for its outputs. */
@Component({
  selector: 'snf-fake-game',
  template: `
    <p class="config">{{ config().rounds }} rondes</p>
    <p class="ted">{{ ted().correct[0] }}</p>
    <button type="button" class="answer" (click)="answered.emit()">Antwoord</button>
    <button type="button" class="finish" (click)="completed.emit(result)">Klaar</button>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class FakeGame implements InteractionComponent<TraceGameConfig> {
  readonly config = input.required<TraceGameConfig>();
  readonly ted = input.required<LessonTed>();
  readonly answered = output<void>();
  readonly completed = output<InteractionResult>();
  protected readonly result = result;
}

const traceStep: InteractionStep = {
  id: 'spel',
  type: 'interaction',
  title: 'Voel de lijn',
  intro: 'Voel mee.',
  interaction: {
    id: 'voel-spel',
    kind: 'trace-game',
    config: {
      choices: [
        { id: 'vis', label: 'Vis!', color: 'yellow' },
        { id: 'vast', label: 'Vast', color: 'purple' },
      ],
      patterns: [],
      rounds: 8,
      durationMs: 3200,
    },
  },
  sourceRefs: [],
};

const exerciseStep = {
  ...traceStep,
  interaction: { id: 'breuken', kind: 'stepped-exercise', config: { exercises: [] } },
} as unknown as InteractionStep;

const typingStep = {
  ...traceStep,
  interaction: {
    id: 'thuisrij',
    kind: 'typing-drill',
    config: { lines: ['asdf jkl;'], newKeys: [] },
  },
} as unknown as InteractionStep;

const ted: LessonTed = {
  intro: { mood: 'cool', text: 'Hoi.' },
  correct: ['Goed gevoeld!'],
  incorrect: ['Bijna.'],
  finished: 'Klaar.',
};

function resultRecord(score: number): InteractionResultRecord {
  return {
    id: 'r1',
    user: 'a1',
    created: '',
    updated: '',
    lesson_id: 'proefles',
    interaction_id: 'voel-spel',
    kind: 'trace-game',
    score,
    total: 8,
    detail: null,
    content_version: 1,
  };
}

/** A fake LessonProgress with signals the test changes. */
function fakeProgress() {
  const state = signal<LessonProgressState>('ready');
  const saveError = signal<string | null>(null);
  const latest = signal<InteractionResultRecord | null>(null);
  return {
    state,
    saveErrorValue: saveError,
    latest,
    value: {
      state: state.asReadonly(),
      saveError: vi.fn(() => saveError()),
      latestResult: vi.fn(() => latest()),
      markStep: vi.fn(async () => undefined),
      recordInteraction: vi.fn(async () => undefined),
      reload: vi.fn(async () => undefined),
    },
  };
}

describe('InteractionHost', () => {
  async function render(
    step: InteractionStep,
    options: {
      registry?: InteractionRegistry;
      progress?: ReturnType<typeof fakeProgress>;
    } = {},
  ): Promise<{ fixture: ComponentFixture<InteractionHost>; element: HTMLElement }> {
    const providers: unknown[] = [
      {
        provide: INTERACTION_REGISTRY,
        useValue: options.registry ?? { 'trace-game': async () => FakeGame },
      },
    ];
    if (options.progress) {
      providers.push({ provide: LessonProgress, useValue: options.progress.value });
    }
    TestBed.configureTestingModule({ providers: providers as never[] });
    const fixture = TestBed.createComponent(InteractionHost);
    fixture.componentRef.setInput('step', step);
    fixture.componentRef.setInput('ted', ted);
    await fixture.whenStable();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  async function click(fixture: ComponentFixture<InteractionHost>, selector: string) {
    const element = fixture.nativeElement as HTMLElement;
    const target = [...element.querySelectorAll<HTMLElement>(selector)][0];
    if (!target) throw new Error(`no ${selector}`);
    target.click();
    await fixture.whenStable();
  }

  const buttonWith = (element: HTMLElement, text: string) =>
    [...element.querySelectorAll('button')].find((item) => item.textContent?.trim() === text);

  it('renders the registered component with config and ted', async () => {
    const { element } = await render(traceStep);
    expect(element.querySelector('snf-fake-game .config')?.textContent).toBe('8 rondes');
    expect(element.querySelector('snf-fake-game .ted')?.textContent).toBe('Goed gevoeld!');
    expect(element.querySelector('snf-interaction-placeholder')).toBeNull();
    expect(element.textContent).not.toContain('Even laden');
  });

  it('falls back to the placeholder for a kind without a component', async () => {
    // A registry without stepped-exercise: since M10 the real one has every kind.
    const { element } = await render(exerciseStep, {
      registry: { 'trace-game': async () => FakeGame },
    });
    expect(element.querySelector('snf-interaction-placeholder')?.textContent).toContain(
      'Deze oefening komt binnenkort.',
    );
    expect(element.querySelector('snf-fake-game')).toBeNull();
  });

  it('shows a message with Opnieuw when the component cannot be loaded, and Opnieuw tries again', async () => {
    let resolveLoad: (type: Type<unknown>) => void = () => undefined;
    const load = vi
      .fn<() => Promise<Type<unknown>>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockImplementationOnce(
        () =>
          new Promise<Type<unknown>>((resolve) => {
            resolveLoad = resolve;
          }),
      );
    const { fixture, element } = await render(traceStep, { registry: { 'trace-game': load } });
    expect(element.textContent).toContain('Dit spel kan ik nu niet laden.');
    expect(element.querySelector('snf-fake-game')).toBeNull();

    buttonWith(element, 'Opnieuw')?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
    expect(element.textContent).toContain('Even laden…');
    resolveLoad(FakeGame);
    await fixture.whenStable();
    expect(load).toHaveBeenCalledTimes(2);
    expect(element.textContent).not.toContain('Dit spel kan ik nu niet laden.');
    expect(element.querySelector('snf-fake-game')).not.toBeNull();
  });

  it('says Deze oefening kan ik nu niet laden when a stepped exercise cannot be loaded', async () => {
    const load = vi
      .fn<() => Promise<Type<unknown>>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(FakeGame);
    const { fixture, element } = await render(exerciseStep, {
      registry: { 'stepped-exercise': load },
    });
    const panel = element.querySelector('.panel.failed');
    expect(panel?.textContent).toContain('Deze oefening kan ik nu niet laden.');
    expect(element.textContent).not.toContain('Dit spel kan ik nu niet laden.');
    // A light card, not the dark game panel.
    expect(panel?.classList.contains('light')).toBe(true);
    expect(buttonWith(element, 'Opnieuw')).toBeDefined();
    buttonWith(element, 'Opnieuw')?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await fixture.whenStable();
    expect(load).toHaveBeenCalledTimes(2);
    expect(element.querySelector('.panel')).toBeNull();
    expect(element.querySelector('snf-fake-game')).not.toBeNull();
  });

  it('a typing drill loads in a light panel', async () => {
    const load = vi.fn<() => Promise<Type<unknown>>>().mockRejectedValue(new Error('offline'));
    const { element } = await render(typingStep, { registry: { 'typing-drill': load } });
    // The same light card as an exercise, not the dark game panel.
    expect(element.querySelector('.panel.failed')?.classList.contains('light')).toBe(true);
  });

  it('a game that cannot be loaded keeps the dark panel', async () => {
    const load = vi.fn<() => Promise<Type<unknown>>>().mockRejectedValue(new Error('offline'));
    const { element } = await render(traceStep, { registry: { 'trace-game': load } });
    expect(element.querySelector('.panel.failed')?.classList.contains('light')).toBe(false);
  });

  it('completed of a stepped exercise records the result through LessonProgress', async () => {
    const progress = fakeProgress();
    const { fixture } = await render(exerciseStep, {
      progress,
      registry: { 'stepped-exercise': async () => FakeGame },
    });
    await click(fixture, 'snf-fake-game .answer');
    expect(progress.value.markStep).toHaveBeenCalledWith('spel', 'started');
    await click(fixture, 'snf-fake-game .finish');
    expect(progress.value.recordInteraction).toHaveBeenCalledWith(
      'spel',
      exerciseStep.interaction,
      result,
    );
  });

  it('answered marks the step started', async () => {
    const progress = fakeProgress();
    const { fixture } = await render(traceStep, { progress });
    await click(fixture, 'snf-fake-game .answer');
    expect(progress.value.markStep).toHaveBeenCalledWith('spel', 'started');
  });

  it('completed records the result through LessonProgress', async () => {
    const progress = fakeProgress();
    const { fixture } = await render(traceStep, { progress });
    await click(fixture, 'snf-fake-game .finish');
    expect(progress.value.recordInteraction).toHaveBeenCalledWith(
      'spel',
      traceStep.interaction,
      result,
    );
  });

  it('shows the previous result of this content version', async () => {
    const progress = fakeProgress();
    const { fixture, element } = await render(traceStep, { progress });
    expect(element.querySelector('.previous')).toBeNull();
    progress.latest.set(resultRecord(6));
    await fixture.whenStable();
    expect(progress.value.latestResult).toHaveBeenCalledWith('voel-spel');
    expect(element.querySelector('.previous')?.textContent?.trim()).toBe(
      'Vorige keer: 6 van 8 goed.',
    );
  });

  it('shows the save error as an alert', async () => {
    const progress = fakeProgress();
    const { fixture, element } = await render(traceStep, { progress });
    expect(element.querySelector('[role="alert"]')).toBeNull();
    progress.saveErrorValue.set(RESULT_NOT_SAVED);
    await fixture.whenStable();
    expect(progress.value.saveError).toHaveBeenCalledWith('spel');
    expect(element.querySelector('[role="alert"]')?.textContent?.trim()).toBe(
      'Je score is niet bewaard.',
    );
  });

  it('shows Ted oops with Opnieuw when progress is unavailable and the game stays playable', async () => {
    const progress = fakeProgress();
    progress.state.set('unavailable');
    const { fixture, element } = await render(traceStep, { progress });
    expect(element.querySelector('.unavailable')?.textContent).toContain(
      'Je voortgang kan ik nu niet ophalen.',
    );
    expect(element.querySelector('.unavailable snf-ted svg')?.getAttribute('aria-hidden')).toBe(
      'true',
    );
    expect(element.querySelector('snf-fake-game')).not.toBeNull();
    await click(fixture, '.unavailable button');
    expect(progress.value.reload).toHaveBeenCalledTimes(1);
    await click(fixture, 'snf-fake-game .finish');
    expect(progress.value.recordInteraction).toHaveBeenCalled();
  });

  it('works without LessonProgress', async () => {
    const { fixture, element } = await render(traceStep);
    await click(fixture, 'snf-fake-game .answer');
    await click(fixture, 'snf-fake-game .finish');
    expect(element.querySelector('.unavailable')).toBeNull();
    expect(element.querySelector('.previous')).toBeNull();
    expect(element.querySelector('[role="alert"]')).toBeNull();
    expect(element.querySelector('snf-fake-game')).not.toBeNull();
  });
});
