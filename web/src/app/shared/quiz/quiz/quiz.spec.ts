import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { QuizAttemptRecord } from '../../../core/pocketbase/types';
import { RANDOM } from '../../../core/random/random';
import {
  ANSWER_NOT_SAVED,
  LessonProgress,
  type LessonProgressState,
} from '../../lesson-progress/lesson-progress';
import { sequence, testQuiz, testTed, textOf } from '../testing';
import { Quiz } from './quiz';

function attempt(questionId: string, optionId: string, hintsUsed = 0): QuizAttemptRecord {
  return {
    id: `${questionId}-${optionId}`,
    user: 'a1',
    created: '',
    updated: '',
    lesson_id: 'proefles',
    question_id: questionId,
    option_id: optionId,
    correct: false,
    hints_used: hintsUsed,
    content_version: 1,
  };
}

/** A LessonProgress stand-in with the parts the quiz uses. */
function fakeProgress(latest: QuizAttemptRecord[] = []) {
  const state = signal<LessonProgressState>('ready');
  const loads = signal(1);
  const error = signal<string | null>(null);
  return {
    stateSignal: state,
    loadsSignal: loads,
    error,
    latest,
    state: state.asReadonly(),
    loads: loads.asReadonly(),
    saveError: vi.fn(() => error()),
    latestAnswers: vi.fn(
      () => new Map(latest.map((record) => [record.question_id, record] as const)),
    ),
    answer: vi.fn(async () => undefined),
    reload: vi.fn(async () => undefined),
  };
}

