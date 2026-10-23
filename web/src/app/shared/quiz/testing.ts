import type { LessonTed, QuizStep } from '../../core/content/content.types';

/** A small quiz for the unit tests of the quiz components. */
export const testQuiz: QuizStep = {
  id: 'quiz',
  type: 'quiz',
  title: 'Quiz',
  intro: 'Twee situaties aan het **water**.',
  questions: [
    {
      id: 'eerste',
      prompt: 'Wat doe je?',
      options: [
        { id: 'a', text: 'Direct aanslaan', feedback: 'Klopt, er leeft iets.' },
        { id: 'b', text: 'Wachten', feedback: 'Dat werkt bij karper.' },
        { id: 'c', text: 'Lijn vieren', feedback: 'Met slappe lijn voel je niets.' },
      ],
      correctOptionId: 'a',
      hints: ['Denk aan de tijd.', 'Een roofvis is snel.'],
      sourceRefs: [],
    },
    {
      id: 'tweede',
      prompt: 'Wat is het?',
      options: [
        { id: 'vast', text: 'Vast', feedback: 'Dood gewicht.' },
        { id: 'vis', text: 'Vis', feedback: 'Een vis schudt.' },
      ],
      correctOptionId: 'vast',
      hints: [],
      sourceRefs: [],
    },
  ],
};

export const testTed: LessonTed = {
  intro: { mood: 'cool', text: 'Yo!' },
  correct: ['Strak!', 'Precies!'],
  incorrect: ['Bijna.', 'Oeps.'],
  finished: 'Klaar.',
};

/** A random source that returns the given values in turn (and then starts again). */
export function sequence(...values: number[]): () => number {
  let index = 0;
  return () => values[index++ % values.length];
}

export const textOf = (element: Element | null | undefined): string =>
  (element?.textContent ?? '').replace(/\s+/g, ' ').trim();
