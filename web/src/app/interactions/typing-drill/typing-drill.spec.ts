import { TestBed, type ComponentFixture } from '@angular/core/testing';
import lessonJson from '../../../../../content/fixtures/courses/proeftypen/lessons/01-proefles-thuisrij.json';
import type { InteractionStep, Lesson, TypingDrillConfig } from '../../core/content/content.types';
import { CLOCK } from '../../core/clock/clock';
import { INPUT_DEVICE } from '../../core/input-device/input-device';
import { RANDOM } from '../../core/random/random';
import type { InteractionResult } from '../interaction';
import { TYPING_TEXT, TypingDrill } from './typing-drill';

// The drill of the typing fixture, read from content/ (never copied into web/src).
const lesson = lessonJson as unknown as Lesson;
const step = lesson.steps.find((item): item is InteractionStep => item.type === 'interaction')!;
const fixtureConfig = step.interaction.config as TypingDrillConfig;
const lines = fixtureConfig.lines;
const ted = lesson.ted;

interface Setup {
  fixture: ComponentFixture<TypingDrill>;
  element: HTMLElement;
  answered: number[];
  completed: InteractionResult[];
  clock: { now: number };
}

describe('TypingDrill', () => {
  async function render(
    config: TypingDrillConfig = fixtureConfig,
    options: { touchOnly?: boolean } = {},
  ): Promise<Setup> {
    const clock = { now: 1000 };
    TestBed.configureTestingModule({
      providers: [
        // Always the first item: Ted lines are predictable.
        { provide: RANDOM, useValue: () => 0 },
        { provide: CLOCK, useValue: () => clock.now },
        { provide: INPUT_DEVICE, useValue: { touchOnly: () => options.touchOnly ?? false } },
      ],
    });
    const fixture = TestBed.createComponent(TypingDrill);
    fixture.componentRef.setInput('config', config);
    fixture.componentRef.setInput('ted', ted);
    const answered: number[] = [];
    const completed: InteractionResult[] = [];
    fixture.componentInstance.answered.subscribe(() => answered.push(1));
    fixture.componentInstance.completed.subscribe((result) => completed.push(result));
    document.body.append(fixture.nativeElement as HTMLElement);
    await fixture.whenStable();
    return { fixture, element: fixture.nativeElement as HTMLElement, answered, completed, clock };
  }

  afterEach(() => {
    document.body.querySelectorAll('snf-typing-drill, [ng-version]').forEach((node) => {
      node.remove();
    });
  });

  const clean = (text: string | null | undefined) => text?.replace(/\s+/g, ' ').trim() ?? '';
  const field = (element: HTMLElement) => element.querySelector<HTMLInputElement>('input.field');
  const button = (element: HTMLElement, text: string) =>
    [...element.querySelectorAll('button')].find((item) => clean(item.textContent) === text);
  const live = (element: HTMLElement) => clean(element.querySelector('[aria-live]')?.textContent);
  const say = (element: HTMLElement) => clean(element.querySelector('.say')?.textContent);
  const results = (element: HTMLElement) =>
    [...element.querySelectorAll('.results li')].map((item) => clean(item.textContent));
  /** The visible chars of the line: a space as ·, without the ✗ and the hidden texts. */
  const lineMarks = (element: HTMLElement) =>
    [...element.querySelectorAll('.line .char')].map((item) => ({
      mark: item.classList.contains('correct')
        ? 'correct'
        : item.classList.contains('wrong')
          ? 'wrong'
          : 'pending',
      current: item.classList.contains('current'),
    }));

  async function start(setup: Setup): Promise<void> {
    button(setup.element, 'Start')?.click();
    await setup.fixture.whenStable();
  }

  /** Types `text` in the field, one char per input event, `step` ms apart. */
  async function type(setup: Setup, text: string, step = 200): Promise<void> {
    for (const char of text) {
      const input = field(setup.element);
      if (!input) throw new Error('no typing field');
      input.value += char;
      input.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: char }));
      setup.clock.now += step;
    }
    await setup.fixture.whenStable();
  }

  async function typeAll(setup: Setup, wrongAt = -1): Promise<void> {
    let index = 0;
    for (const line of lines) {
      let typed = '';
      for (const char of line) typed += index++ === wrongAt ? 'x' : char;
      await type(setup, typed);
    }
  }

  it('shows the start with the number of lines, the new keys and Start', async () => {
    const { element } = await render();
    expect(clean(element.querySelector('.heading')?.textContent)).toBe(`${lines.length} regels`);
    expect(clean(element.querySelector('.intro .new-keys')?.textContent)).toBe(
      '★ Nieuw: a, s, d, f, j, k, l, ; en spatie',
    );
    expect(element.textContent).toContain(TYPING_TEXT.ready);
    expect(button(element, 'Start')).toBeDefined();
    expect(field(element)).toBeNull();
    // No line of the drill is shown before Start.
    expect(element.textContent).not.toContain(lines[0]);
  });

  it('Start focuses the typing field and shows line 1 with the first char marked', async () => {
    const setup = await render();
    await start(setup);
    const { element } = setup;
    expect(document.activeElement).toBe(field(element));
    expect(clean(element.querySelector('.counter')?.textContent)).toBe(
      `Regel 1 van ${lines.length}`,
    );
    const marks = lineMarks(element);
    expect(marks.length).toBe([...lines[0]!].length);
    expect(marks[0]).toEqual({ mark: 'pending', current: true });
    expect(marks.filter((item) => item.current).length).toBe(1);
    expect(clean(element.querySelector('.next-line')?.textContent)).toBe(`Daarna: ${lines[1]}`);
    const input = field(element)!;
    expect(input.getAttribute('aria-label')).toBe('Typvak');
    expect(input.getAttribute('inputmode')).toBe('none');
    expect(input.getAttribute('autocomplete')).toBe('off');
    expect(input.getAttribute('spellcheck')).toBe('false');
    expect(input.closest('form')).toBeNull();
    const help = element.querySelector(`#${input.getAttribute('aria-describedby')}`);
    expect(clean(help?.textContent)).toBe(TYPING_TEXT.help);
  });

  it('typing the right chars marks them green and moves on', async () => {
    const setup = await render();
    await start(setup);
    await type(setup, 'asd');
    const marks = lineMarks(setup.element);
    expect(marks.slice(0, 4)).toEqual([
      { mark: 'correct', current: false },
      { mark: 'correct', current: false },
      { mark: 'correct', current: false },
      { mark: 'pending', current: true },
    ]);
    expect(field(setup.element)?.value).toBe('');
  });

  it('a wrong char is red with a mark and the cursor moves on', async () => {
    const setup = await render();
    await start(setup);
    await type(setup, 'x');
    const first = setup.element.querySelector('.line .char');
    expect(first?.classList).toContain('wrong');
    expect(first?.querySelector('.cross')?.textContent).toBe('✗');
    expect(first?.querySelector('.cross')?.getAttribute('aria-hidden')).toBe('true');
    expect(clean(first?.querySelector('.snf-visually-hidden')?.textContent)).toBe('(fout)');
    expect(lineMarks(setup.element)[1]).toEqual({ mark: 'pending', current: true });
  });

  it('the keyboard shows the key and finger of the next char', async () => {
    const setup = await render();
    await start(setup);
    const next = () => clean(setup.element.querySelector('.next-key')?.textContent);
    expect(next()).toBe('Volgende toets: a, linkerpink');
    expect(setup.element.querySelector('.key.next')?.getAttribute('data-key')).toBe('a');
    await type(setup, 'asdf');
    expect(next()).toBe('Volgende toets: spatie, duim');
    expect(setup.element.querySelector('.key.next')?.getAttribute('data-key')).toBe('space');
    expect(setup.element.querySelectorAll('.key.new').length).toBe(9);
  });

  it('the next line comes without Enter', async () => {
    const setup = await render();
    await start(setup);
    await type(setup, lines[0]!);
    expect(clean(setup.element.querySelector('.counter')?.textContent)).toBe(
      `Regel 2 van ${lines.length}`,
    );
    expect(lineMarks(setup.element).every((item) => item.mark === 'pending')).toBe(true);
    expect(lineMarks(setup.element)[0]?.current).toBe(true);
  });

  it('emits answered once at the first key of a drill', async () => {
    const setup = await render();
    await start(setup);
    expect(setup.answered.length).toBe(0);
    await type(setup, 'a');
    expect(setup.answered.length).toBe(1);
    await type(setup, 'sdf');
    expect(setup.answered.length).toBe(1);
  });

  it('after the last line shows accuracy, speed and the most missed keys', async () => {
    const setup = await render();
    await start(setup);
    await typeAll(setup, 3);
    const total = lines.join('').length;
    expect(clean(setup.element.querySelector('.heading')?.textContent)).toBe('Klaar!');
    // 200 ms between keys, total - 1 gaps; total - 1 right.
    const minutes = (200 * (total - 1)) / 60000;
    expect(results(setup.element)).toEqual([
      `Nauwkeurigheid: ${Math.floor(((total - 1) * 100) / total)}% goed (${total - 1} van ${total} aanslagen)`,
      `Snelheid: ${Math.round((total - 1) / minutes)} aanslagen per minuut`,
      'Vaakst fout: f (1×)',
    ]);
    expect(field(setup.element)).toBeNull();
    expect(document.activeElement).toBe(setup.element.querySelector('.say'));
  });

  it('emits completed with score, total and detail', async () => {
    const setup = await render();
    await start(setup);
    await typeAll(setup, 0);
    const total = lines.join('').length;
    expect(setup.completed.length).toBe(1);
    expect(setup.completed[0]).toEqual({
      score: total - 1,
      total,
      detail: {
        keysPerMinute: Math.round(((total - 1) * 60000) / (200 * (total - 1))),
        durationMs: 200 * (total - 1),
        mistakes: [{ key: 'a', count: 1 }],
      },
    });
    const stored = JSON.stringify(setup.completed[0]);
    for (const line of lines) expect(stored).not.toContain(line);
  });

  it('Ted is cool with a line from ted.correct when the goal is met', async () => {
    const setup = await render();
    await start(setup);
    await typeAll(setup);
    expect(say(setup.element)).toBe(`${ted.correct[0]} Doel gehaald: 90% goed.`);
    // Cool: Ted keeps his sunglasses.
    const svg = setup.element.querySelector<SVGElement>('.end snf-ted svg');
    expect(svg?.style.getPropertyValue('--m-bril')).toBe('');
    expect(svg?.style.getPropertyValue('--m-ogen-denk')).toBe('');
    expect(results(setup.element)[2]).toBe(TYPING_TEXT.noMistakes);
  });

  it('Ted thinks with a line from ted.incorrect and the goal when it is not met', async () => {
    const setup = await render({ ...fixtureConfig, lines: ['asdf'], goals: { accuracy: 90 } });
    await start(setup);
    await type(setup, 'axdf');
    expect(say(setup.element)).toBe(
      `${ted.incorrect[0]} Je doel is 90% goed. Typ rustig; snelheid komt vanzelf.`,
    );
    const svg = setup.element.querySelector<SVGElement>('.end snf-ted svg');
    expect(svg?.style.getPropertyValue('--m-ogen-denk')).toBe('inline');
  });

  it('without goals Ted is happy', async () => {
    const config: TypingDrillConfig = { lines: ['as'], newKeys: [] };
    const setup = await render(config);
    expect(setup.element.querySelector('.new-keys')).toBeNull();
    expect(clean(setup.element.querySelector('.heading')?.textContent)).toBe('1 regel');
    await start(setup);
    await type(setup, 'xx');
    expect(say(setup.element)).toBe(ted.correct[0]);
    const svg = setup.element.querySelector<SVGElement>('.end snf-ted svg');
    expect(svg?.style.getPropertyValue('--m-ogen-blij')).toBe('inline');
  });

  it('Opnieuw beginnen starts over and stores nothing', async () => {
    const setup = await render();
    await start(setup);
    await type(setup, `${lines[0]}xx`);
    button(setup.element, 'Opnieuw beginnen')?.click();
    await setup.fixture.whenStable();
    expect(clean(setup.element.querySelector('.counter')?.textContent)).toBe(
      `Regel 1 van ${lines.length}`,
    );
    expect(lineMarks(setup.element).every((item) => item.mark === 'pending')).toBe(true);
    expect(setup.completed.length).toBe(0);
    expect(document.activeElement).toBe(field(setup.element));
    await typeAll(setup);
    expect(setup.completed.length).toBe(1);
    expect(setup.completed[0]?.score).toBe(setup.completed[0]?.total);
    expect(setup.answered.length).toBe(2);
  });

  it('Nog een keer starts a new drill', async () => {
    const setup = await render();
    await start(setup);
    await typeAll(setup);
    button(setup.element, 'Nog een keer')?.click();
    await setup.fixture.whenStable();
    expect(clean(setup.element.querySelector('.counter')?.textContent)).toBe(
      `Regel 1 van ${lines.length}`,
    );
    expect(document.activeElement).toBe(field(setup.element));
    await typeAll(setup, 1);
    expect(setup.completed.length).toBe(2);
    expect(setup.completed[1]?.score).toBe(lines.join('').length - 1);
  });

  it('a touch-only device shows the message and no typing field', async () => {
    const { element } = await render(fixtureConfig, { touchOnly: true });
    expect(clean(element.querySelector('.touch .message')?.textContent)).toBe(
      'Voor deze oefening heb je een toetsenbord nodig. Doe hem op een laptop of computer.',
    );
    expect(element.querySelector('.touch snf-ted svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(element.querySelector('input')).toBeNull();
    expect(button(element, 'Start')).toBeUndefined();
  });

  it('a real key on a touch-only device shows the drill and is not counted', async () => {
    const setup = await render(fixtureConfig, { touchOnly: true });
    for (const key of ['Shift', 'Tab', 'Escape', 'Control']) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    }
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'v', ctrlKey: true }));
    await setup.fixture.whenStable();
    expect(setup.element.querySelector('.touch')).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    await setup.fixture.whenStable();
    expect(setup.element.querySelector('.touch')).toBeNull();
    expect(document.activeElement).toBe(button(setup.element, 'Start'));
    await start(setup);
    expect(lineMarks(setup.element).every((item) => item.mark === 'pending')).toBe(true);
    expect(setup.answered.length).toBe(0);
  });

  it('a key in a text field elsewhere on a touch-only device keeps the message', async () => {
    const setup = await render(fixtureConfig, { touchOnly: true });
    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', 'true');
    const fields = ['input', 'textarea', 'select'].map((tag) => document.createElement(tag));
    for (const target of [...fields, editable]) {
      document.body.append(target);
      target.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
      target.remove();
      await setup.fixture.whenStable();
      expect(setup.element.querySelector('.touch'), target.tagName).not.toBeNull();
    }
  });

  it('the live region says the line at the start of each line and the result at the end, not per key', async () => {
    const setup = await render();
    expect(live(setup.element)).toBe('');
    await start(setup);
    expect(live(setup.element)).toBe(`Regel 1 van ${lines.length}: ${lines[0]}`);
    await type(setup, 'ax');
    expect(live(setup.element)).toBe(`Regel 1 van ${lines.length}: ${lines[0]}`);
    await type(setup, lines[0]!.slice(2));
    expect(live(setup.element)).toBe(`Regel 2 van ${lines.length}: ${lines[1]}`);
    for (const line of lines.slice(1)) await type(setup, line);
    expect(live(setup.element)).toMatch(/^\d+% goed, \d+ aanslagen per minuut\. Vaakst fout: s\.$/);
    expect(setup.element.querySelectorAll('[aria-live]').length).toBe(1);
  });

  it('Caps Lock on shows a status', async () => {
    const setup = await render();
    await start(setup);
    const status = () => setup.element.querySelector('[role="status"]');
    expect(clean(status()?.textContent)).toBe('');
    field(setup.element)?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'A', modifierCapsLock: true }),
    );
    await setup.fixture.whenStable();
    expect(clean(status()?.textContent)).toBe('Caps Lock staat aan');
    field(setup.element)?.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    await setup.fixture.whenStable();
    expect(clean(status()?.textContent)).toBe('');
  });

  it('a lost focus shows how to go on and a click on the line brings it back', async () => {
    const setup = await render();
    await start(setup);
    expect(setup.element.querySelector('.refocus')).toBeNull();
    field(setup.element)?.blur();
    await setup.fixture.whenStable();
    expect(clean(setup.element.querySelector('.refocus')?.textContent)).toBe(
      'Klik op de regel om verder te typen.',
    );
    // The line is in the label of the field: a click on it focuses the field (in a browser;
    // jsdom only passes the click on, the e2e test checks the focus).
    const label = setup.element.querySelector('.line')?.closest('label');
    expect(label?.control).toBe(field(setup.element));
    field(setup.element)?.focus();
    await setup.fixture.whenStable();
    expect(document.activeElement).toBe(field(setup.element));
    expect(setup.element.querySelector('.refocus')).toBeNull();
  });

  it('Tab is not trapped in the typing field', async () => {
    const setup = await render();
    await start(setup);
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    field(setup.element)?.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(false);
    // The field is a normal tab stop, followed by Opnieuw beginnen.
    expect(field(setup.element)?.tabIndex).toBe(0);
    expect(button(setup.element, 'Opnieuw beginnen')).toBeDefined();
  });
});
