import { TestBed, type ComponentFixture } from '@angular/core/testing';
import lessonJson from '../../../../../content/fixtures/courses/proefhuiswerk/lessons/01-proefles-breuken.json';
import type {
  Exercise,
  InteractionStep,
  Lesson,
  SteppedExerciseConfig,
} from '../../core/content/content.types';
import { RANDOM } from '../../core/random/random';
import { shuffle } from '../../shared/quiz/shuffle';
import type { InteractionResult } from '../interaction';
import { EXERCISE_TEXT, SteppedExercise } from './stepped-exercise';

// The exercises of the practice fixture, read from content/ (never copied into web/src).
const lesson = lessonJson as unknown as Lesson;
const step = lesson.steps.find((item): item is InteractionStep => item.type === 'interaction')!;
const fixtureConfig = step.interaction.config as SteppedExerciseConfig;
const byId = (id: string): Exercise => fixtureConfig.exercises.find((item) => item.id === id)!;
const fractions = byId('gelijke-noemers');
const unlike = byId('ongelijke-noemers');
const recipe = byId('recept');
const choice = byId('kies-de-som');
const ted = lesson.ted;

interface Setup {
  fixture: ComponentFixture<SteppedExercise>;
  element: HTMLElement;
  answered: number[];
  completed: InteractionResult[];
}

