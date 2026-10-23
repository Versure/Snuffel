import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { RANDOM } from '../../../core/random/random';
import { sequence, testQuiz, testTed, textOf } from '../testing';
import { QuizQuestion, type QuizAnswer } from './quiz-question';

const question = testQuiz.questions[0];

/** The style variables of Ted's face, which tell his mood. */
function tedFace(element: HTMLElement): string {
  return element.querySelector<SVGElement>('.feedback snf-ted svg')?.getAttribute('style') ?? '';
}

describe('QuizQuestion', () => {
  let fixture: ComponentFixture<QuizQuestion>;
  let element: HTMLElement;
  let emitted: QuizAnswer[];

  async function render(random: () => number = () => 0, inputs: Record<string, unknown> = {}) {
    TestBed.configureTestingModule({ providers: [{ provide: RANDOM, useValue: random }] });
    fixture = TestBed.createComponent(QuizQuestion);
    fixture.componentRef.setInput('question', question);
    fixture.componentRef.setInput('number', 1);
    fixture.componentRef.setInput('ted', testTed);
    for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
    emitted = [];
    fixture.componentInstance.answered.subscribe((answer) => {
      emitted.push(answer);
      // The quiz puts the answer back in, as the parent does.
      fixture.componentRef.setInput('answer', answer);
    });
    await fixture.whenStable();
    element = fixture.nativeElement as HTMLElement;
  }

  const options = () => [...element.querySelectorAll<HTMLButtonElement>('button.option')];
  const optionTexts = () => options().map((button) => textOf(button.querySelector('.option-text')));
  const button = (name: string) =>
    [...element.querySelectorAll<HTMLButtonElement>('button')].find(
      (candidate) => textOf(candidate) === name,
    );

  async function choose(text: string): Promise<void> {
    options()
      .find((option) => textOf(option.querySelector('.option-text')) === text)
      ?.click();
    await fixture.whenStable();
  }

  it('shows the prompt and every option as a button in shuffled order', async () => {
    await render();
    const prompt = element.querySelector('.prompt');
    expect(textOf(prompt)).toBe('1. Wat doe je?');
    const group = element.querySelector('[role="group"]');
    expect(group?.getAttribute('aria-labelledby')).toBe(prompt?.id);
    // Fisher-Yates with random 0 moves the first option to the end.
    expect(optionTexts()).toEqual(['Wachten', 'Lijn vieren', 'Direct aanslaan']);
    expect(options().every((option) => option.type === 'button' && !option.disabled)).toBe(true);

    // A new round shuffles again.
    fixture.componentRef.setInput('round', 1);
    await fixture.whenStable();
    expect([...optionTexts()].sort()).toEqual(['Direct aanslaan', 'Lijn vieren', 'Wachten']);
  });

  it('shows no feedback and no hints before answering', async () => {
    await render();
    const text = textOf(element);
    for (const hidden of ['Klopt', 'karper', 'slappe lijn', 'Denk aan de tijd', 'Strak', 'Bijna']) {
      expect(text).not.toContain(hidden);
    }
    expect(element.querySelector('.feedback, .hints, .mark')).toBeNull();
    expect(new Set(options().map((option) => option.className)).size).toBe(1);
  });

  it('a hint button shows the hints one by one and then disappears', async () => {
    await render();
    button('Hint')?.click();
    await fixture.whenStable();
    expect([...element.querySelectorAll('.hint')].map(textOf)).toEqual(['Hint: Denk aan de tijd.']);
    expect(button('Hint')).toBeUndefined();
    button('Nog een hint')?.click();
    await fixture.whenStable();
    expect([...element.querySelectorAll('.hint')].map(textOf)).toEqual([
      'Hint: Denk aan de tijd.',
      'Hint: Een roofvis is snel.',
    ]);
    expect(button('Nog een hint')).toBeUndefined();
    expect(element.querySelector('.hint-button')).toBeNull();
  });

  it('after the last hint the focus moves from the closing hint button to that hint', async () => {
    await render();
    button('Hint')?.focus();
    button('Hint')?.click();
    await fixture.whenStable();
    // Another hint is left: the button stays and the focus is not moved.
    const next = button('Nog een hint');
    expect(next).toBeDefined();
    next?.focus();
    next?.click();
    await fixture.whenStable();
    const hints = element.querySelectorAll<HTMLElement>('.hint');
    expect(element.querySelector('.hint-button')).toBeNull();
    expect(hints[1].getAttribute('tabindex')).toBe('-1');
    expect(document.activeElement).toBe(hints[1]);
  });

  it('a question without hints has no hint button', async () => {
    TestBed.configureTestingModule({ providers: [{ provide: RANDOM, useValue: () => 0 }] });
    const other = TestBed.createComponent(QuizQuestion);
    other.componentRef.setInput('question', testQuiz.questions[1]);
    other.componentRef.setInput('number', 2);
    other.componentRef.setInput('ted', testTed);
    await other.whenStable();
    expect((other.nativeElement as HTMLElement).querySelector('.hint-button')).toBeNull();
  });

  it('answering emits the option, whether it is correct and the hints used', async () => {
    await render();
    button('Hint')?.click();
    await fixture.whenStable();
    await choose('Wachten');
    expect(emitted).toEqual([{ optionId: 'b', correct: false, hintsUsed: 1 }]);
    // The hint stays, the hint button is gone.
    expect([...element.querySelectorAll('.hint')].map(textOf)).toEqual(['Hint: Denk aan de tijd.']);
    expect(element.querySelector('.hint-button')).toBeNull();
  });

  it('after a right answer the option is marked and Ted is happy with a line from ted.correct', async () => {
    await render(sequence(0, 0, 0.6));
    await choose('Direct aanslaan');
    expect(emitted).toEqual([{ optionId: 'a', correct: true, hintsUsed: 0 }]);
    const right = element.querySelectorAll('button.option.right');
    expect(right).toHaveLength(1);
    expect(textOf(right[0].querySelector('.option-text'))).toBe('Direct aanslaan');
    expect(element.querySelector('button.option.wrong')).toBeNull();
    expect(tedFace(element)).toContain('--m-ogen-blij: inline');
    expect(testTed.correct).toContain(textOf(element.querySelector('.feedback snf-speech-bubble')));
    expect(element.querySelector('[aria-live="polite"] .feedback')).not.toBeNull();
  });

  it('after a wrong answer the right option is marked too and Ted says oops with a line from ted.incorrect', async () => {
    await render();
    await choose('Lijn vieren');
    const wrong = element.querySelector('button.option.wrong');
    const right = element.querySelector('button.option.right');
    expect(textOf(wrong?.querySelector('.option-text'))).toBe('Lijn vieren');
    expect(textOf(right?.querySelector('.option-text'))).toBe('Direct aanslaan');
    expect(tedFace(element)).toContain('--m-mond-oeps: inline');
    expect(testTed.incorrect).toContain(
      textOf(element.querySelector('.feedback snf-speech-bubble')),
    );
  });

  it('shows the feedback of the chosen option only', async () => {
    await render();
    await choose('Wachten');
    expect(textOf(element.querySelector('.feedback .explanation'))).toBe('Dat werkt bij karper.');
    const text = textOf(element);
    expect(text).not.toContain('Klopt, er leeft iets.');
    expect(text).not.toContain('Met slappe lijn voel je niets.');
  });

  it('options are closed after answering', async () => {
    await render();
    await choose('Wachten');
    expect(options().every((option) => option.disabled)).toBe(true);
    await choose('Direct aanslaan');
    expect(emitted).toHaveLength(1);
    // The focus goes to the feedback.
    expect(document.activeElement).toBe(element.querySelector('.feedback'));
  });

  it('colour is never the only sign (Jouw antwoord, Goede antwoord)', async () => {
    await render();
    await choose('Wachten');
    const marks = (text: string) =>
      [
        ...(options()
          .find((option) => textOf(option.querySelector('.option-text')) === text)
          ?.querySelectorAll('.mark') ?? []),
      ].map(textOf);
    expect(marks('Wachten')).toEqual(['Jouw antwoord']);
    expect(marks('Direct aanslaan')).toEqual(['Goede antwoord']);
    expect(marks('Lijn vieren')).toEqual([]);

    // A right answer has both.
    fixture.componentRef.setInput('answer', { optionId: 'a', correct: true, hintsUsed: 0 });
    await fixture.whenStable();
    expect(marks('Direct aanslaan')).toEqual(['Jouw antwoord', 'Goede antwoord']);
  });

  it('a restored answer shows the hints it used, and disabled closes everything', async () => {
    await render(() => 0, { answer: { optionId: 'b', correct: false, hintsUsed: 2 } });
    expect(element.querySelectorAll('.hint')).toHaveLength(2);
    expect(textOf(element.querySelector('.feedback .explanation'))).toBe('Dat werkt bij karper.');

    fixture.componentRef.setInput('answer', null);
    fixture.componentRef.setInput('disabled', true);
    fixture.componentRef.setInput('round', 1);
    await fixture.whenStable();
    expect(options().every((option) => option.disabled)).toBe(true);
    expect(element.querySelector('.hint-button')).toBeNull();
    expect(element.querySelector('.hint')).toBeNull();
  });
});