describe('Quiz', () => {
  let fixture: ComponentFixture<Quiz>;
  let element: HTMLElement;

  async function render(progress?: ReturnType<typeof fakeProgress>, random = () => 0) {
    TestBed.configureTestingModule({
      providers: [
        { provide: RANDOM, useValue: random },
        ...(progress ? [{ provide: LessonProgress, useValue: progress }] : []),
      ],
    });
    fixture = TestBed.createComponent(Quiz);
    fixture.componentRef.setInput('step', testQuiz);
    fixture.componentRef.setInput('ted', testTed);
    await fixture.whenStable();
    element = fixture.nativeElement as HTMLElement;
  }

  const questions = () => [...element.querySelectorAll('snf-quiz-question')];
  const optionTexts = (index: number) =>
    [...questions()[index].querySelectorAll('button.option .option-text')].map(textOf);

  async function choose(index: number, text: string): Promise<void> {
    [...questions()[index].querySelectorAll<HTMLButtonElement>('button.option')]
      .find((button) => textOf(button.querySelector('.option-text')) === text)
      ?.click();
    await fixture.whenStable();
  }

  const button = (name: string) =>
    [...element.querySelectorAll<HTMLButtonElement>('button')].find(
      (candidate) => textOf(candidate) === name,
    );

  it('shows every question numbered', async () => {
    await render();
    expect(textOf(element.querySelector('.intro'))).toBe('Twee situaties aan het water.');
    expect(questions().map((question) => textOf(question.querySelector('.prompt')))).toEqual([
      '1. Wat doe je?',
      '2. Wat is het?',
    ]);
    expect(element.querySelector('.score')).toBeNull();
  });

  it('shows the score with Ted cool when all answers are right', async () => {
    const progress = fakeProgress();
    await render(progress);
    await choose(0, 'Direct aanslaan');
    expect(element.querySelector('.score')).toBeNull();
    await choose(1, 'Vast');
    const score = element.querySelector('.score');
    expect(textOf(score?.querySelector('snf-speech-bubble'))).toMatch(
      /^2 van 2 goed\. (Strak!|Precies!)$/,
    );
    // Cool Ted has no face variables (sunglasses on).
    expect(score?.querySelector('snf-ted svg')?.getAttribute('style') ?? '').not.toContain(
      '--m-bril',
    );
    expect(score?.closest('[aria-live="polite"]')).not.toBeNull();
    expect(progress.answer).toHaveBeenCalledWith('quiz', 'eerste', 'a', true, 0, [
      'eerste',
      'tweede',
    ]);
    expect(progress.answer).toHaveBeenCalledWith('quiz', 'tweede', 'vast', true, 0, [
      'eerste',
      'tweede',
    ]);
  });

  it('shows the score with Ted happy otherwise', async () => {
    await render();
    await choose(0, 'Wachten');
    await choose(1, 'Vast');
    const score = element.querySelector('.score');
    expect(textOf(score?.querySelector('snf-speech-bubble'))).toBe(
      '1 van 2 goed. Lees de uitleg bij de rode vragen nog eens.',
    );
    expect(score?.querySelector('snf-ted svg')?.getAttribute('style')).toContain(
      '--m-ogen-blij: inline',
    );
  });

  it('Opnieuw shuffles again and clears the answers', async () => {
    const progress = fakeProgress();
    // Round 0 with random 0; round 1 with random 0.99 (keeps the content order).
    let value = 0;
    await render(progress, () => value);
    expect(optionTexts(0)).toEqual(['Wachten', 'Lijn vieren', 'Direct aanslaan']);
    await choose(0, 'Wachten');
    await choose(1, 'Vis');
    value = 0.99;
    button('Opnieuw')?.click();
    await fixture.whenStable();
    expect(optionTexts(0)).toEqual(['Direct aanslaan', 'Wachten', 'Lijn vieren']);
    expect(element.querySelector('.score')).toBeNull();
    expect(element.querySelector('.feedback, button.option:disabled')).toBeNull();
    // The focus goes to the first question.
    expect(document.activeElement).toBe(questions()[0].querySelector('.prompt'));
    // The stored attempts stay: nothing is written for "Opnieuw".
    expect(progress.answer).toHaveBeenCalledTimes(2);
  });

  it('restores the latest answers from LessonProgress', async () => {
    const progress = fakeProgress([attempt('eerste', 'b', 1), attempt('tweede', 'vast')]);
    await render(progress);
    expect(progress.latestAnswers).toHaveBeenCalledWith(['eerste', 'tweede']);
    const first = questions()[0];
    expect(textOf(first.querySelector('button.option.wrong .option-text'))).toBe('Wachten');
    expect(textOf(first.querySelector('.feedback .explanation'))).toBe('Dat werkt bij karper.');
    expect(first.querySelectorAll('.hint')).toHaveLength(1);
    expect(textOf(element.querySelector('.score snf-speech-bubble'))).toBe(
      '1 van 2 goed. Lees de uitleg bij de rode vragen nog eens.',
    );
    // A restored answer is not stored again.
    expect(progress.answer).not.toHaveBeenCalled();
  });

  it('ignores a restored answer with an option that no longer exists', async () => {
    await render(fakeProgress([attempt('eerste', 'weg')]));
    expect(questions()[0].querySelector('.feedback')).toBeNull();
  });

  it('is read-only with a retry when progress is unavailable', async () => {
    const progress = fakeProgress();
    progress.stateSignal.set('unavailable');
    await render(progress);
    expect(textOf(element.querySelector('.unavailable snf-speech-bubble'))).toBe(
      'Je voortgang kan ik nu niet ophalen.',
    );
    const options = [...element.querySelectorAll<HTMLButtonElement>('button.option')];
    expect(options.length).toBe(5);
    expect(options.every((option) => option.disabled)).toBe(true);
    expect(element.querySelector('.hint-button')).toBeNull();
    button('Opnieuw')?.click();
    expect(progress.reload).toHaveBeenCalled();

    // After a successful reload the quiz works again.
    progress.stateSignal.set('ready');
    progress.loadsSignal.set(2);
    await fixture.whenStable();
    expect(element.querySelector('.unavailable')).toBeNull();
    expect(element.querySelector('button.option:disabled')).toBeNull();
  });

  it('shows the save error as an alert', async () => {
    const progress = fakeProgress();
    await render(progress);
    await choose(0, 'Wachten');
    expect(element.querySelector('[role="alert"]')).toBeNull();
    progress.error.set(ANSWER_NOT_SAVED);
    await fixture.whenStable();
    expect(textOf(element.querySelector('[role="alert"]'))).toBe('Je antwoord is niet bewaard.');
    expect(progress.saveError).toHaveBeenCalledWith('quiz');
    // The answer and its feedback stay.
    expect(textOf(element.querySelector('.feedback .explanation'))).toBe('Dat werkt bij karper.');
  });

  it('works without LessonProgress (in memory)', async () => {
    await render(undefined, sequence(0.5));
    await choose(0, 'Direct aanslaan');
    await choose(1, 'Vis');
    expect(textOf(element.querySelector('.score snf-speech-bubble'))).toContain('1 van 2 goed.');
  });
});