describe('SteppedExercise', () => {
  async function render(config: SteppedExerciseConfig = fixtureConfig): Promise<Setup> {
    TestBed.configureTestingModule({
      // Always the first item: shuffles and Ted lines are predictable.
      providers: [{ provide: RANDOM, useValue: () => 0 }],
    });
    const fixture = TestBed.createComponent(SteppedExercise);
    fixture.componentRef.setInput('config', config);
    fixture.componentRef.setInput('ted', ted);
    const answered: number[] = [];
    const completed: InteractionResult[] = [];
    fixture.componentInstance.answered.subscribe(() => answered.push(1));
    fixture.componentInstance.completed.subscribe((result) => completed.push(result));
    await fixture.whenStable();
    return { fixture, element: fixture.nativeElement as HTMLElement, answered, completed };
  }

  const only = (...exercises: Exercise[]): SteppedExerciseConfig => ({ exercises });
  const clean = (text: string | null | undefined) => text?.replace(/\s+/g, ' ').trim() ?? '';
  const heading = (element: HTMLElement) => clean(element.querySelector('.heading')?.textContent);
  const prompt = (element: HTMLElement) => clean(element.querySelector('.prompt')?.textContent);
  const field = (element: HTMLElement) => element.querySelector<HTMLInputElement>('input.input');
  const say = (element: HTMLElement) => clean(element.querySelector('.say')?.textContent);
  const notice = (element: HTMLElement) => clean(element.querySelector('.notice')?.textContent);
  const hints = (element: HTMLElement) =>
    [...element.querySelectorAll('.hint')].map((item) => clean(item.textContent));
  const optionButtons = (element: HTMLElement) => [
    ...element.querySelectorAll<HTMLButtonElement>('button.option'),
  ];
  const option = (element: HTMLElement, id: string) =>
    element.querySelector<HTMLButtonElement>(`button.option[data-option="${id}"]`)!;
  const button = (element: HTMLElement, text: string) =>
    [...element.querySelectorAll<HTMLButtonElement>('button')].find(
      (item) => clean(item.textContent) === text,
    );
  const stepToggles = (element: HTMLElement) => [
    ...element.querySelectorAll<HTMLButtonElement>('button.step-toggle'),
  ];
  const solution = (element: HTMLElement) => element.querySelector<HTMLElement>('.solution');
  const mood = (element: HTMLElement) => {
    const face = element.querySelector<SVGElement>('snf-ted-says snf-ted svg');
    if (face?.style.getPropertyValue('--m-mond-oeps') === 'inline') return 'oops';
    if (face?.style.getPropertyValue('--m-mond-denk') === 'inline') return 'thinking';
    if (face?.style.getPropertyValue('--m-ogen-blij') === 'inline') return 'happy';
    return 'cool';
  };

  async function click(setup: Setup, target: HTMLElement | undefined | null): Promise<void> {
    if (!target) throw new Error('nothing to click');
    target.click();
    await setup.fixture.whenStable();
  }

  async function type(setup: Setup, text: string): Promise<void> {
    const input = field(setup.element);
    if (!input) throw new Error('no input');
    input.value = text;
    input.dispatchEvent(new Event('input'));
    await setup.fixture.whenStable();
  }

  /** Types `text` and taps Controleer. */
  async function answer(setup: Setup, text: string): Promise<void> {
    await type(setup, text);
    await click(setup, button(setup.element, EXERCISE_TEXT.check));
  }

  async function askAllHints(setup: Setup): Promise<void> {
    for (;;) {
      const next =
        button(setup.element, EXERCISE_TEXT.hint) ?? button(setup.element, EXERCISE_TEXT.nextHint);
      if (!next) return;
      await click(setup, next);
    }
  }

  /** The right answer of an exercise, as the child gives it. */
  async function answerRight(setup: Setup, exercise: Exercise): Promise<void> {
    if (exercise.answer.type === 'choice') {
      await click(setup, option(setup.element, exercise.answer.correctOptionId));
    } else if (exercise.answer.type === 'text') {
      await answer(setup, exercise.answer.accepted[0]);
    } else {
      await answer(setup, String(exercise.answer.value).replace('.', ','));
    }
  }

  /** A wrong answer that is no known mistake. */
  async function answerWrong(setup: Setup, exercise: Exercise): Promise<void> {
    if (exercise.answer.type === 'choice') {
      const { correctOptionId } = exercise.answer;
      const known = exercise.commonMistakes.map((item) => item.answer);
      const wrong = exercise.answer.options.find(
        (item) => item.id !== correctOptionId && !known.includes(item.id),
      )!;
      await click(setup, option(setup.element, wrong.id));
    } else {
      await answer(setup, '99');
    }
  }

  it('shows the first exercise with its prompt, an input and Controleer', async () => {
    const { element } = await render();
    expect(heading(element)).toBe('Opgave 1 van 4');
    expect(prompt(element)).toBe('Hoeveel is 1/5 + 2/5?');
    const input = field(element)!;
    expect(input.type).toBe('text');
    expect(input.getAttribute('inputmode')).toBe('text');
    expect(input.getAttribute('autocomplete')).toBe('off');
    expect(input.getAttribute('autocapitalize')).toBe('off');
    expect(input.getAttribute('spellcheck')).toBe('false');
    expect(input.getAttribute('aria-labelledby')).toBe(element.querySelector('.prompt')!.id);
    expect(button(element, 'Controleer')?.type).toBe('submit');
    expect(clean(element.querySelector('.solution-later')?.textContent)).toBe(
      EXERCISE_TEXT.solutionLater,
    );
    expect(button(element, EXERCISE_TEXT.solution)).toBeUndefined();
    expect(button(element, EXERCISE_TEXT.next)).toBeUndefined();
  });

  it('shows the unit next to the input', async () => {
    const { element } = await render(only(recipe));
    const unit = element.querySelector('.unit')!;
    expect(clean(unit.textContent)).toBe('liter');
    expect(field(element)!.getAttribute('aria-describedby')).toBe(unit.id);
  });

  it('a choice exercise shows its options as buttons in a shuffled order', async () => {
    const { element } = await render(only(choice));
    expect(field(element)).toBeNull();
    expect(button(element, 'Controleer')).toBeUndefined();
    if (choice.answer.type !== 'choice') throw new Error('not a choice');
    const shuffled = shuffle(choice.answer.options, () => 0).map((item) => item.id);
    expect(shuffled).not.toEqual(choice.answer.options.map((item) => item.id));
    expect(optionButtons(element).map((item) => item.dataset['option'])).toEqual(shuffled);
    expect(optionButtons(element).every((item) => !item.disabled)).toBe(true);
    expect(element.querySelector('.options')?.getAttribute('aria-labelledby')).toBe(
      element.querySelector('.prompt')!.id,
    );
  });

  it('a right answer makes Ted happy with a line from ted.correct and closes the input', async () => {
    const setup = await render();
    await answer(setup, '3/5');
    expect(mood(setup.element)).toBe('happy');
    expect(say(setup.element)).toBe(ted.correct[0]);
    expect(field(setup.element)!.disabled).toBe(true);
    expect(button(setup.element, 'Controleer')).toBeUndefined();
  });

  it('a common mistake makes Ted think and gives its feedback', async () => {
    const setup = await render();
    await answer(setup, '3/10');
    expect(mood(setup.element)).toBe('thinking');
    expect(say(setup.element)).toBe(fractions.commonMistakes[0].feedback);
    expect(field(setup.element)!.disabled).toBe(false);
  });

  it('another wrong answer makes Ted say oops with a line from ted.incorrect', async () => {
    const setup = await render();
    await answer(setup, 'abc');
    expect(mood(setup.element)).toBe('oops');
    expect(say(setup.element)).toBe(`${ted.incorrect[0]} ${EXERCISE_TEXT.tryAgain}`);
    expect(field(setup.element)!.disabled).toBe(false);
  });

  it('an empty answer asks for an answer and is no attempt', async () => {
    const setup = await render();
    await click(setup, button(setup.element, 'Controleer'));
    expect(notice(setup.element)).toBe(EXERCISE_TEXT.empty);
    const input = field(setup.element)!;
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe(setup.element.querySelector('.notice')!.id);
    expect(setup.element.querySelector('.say')).toBeNull();
    expect(setup.answered).toEqual([]);
    // Without an attempt the solution stays away, even after all hints.
    await askAllHints(setup);
    expect(button(setup.element, EXERCISE_TEXT.solution)).toBeUndefined();
    // Typing removes the message.
    await type(setup, '3');
    expect(setup.element.querySelector('.notice')).toBeNull();
    expect(input.hasAttribute('aria-invalid')).toBe(false);
  });

  it('an unreadable number says how to write it and is no attempt', async () => {
    const setup = await render(only(recipe));
    await answer(setup, 'abc');
    expect(notice(setup.element)).toBe(EXERCISE_TEXT.unreadable);
    const input = field(setup.element)!;
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const unit = setup.element.querySelector('.unit')!.id;
    const message = setup.element.querySelector('.notice')!.id;
    expect(input.getAttribute('aria-describedby')).toBe(`${unit} ${message}`);
    expect(setup.element.querySelector('.say')).toBeNull();
    expect(setup.answered).toEqual([]);
    await askAllHints(setup);
    expect(button(setup.element, EXERCISE_TEXT.solution)).toBeUndefined();
    // A readable answer is an attempt.
    await answer(setup, '0,8 liter');
    expect(mood(setup.element)).toBe('oops');
    expect(setup.answered).toEqual([1]);
    expect(button(setup.element, EXERCISE_TEXT.solution)).toBeDefined();
  });

  it('after Controleer with an empty or unreadable answer the focus is in the input', async () => {
    const setup = await render(only(recipe));
    const input = field(setup.element)!;
    const check = button(setup.element, 'Controleer')!;
    check.focus();
    await click(setup, check);
    expect(notice(setup.element)).toBe(EXERCISE_TEXT.empty);
    expect(document.activeElement).toBe(input);
    // The same message again: the focus still goes back to the input.
    check.focus();
    await click(setup, check);
    expect(document.activeElement).toBe(input);
    // Unreadable.
    await type(setup, 'abc');
    check.focus();
    await click(setup, check);
    expect(notice(setup.element)).toBe(EXERCISE_TEXT.unreadable);
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toContain(
      setup.element.querySelector('.notice')!.id,
    );
    expect(document.activeElement).toBe(input);
  });

  it('Enter in the input checks the answer', async () => {
    const setup = await render();
    await type(setup, '3/5');
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    field(setup.element)!.dispatchEvent(enter);
    await setup.fixture.whenStable();
    expect(enter.defaultPrevented).toBe(true);
    expect(mood(setup.element)).toBe('happy');
    expect(setup.answered).toEqual([1]);
  });

  it('a wrong option closes and says Jouw antwoord', async () => {
    const setup = await render(only(choice));
    await answerWrong(setup, choice);
    const wrong = optionButtons(setup.element).find((item) => item.classList.contains('wrong'))!;
    expect(wrong.disabled).toBe(true);
    expect(clean(wrong.querySelector('.mark')?.textContent)).toBe('Jouw antwoord');
    expect(mood(setup.element)).toBe('oops');
    // The other options stay open; a known mistake gives its feedback.
    await click(setup, option(setup.element, 'los-opgeteld'));
    expect(mood(setup.element)).toBe('thinking');
    expect(say(setup.element)).toBe(choice.commonMistakes[0].feedback);
    expect(option(setup.element, 'los-opgeteld').disabled).toBe(true);
    expect(option(setup.element, 'half-en-kwart').disabled).toBe(false);
    await click(setup, option(setup.element, 'half-en-kwart'));
    expect(mood(setup.element)).toBe('happy');
    expect(optionButtons(setup.element).every((item) => item.disabled)).toBe(true);
    expect(clean(option(setup.element, 'half-en-kwart').querySelector('.mark')?.textContent)).toBe(
      'Jouw antwoord',
    );
  });

  it('hints come one at a time', async () => {
    const setup = await render(only(unlike));
    expect(hints(setup.element)).toEqual([]);
    expect(button(setup.element, 'Nog een hint')).toBeUndefined();
    await click(setup, button(setup.element, 'Hint'));
    expect(hints(setup.element)).toEqual([`Hint: ${unlike.hints[0]}`]);
    expect(button(setup.element, 'Hint')).toBeUndefined();
    await click(setup, button(setup.element, 'Nog een hint'));
    expect(hints(setup.element)).toEqual(unlike.hints.slice(0, 2).map((hint) => `Hint: ${hint}`));
    await click(setup, button(setup.element, 'Nog een hint'));
    expect(hints(setup.element)).toEqual(unlike.hints.map((hint) => `Hint: ${hint}`));
    expect(button(setup.element, 'Nog een hint')).toBeUndefined();
    // After the last hint the focus is on that hint.
    expect(document.activeElement).toBe(setup.element.querySelector('.hint:last-child'));
  });

  it('a step opens and closes on its own', async () => {
    const setup = await render(only(unlike));
    const [first, second] = stepToggles(setup.element);
    expect(clean(first.textContent)).toContain(unlike.steps[0].title);
    const text = (toggle: HTMLButtonElement) =>
      setup.element.querySelector<HTMLElement>(`#${toggle.getAttribute('aria-controls')}`)!;
    expect(first.getAttribute('aria-expanded')).toBe('false');
    expect(text(first).hidden).toBe(true);
    await click(setup, first);
    expect(first.getAttribute('aria-expanded')).toBe('true');
    expect(text(first).hidden).toBe(false);
    expect(clean(text(first).textContent)).toBe(unlike.steps[0].text);
    expect(second.getAttribute('aria-expanded')).toBe('false');
    expect(text(second).hidden).toBe(true);
    await click(setup, first);
    expect(first.getAttribute('aria-expanded')).toBe('false');
    expect(text(first).hidden).toBe(true);
  });

  it('steps can be opened before an attempt', async () => {
    const setup = await render();
    const [toggle] = stepToggles(setup.element);
    await click(setup, toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(setup.element.querySelector('.say')).toBeNull();
    // A step is no attempt: the solution is not there yet.
    await askAllHints(setup);
    expect(button(setup.element, EXERCISE_TEXT.solution)).toBeUndefined();
  });

  it('the solution button is hidden before an attempt and says why', async () => {
    const setup = await render();
    expect(button(setup.element, EXERCISE_TEXT.solution)).toBeUndefined();
    expect(clean(setup.element.querySelector('.solution-later')?.textContent)).toBe(
      EXERCISE_TEXT.solutionLater,
    );
    await askAllHints(setup);
    expect(button(setup.element, EXERCISE_TEXT.solution)).toBeUndefined();
    expect(setup.element.querySelector('.solution-later')).not.toBeNull();
  });

  it('the solution button is hidden while hints are left', async () => {
    const setup = await render();
    await answerWrong(setup, fractions);
    expect(button(setup.element, EXERCISE_TEXT.solution)).toBeUndefined();
    await click(setup, button(setup.element, 'Hint'));
    expect(button(setup.element, EXERCISE_TEXT.solution)).toBeUndefined();
    expect(setup.element.querySelector('.solution-later')).not.toBeNull();
  });

  it('the solution shows after an attempt and all hints', async () => {
    const setup = await render();
    await answerWrong(setup, fractions);
    await askAllHints(setup);
    expect(setup.element.querySelector('.solution-later')).toBeNull();
    await click(setup, button(setup.element, EXERCISE_TEXT.solution));
    const shown = solution(setup.element)!;
    expect(clean(shown.querySelector('.solution-title')?.textContent)).toBe('Uitwerking');
    expect(clean(shown.querySelector('.solution-text')?.textContent)).toBe(
      fractions.workedSolution,
    );
    expect(button(setup.element, EXERCISE_TEXT.solution)).toBeUndefined();
  });

  it('without hints the solution is available after one attempt', async () => {
    const noHints: Exercise = { ...fractions, hints: [] };
    const setup = await render(only(noHints));
    expect(button(setup.element, EXERCISE_TEXT.solution)).toBeUndefined();
    await answerWrong(setup, noHints);
    expect(button(setup.element, EXERCISE_TEXT.solution)).toBeDefined();
  });

  it('after a right answer the solution is available', async () => {
    const setup = await render();
    await answerRight(setup, fractions);
    expect(hints(setup.element)).toEqual([]);
    expect(button(setup.element, EXERCISE_TEXT.solution)).toBeDefined();
  });

  it('Volgende opgave appears when the exercise is right or its solution is shown', async () => {
    const setup = await render();
    await answerWrong(setup, fractions);
    expect(button(setup.element, EXERCISE_TEXT.next)).toBeUndefined();
    await askAllHints(setup);
    expect(button(setup.element, EXERCISE_TEXT.next)).toBeUndefined();
    await click(setup, button(setup.element, EXERCISE_TEXT.solution));
    expect(button(setup.element, EXERCISE_TEXT.next)).toBeDefined();
    // After the solution the child may still answer.
    await answerRight(setup, fractions);
    expect(mood(setup.element)).toBe('happy');
    await click(setup, button(setup.element, EXERCISE_TEXT.next));
    expect(heading(setup.element)).toBe('Opgave 2 van 4');
    expect(prompt(setup.element)).toContain('1/2 + 1/3');
    expect(button(setup.element, EXERCISE_TEXT.next)).toBeUndefined();
    expect(setup.element.querySelector('.say')).toBeNull();
    expect(field(setup.element)!.value).toBe('');
    await answerRight(setup, unlike);
    expect(button(setup.element, EXERCISE_TEXT.next)).toBeDefined();
  });

  it('emits answered once per series at the first readable attempt', async () => {
    const setup = await render(only(fractions, choice));
    await click(setup, button(setup.element, 'Controleer'));
    expect(setup.answered).toEqual([]);
    await answerWrong(setup, fractions);
    expect(setup.answered).toEqual([1]);
    await answerRight(setup, fractions);
    await click(setup, button(setup.element, EXERCISE_TEXT.next));
    await answerRight(setup, choice);
    expect(setup.answered).toEqual([1]);
    await click(setup, button(setup.element, EXERCISE_TEXT.done));
    await click(setup, button(setup.element, EXERCISE_TEXT.again));
    await answerRight(setup, fractions);
    expect(setup.answered).toEqual([1, 1]);
  });

  /** Answers every exercise of the fixture; `right` says per exercise whether right on its own. */
  async function playSeries(setup: Setup, right: boolean[]): Promise<void> {
    for (let index = 0; index < fixtureConfig.exercises.length; index += 1) {
      const exercise = fixtureConfig.exercises[index];
      if (right[index]) {
        await answerRight(setup, exercise);
      } else {
        await answerWrong(setup, exercise);
        await askAllHints(setup);
        await click(setup, button(setup.element, EXERCISE_TEXT.solution));
      }
      const last = index + 1 === fixtureConfig.exercises.length;
      await click(setup, button(setup.element, last ? EXERCISE_TEXT.done : EXERCISE_TEXT.next));
    }
  }

  it('after the last exercise shows the score with Ted cool when all were right on their own', async () => {
    const setup = await render();
    await playSeries(setup, [true, true, true, true]);
    expect(mood(setup.element)).toBe('cool');
    expect(say(setup.element)).toBe(`4 van 4 zelf goed. ${ted.correct[0]}`);
    expect(button(setup.element, 'Nog een keer')).toBeDefined();
    expect(field(setup.element)).toBeNull();
  });

  it('after the last exercise shows the score with Ted happy otherwise', async () => {
    const setup = await render();
    await playSeries(setup, [true, false, true, true]);
    expect(mood(setup.element)).toBe('happy');
    expect(say(setup.element)).toBe(`3 van 4 zelf goed. ${EXERCISE_TEXT.finishedRetry}`);
  });

  it('emits completed with score, total and detail', async () => {
    const setup = await render();
    // Opgave 1: a known mistake, a hint and the step, then right on its own.
    await answer(setup, '3/10');
    await click(setup, button(setup.element, 'Hint'));
    await click(setup, stepToggles(setup.element)[0]);
    await answer(setup, 'Drie vijfde.');
    await click(setup, button(setup.element, EXERCISE_TEXT.next));
    // Opgave 2: wrong, all hints, the solution, then right.
    await answerWrong(setup, unlike);
    await askAllHints(setup);
    await click(setup, button(setup.element, EXERCISE_TEXT.solution));
    await answer(setup, '5 / 6');
    await click(setup, button(setup.element, EXERCISE_TEXT.next));
    // Opgave 3 and 4: right at once.
    await answer(setup, '3/4 liter');
    await click(setup, button(setup.element, EXERCISE_TEXT.next));
    await answerRight(setup, choice);
    expect(setup.completed).toEqual([]);
    await click(setup, button(setup.element, EXERCISE_TEXT.done));
    expect(setup.completed).toEqual([
      {
        score: 3,
        total: 4,
        detail: {
          exercises: [
            {
              id: 'gelijke-noemers',
              correct: true,
              attempts: 2,
              hints: 1,
              steps: 1,
              solution: false,
            },
            {
              id: 'ongelijke-noemers',
              correct: false,
              attempts: 2,
              hints: 3,
              steps: 0,
              solution: true,
            },
            { id: 'recept', correct: true, attempts: 1, hints: 0, steps: 0, solution: false },
            { id: 'kies-de-som', correct: true, attempts: 1, hints: 0, steps: 0, solution: false },
          ],
        },
      },
    ]);
  });

  it('Nog een keer starts a new series', async () => {
    const setup = await render();
    await playSeries(setup, [false, false, false, false]);
    await click(setup, button(setup.element, 'Nog een keer'));
    expect(heading(setup.element)).toBe('Opgave 1 van 4');
    expect(field(setup.element)!.value).toBe('');
    expect(field(setup.element)!.disabled).toBe(false);
    expect(hints(setup.element)).toEqual([]);
    expect(button(setup.element, EXERCISE_TEXT.solution)).toBeUndefined();
    await playSeries(setup, [true, true, true, true]);
    expect(setup.completed.map((result) => result.score)).toEqual([0, 4]);
  });

  it('focus moves to Ted after Controleer, to the exercise after Volgende opgave and to the solution after Bekijk de uitwerking', async () => {
    const setup = await render();
    await answerWrong(setup, fractions);
    expect(document.activeElement).toBe(setup.element.querySelector('.say'));
    await askAllHints(setup);
    await click(setup, button(setup.element, EXERCISE_TEXT.solution));
    expect(document.activeElement).toBe(solution(setup.element));
    await click(setup, button(setup.element, EXERCISE_TEXT.next));
    expect(document.activeElement).toBe(setup.element.querySelector('.heading'));
    for (const exercise of fixtureConfig.exercises.slice(1)) {
      await answerRight(setup, exercise);
      expect(document.activeElement).toBe(setup.element.querySelector('.say'));
      await click(
        setup,
        button(setup.element, EXERCISE_TEXT.next) ?? button(setup.element, EXERCISE_TEXT.done),
      );
    }
    expect(document.activeElement).toBe(setup.element.querySelector('.say'));
    await click(setup, button(setup.element, 'Nog een keer'));
    expect(document.activeElement).toBe(setup.element.querySelector('.heading'));
  });
});
