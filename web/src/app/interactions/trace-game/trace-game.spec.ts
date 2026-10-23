import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { LessonTed, TraceGameConfig } from '../../core/content/content.types';
import { ANIMATION_FRAMES, REDUCED_MOTION, type AnimationFrames } from '../../core/motion/motion';
import { RANDOM } from '../../core/random/random';
import type { InteractionResult } from '../interaction';
import { rodPath, tracePoints } from './geometry';
import { shapeValue } from './shape';
import { TRACE_TEXT, TraceGame } from './trace-game';

const config: TraceGameConfig = {
  choices: [
    { id: 'vis', label: 'Vis!', color: 'yellow' },
    { id: 'vast', label: 'Vast', color: 'purple' },
    { id: 'plant', label: 'Plant', color: 'green' },
  ],
  patterns: [
    {
      id: 'tik',
      answer: 'vis',
      shape: [
        { type: 'base', level: 0.22 },
        { type: 'pulse', at: 0.5, width: 0.02, height: 0.6 },
      ],
      explanation: 'Een korte tik: een vis.',
    },
    {
      id: 'vast',
      answer: 'vast',
      shape: [
        { type: 'base', level: 0.22 },
        { type: 'ramp', from: 0.3, to: 0.4, height: 0.6 },
      ],
      explanation: 'Zwaar en vlak: vast.',
    },
  ],
  rounds: 3,
  durationMs: 1000,
};

const ted: LessonTed = {
  intro: { mood: 'cool', text: 'Hoi.' },
  correct: ['Goed gevoeld!'],
  incorrect: ['Bijna.'],
  finished: 'Klaar.',
};

/** Animation frames that only run when the test says so. */
class ManualFrames implements AnimationFrames {
  private nextHandle = 1;
  readonly pending = new Map<number, (time: number) => void>();

  request(callback: (time: number) => void): number {
    const handle = this.nextHandle++;
    this.pending.set(handle, callback);
    return handle;
  }

  cancel(handle: number): void {
    this.pending.delete(handle);
  }

  /** Runs every pending frame at `time`. */
  run(time: number): void {
    const callbacks = [...this.pending.values()];
    this.pending.clear();
    for (const callback of callbacks) callback(time);
  }
}

interface Setup {
  fixture: ComponentFixture<TraceGame>;
  element: HTMLElement;
  frames: ManualFrames;
  answered: number[];
  completed: InteractionResult[];
}

