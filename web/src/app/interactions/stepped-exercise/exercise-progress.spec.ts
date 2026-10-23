import type { Exercise } from '../../core/content/content.types';
import {
  afterAnswer,
  afterHint,
  afterSolution,
  afterStepOpened,
  type ExerciseProgress,
  isFinished,
  NO_PROGRESS,
  seriesResult,
  solutionAvailable,
} from './exercise-progress';

function exercise(id: string, hints: number): Exercise {
  return {
    id,
    prompt: 'Hoeveel is 1/5 + 2/5?',
    answer: { type: 'text', accepted: ['3/5'] },
    hints: Array.from({ length: hints }, (_, index) => `Hint ${index + 1}.`),
    steps: [
      { id: 'stap-1', title: 'Stap 1', text: 'Kijk naar de noemers.' },
      { id: 'stap-2', title: 'Stap 2', text: 'Tel de tellers op.' },
    ],
    commonMistakes: [],
    workedSolution: '1 + 2 = 3, dus 3/5.',
  };
}

const twoHints = exercise('gelijke-noemers', 2);
const noHints = exercise('kies-de-som', 0);

describe('exercise progress', () => {
  it('the solution is not available before an own attempt', () => {
    let progress = NO_PROGRESS;
    progress = afterHint(afterHint(progress, twoHints), twoHints);
    progress = afterStepOpened(progress, 'stap-1');
    expect(solutionAvailable(progress, twoHints)).toBe(false);
    // Empty and unreadable answers are no attempt.
    progress = afterAnswer(afterAnswer(progress, 'empty'), 'unreadable');
    expect(progress.attempts).toBe(0);
    expect(solutionAvailable(progress, twoHints)).toBe(false);
  });

  it('the solution is not available after an attempt while hints are left', () => {
    let progress = afterAnswer(NO_PROGRESS, 'wrong');
    expect(solutionAvailable(progress, twoHints)).toBe(false);
    progress = afterHint(progress, twoHints);
    expect(solutionAvailable(progress, twoHints)).toBe(false);
  });

  it('the solution is available after an attempt and all hints', () => {
    const hinted = afterHint(afterHint(NO_PROGRESS, twoHints), twoHints);
    expect(solutionAvailable(afterAnswer(hinted, 'mistake'), twoHints)).toBe(true);
    const tried = afterAnswer(NO_PROGRESS, 'wrong');
    expect(solutionAvailable(afterHint(afterHint(tried, twoHints), twoHints), twoHints)).toBe(true);
  });

  it('without hints the solution is available after one attempt', () => {
    expect(solutionAvailable(NO_PROGRESS, noHints)).toBe(false);
    expect(solutionAvailable(afterAnswer(NO_PROGRESS, 'wrong'), noHints)).toBe(true);
  });

  it('after a right answer the solution is available', () => {
    expect(solutionAvailable(afterAnswer(NO_PROGRESS, 'correct'), twoHints)).toBe(true);
  });

  it('an exercise is finished when it is right or its solution is shown', () => {
    expect(isFinished(NO_PROGRESS)).toBe(false);
    expect(isFinished(afterAnswer(NO_PROGRESS, 'wrong'))).toBe(false);
    expect(isFinished(afterAnswer(NO_PROGRESS, 'correct'))).toBe(true);
    expect(isFinished(afterSolution(afterAnswer(NO_PROGRESS, 'wrong')))).toBe(true);
  });

  it('a right answer after the solution does not count as right on its own', () => {
    const shown = afterSolution(afterAnswer(NO_PROGRESS, 'wrong'));
    const right = afterAnswer(shown, 'correct');
    expect(right.correct).toBe(true);
    expect(right.correctBeforeSolution).toBe(false);
    // Right first, then the solution: still right on its own.
    const first = afterSolution(afterAnswer(NO_PROGRESS, 'correct'));
    expect(first.correctBeforeSolution).toBe(true);
    // A wrong answer after a right one does not undo it.
    expect(afterAnswer(first, 'wrong').correctBeforeSolution).toBe(true);
  });

  it('the result counts the exercises that were right on their own', () => {
    const exercises = [twoHints, noHints, exercise('recept', 1)];
    const progresses: ExerciseProgress[] = [
      afterAnswer(NO_PROGRESS, 'correct'),
      afterAnswer(afterSolution(afterAnswer(NO_PROGRESS, 'wrong')), 'correct'),
      afterAnswer(afterAnswer(NO_PROGRESS, 'mistake'), 'correct'),
    ];
    const result = seriesResult(exercises, progresses);
    expect(result.score).toBe(2);
    expect(result.total).toBe(3);
  });

  it('detail has per exercise id, correct, attempts, hints, steps and solution', () => {
    let progress = afterAnswer(NO_PROGRESS, 'wrong');
    progress = afterStepOpened(afterStepOpened(progress, 'stap-1'), 'stap-1');
    progress = afterStepOpened(progress, 'stap-2');
    progress = afterHint(afterHint(afterHint(progress, twoHints), twoHints), twoHints);
    progress = afterSolution(afterAnswer(afterAnswer(progress, 'unreadable'), 'mistake'));
    const result = seriesResult(
      [twoHints, noHints],
      [progress, afterAnswer(NO_PROGRESS, 'correct')],
    );
    expect(result.detail).toEqual({
      exercises: [
        { id: 'gelijke-noemers', correct: false, attempts: 2, hints: 2, steps: 2, solution: true },
        { id: 'kies-de-som', correct: true, attempts: 1, hints: 0, steps: 0, solution: false },
      ],
    });
  });

  it('detail of ten exercises with 60-character ids stays under 4 kB', () => {
    const exercises = Array.from({ length: 10 }, (_, index) =>
      exercise(`${index}`.padStart(60, 'a'), 20),
    );
    let progress = NO_PROGRESS;
    for (let attempt = 0; attempt < 9999; attempt += 1) {
      progress = { ...progress, attempts: progress.attempts + 1 };
    }
    for (let hint = 0; hint < 20; hint += 1) progress = afterHint(progress, exercises[0]);
    progress = afterSolution(afterStepOpened(afterStepOpened(progress, 'stap-1'), 'stap-2'));
    const result = seriesResult(
      exercises,
      exercises.map(() => progress),
    );
    const bytes = new TextEncoder().encode(JSON.stringify(result.detail)).length;
    expect(exercises[0].id.length).toBe(60);
    expect(bytes).toBeLessThan(4096);
  });
});