describe('TraceGame', () => {
  let reduced: boolean;

  async function render(options: { reduced?: boolean } = {}): Promise<Setup> {
    reduced = options.reduced ?? false;
    const frames = new ManualFrames();
    TestBed.configureTestingModule({
      providers: [
        { provide: ANIMATION_FRAMES, useValue: frames },
        { provide: REDUCED_MOTION, useValue: () => reduced },
        // Always the first item: rounds and Ted lines are predictable.
        { provide: RANDOM, useValue: () => 0 },
      ],
    });
    const fixture = TestBed.createComponent(TraceGame);
    fixture.componentRef.setInput('config', config);
    fixture.componentRef.setInput('ted', ted);
    const answered: number[] = [];
    const completed: InteractionResult[] = [];
    fixture.componentInstance.answered.subscribe(() => answered.push(1));
    fixture.componentInstance.completed.subscribe((result) => completed.push(result));
    await fixture.whenStable();
    return { fixture, element: fixture.nativeElement as HTMLElement, frames, answered, completed };
  }

  const svg = (element: HTMLElement) => element.querySelector('svg[role="img"]') as SVGElement;
  const choiceButtons = (element: HTMLElement) => [
    ...element.querySelectorAll<HTMLButtonElement>('button.choice'),
  ];
  const choice = (element: HTMLElement, id: string) =>
    element.querySelector<HTMLButtonElement>(
      `button.choice[data-choice="${id}"]`,
    ) as HTMLButtonElement;
  const button = (element: HTMLElement, text: string) =>
    [...element.querySelectorAll<HTMLButtonElement>('.buttons button')].find(
      (item) => item.textContent?.trim() === text,
    );
  const say = (element: HTMLElement) =>
    element.querySelector('.say')?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const mood = (element: HTMLElement) => {
    const face = element.querySelector<SVGElement>('snf-ted-says snf-ted svg');
    if (face?.style.getPropertyValue('--m-mond-oeps') === 'inline') return 'oops';
    if (face?.style.getPropertyValue('--m-mond-denk') === 'inline') return 'thinking';
    if (face?.style.getPropertyValue('--m-ogen-blij') === 'inline') return 'happy';
    return 'cool';
  };
  const pattern = (element: HTMLElement) => svg(element).getAttribute('data-pattern') ?? '';
  const answerFor = (id: string) => config.patterns.find((item) => item.id === id)?.answer ?? '';

  async function click(setup: Setup, target: HTMLElement | undefined): Promise<void> {
    if (!target) throw new Error('nothing to click');
    target.click();
    await setup.fixture.whenStable();
  }

  /** Runs the frames of one drawing to the end. */
  async function drawAll(setup: Setup): Promise<void> {
    setup.frames.run(0);
    setup.frames.run(config.durationMs);
    await setup.fixture.whenStable();
  }

  /** Plays a whole game with reduced motion; `right` says per round whether to answer right. */
  async function playGame(setup: Setup, right: boolean[]): Promise<void> {
    await click(setup, button(setup.element, 'Start') ?? button(setup.element, 'Nog een potje'));
    await playRounds(setup, right);
  }

  /** Answers the rounds of a game that has started. */
  async function playRounds(setup: Setup, right: boolean[]): Promise<void> {
    for (let round = 0; round < right.length; round += 1) {
      if (round > 0) await click(setup, button(setup.element, 'Volgende'));
      const answer = answerFor(pattern(setup.element));
      const id = right[round] ? answer : config.choices.find((item) => item.id !== answer)!.id;
      await click(setup, choice(setup.element, id));
    }
  }

  it('shows every choice with its label and colour, closed before Start', async () => {
    const { element } = await render();
    const buttons = choiceButtons(element);
    expect(buttons.map((item) => item.textContent?.trim())).toEqual(['Vis!', 'Vast', 'Plant']);
    expect(buttons.map((item) => item.dataset['color'])).toEqual(['yellow', 'purple', 'green']);
    expect(buttons.every((item) => item.disabled)).toBe(true);
    expect(element.querySelector('.rounds')?.textContent?.trim()).toBe('3 rondes');
    expect(say(element)).toBe(TRACE_TEXT.idle);
    expect(button(element, 'Start')).toBeDefined();
    expect(svg(element).getAttribute('aria-label')).toBe(
      'Hengel en een lijn die laat zien hoe hard er getrokken wordt',
    );
    expect(svg(element).hasAttribute('data-pattern')).toBe(false);
    // At rest a flat line at the start height of the first pattern.
    expect(element.querySelector('polyline')?.getAttribute('points')).toBe(
      tracePoints([{ type: 'base', level: 0.22 }], 1),
    );
  });

  it('Start draws the line over durationMs and then opens the choices', async () => {
    const setup = await render();
    const { element, frames } = setup;
    await click(setup, button(element, 'Start'));
    expect(element.querySelector('.rounds')?.textContent?.trim()).toBe('Ronde 1 van 3');
    expect(say(element)).toBe(TRACE_TEXT.drawing);
    expect(mood(element)).toBe('thinking');
    const shape = config.patterns.find((item) => item.id === pattern(element))!.shape;

    frames.run(100);
    await setup.fixture.whenStable();
    expect(element.querySelector('polyline')?.getAttribute('points')).toBe(
      tracePoints(shape, 0.001),
    );
    frames.run(600);
    await setup.fixture.whenStable();
    expect(element.querySelector('polyline')?.getAttribute('points')).toBe(tracePoints(shape, 0.5));
    expect(choiceButtons(element).every((item) => item.disabled)).toBe(true);
    expect(button(element, 'Bekijk nog eens')).toBeUndefined();

    frames.run(1100);
    await setup.fixture.whenStable();
    expect(element.querySelector('polyline')?.getAttribute('points')).toBe(tracePoints(shape, 1));
    expect(choiceButtons(element).every((item) => !item.disabled)).toBe(true);
    expect(say(element)).toBe(TRACE_TEXT.choose);
    expect(button(element, 'Bekijk nog eens')).toBeDefined();
    expect(frames.pending.size).toBe(0);
  });

  it('the rod bends with the line', async () => {
    const setup = await render();
    const { element, frames } = setup;
    const rod = () => element.querySelector('path.rod')?.getAttribute('d');
    expect(rod()).toBe(rodPath(0.22));
    await click(setup, button(element, 'Start'));
    const shape = config.patterns.find((item) => item.id === pattern(element))!.shape;
    frames.run(0);
    frames.run(500);
    await setup.fixture.whenStable();
    const pull = shapeValue(shape, 0.5);
    expect(pull).toBeGreaterThan(0.5);
    expect(rod()).toBe(rodPath(pull));
    const tip = element.querySelector('line.fishing-line');
    expect(Number(tip?.getAttribute('x1'))).toBeCloseTo(236 + pull * 18, 6);
    expect(Number(tip?.getAttribute('y1'))).toBeCloseTo(40 + pull * 70, 6);
  });

  it('with reduced motion the line is drawn at once and the choices open immediately', async () => {
    const setup = await render({ reduced: true });
    const { element, frames } = setup;
    await click(setup, button(element, 'Start'));
    const shape = config.patterns.find((item) => item.id === pattern(element))!.shape;
    expect(frames.pending.size).toBe(0);
    expect(element.querySelector('polyline')?.getAttribute('points')).toBe(tracePoints(shape, 1));
    expect(choiceButtons(element).every((item) => !item.disabled)).toBe(true);
    expect(say(element)).toBe(TRACE_TEXT.choose);

    // Read again on every drawing: switched off, the next line animates.
    reduced = false;
    await click(setup, button(element, 'Bekijk nog eens'));
    expect(frames.pending.size).toBe(1);
  });

  it('a right choice makes Ted happy with a line from ted.correct and the explanation', async () => {
    const setup = await render({ reduced: true });
    const { element } = setup;
    await click(setup, button(element, 'Start'));
    const current = config.patterns.find((item) => item.id === pattern(element))!;
    await click(setup, choice(element, current.answer));
    expect(mood(element)).toBe('happy');
    expect(say(element)).toBe(`Goed gevoeld! ${current.explanation}`);
  });

  it('a wrong choice makes Ted say oops, names the right answer and gives the explanation', async () => {
    const setup = await render({ reduced: true });
    const { element } = setup;
    await click(setup, button(element, 'Start'));
    const current = config.patterns.find((item) => item.id === pattern(element))!;
    const label = config.choices.find((item) => item.id === current.answer)!.label;
    await click(setup, choice(element, 'plant'));
    expect(mood(element)).toBe('oops');
    expect(say(element)).toBe(`Bijna. Het was: ${label}. ${current.explanation}`);
  });

  it('the chosen button says Jouw keuze', async () => {
    const setup = await render({ reduced: true });
    const { element } = setup;
    await click(setup, button(element, 'Start'));
    await click(setup, choice(element, 'vast'));
    expect(choice(element, 'vast').classList).toContain('chosen');
    expect(choice(element, 'vast').textContent).toContain('Jouw keuze');
    expect(choice(element, 'vis').textContent).not.toContain('Jouw keuze');
    expect(choiceButtons(element).every((item) => item.disabled)).toBe(true);
    // The next round starts without a choice.
    await click(setup, button(element, 'Volgende'));
    expect(element.textContent).not.toContain('Jouw keuze');
  });

  it('a right choice adds a fish to the catch', async () => {
    const setup = await render({ reduced: true });
    const { element } = setup;
    await playGame(setup, [true, false, true]);
    expect(element.querySelectorAll('.catch svg.fish')).toHaveLength(2);
    expect(element.querySelector('.catch svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(element.querySelector('.catch')?.textContent?.trim()).toBe('2 goed');
  });

  it('Bekijk nog eens draws the same pattern again and keeps the choices as they were', async () => {
    const setup = await render();
    const { element, frames } = setup;
    await click(setup, button(element, 'Start'));
    const first = pattern(element);
    await drawAll(setup);
    await click(setup, button(element, 'Bekijk nog eens'));
    expect(pattern(element)).toBe(first);
    expect(choiceButtons(element).every((item) => item.disabled)).toBe(true);
    expect(say(element)).toBe(TRACE_TEXT.choose);
    await drawAll(setup);
    expect(choiceButtons(element).every((item) => !item.disabled)).toBe(true);

    // After an answer the choices stay closed, also after looking again.
    await click(setup, choice(element, answerFor(first)));
    const said = say(element);
    await click(setup, button(element, 'Bekijk nog eens'));
    await drawAll(setup);
    expect(pattern(element)).toBe(first);
    expect(choiceButtons(element).every((item) => item.disabled)).toBe(true);
    expect(choice(element, answerFor(first)).textContent).toContain('Jouw keuze');
    expect(say(element)).toBe(said);
    expect(frames.pending.size).toBe(0);
  });

  it('emits answered once per game', async () => {
    const setup = await render({ reduced: true });
    await playGame(setup, [true, true, false]);
    expect(setup.answered).toHaveLength(1);
    await playGame(setup, [false, true, true]);
    expect(setup.answered).toHaveLength(2);
  });

  it('after the last round shows the score with Ted cool when at most one answer is wrong', async () => {
    const setup = await render({ reduced: true });
    const { element } = setup;
    await playGame(setup, [true, false, true]);
    expect(element.querySelector('.rounds')?.textContent?.trim()).toBe('2 van 3 goed');
    expect(mood(element)).toBe('cool');
    expect(say(element)).toContain('2 van 3 goed. Jij voelt het verschil al!');
    expect(button(element, 'Volgende')).toBeUndefined();
    expect(button(element, 'Nog een potje')).toBeDefined();
  });

  it('after the last round shows the score with Ted happy otherwise', async () => {
    const setup = await render({ reduced: true });
    const { element } = setup;
    await playGame(setup, [false, false, true]);
    expect(mood(element)).toBe('happy');
    expect(say(element)).toContain(
      '1 van 3 goed. Speel nog een keer, dan voel je het verschil steeds beter.',
    );
  });

  it('emits completed with score, total and every round in detail', async () => {
    const setup = await render({ reduced: true });
    await playGame(setup, [true, false, true]);
    expect(setup.completed).toHaveLength(1);
    const [result] = setup.completed;
    expect(result.score).toBe(2);
    expect(result.total).toBe(3);
    const rounds = (
      result.detail as { rounds: { pattern: string; choice: string; correct: boolean }[] }
    ).rounds;
    expect(rounds).toHaveLength(3);
    expect(rounds.map((round) => round.correct)).toEqual([true, false, true]);
    for (const round of rounds) {
      expect(round.correct).toBe(round.choice === answerFor(round.pattern));
    }
  });

  it('Nog een potje starts a new game with new rounds', async () => {
    const setup = await render({ reduced: true });
    const { element } = setup;
    await playGame(setup, [true, true, true]);
    await click(setup, button(element, 'Nog een potje'));
    expect(element.querySelector('.rounds')?.textContent?.trim()).toBe('Ronde 1 van 3');
    expect(element.querySelectorAll('.catch svg.fish')).toHaveLength(0);
    expect(choiceButtons(element).every((item) => !item.disabled)).toBe(true);
    expect(element.textContent).not.toContain('Jouw keuze');
    await playRounds(setup, [false, false, false]);
    expect(setup.completed.map((result) => result.score)).toEqual([3, 0]);
  });

  it('focus moves to Ted after Start and to Volgende after an answer', async () => {
    const setup = await render({ reduced: true });
    const { element } = setup;
    document.body.append(element);
    await click(setup, button(element, 'Start'));
    expect(document.activeElement).toBe(element.querySelector('.say'));
    expect(element.querySelector('.say')?.getAttribute('tabindex')).toBe('-1');
    await click(setup, choice(element, 'vis'));
    expect(document.activeElement).toBe(button(element, 'Volgende'));
    await click(setup, button(element, 'Volgende'));
    expect(document.activeElement).toBe(element.querySelector('.say'));
    await click(setup, choice(element, 'vis'));
    await click(setup, button(element, 'Volgende'));
    await click(setup, choice(element, 'vis'));
    expect(document.activeElement).toBe(button(element, 'Nog een potje'));
    element.remove();
  });

  it('stops the animation when destroyed', async () => {
    const setup = await render();
    await click(setup, button(setup.element, 'Start'));
    expect(setup.frames.pending.size).toBe(1);
    setup.fixture.destroy();
    expect(setup.frames.pending.size).toBe(0);
  });
});
