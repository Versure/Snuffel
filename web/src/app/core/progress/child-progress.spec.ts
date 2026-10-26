import type { InteractionStep, PracticeStep, QuizStep } from '../content/content.types';
import type { InteractionResultRecord, QuizAttemptRecord } from '../pocketbase/types';
import {
  checklistSummary,
  exerciseHelp,
  interactionSummary,
  lastActivity,
  quizSummary,
  typingSummary,
} from './child-progress';

const quiz: QuizStep = {
  id: 'quiz',
  type: 'quiz',
  title: 'Quiz',
  questions: ['een', 'twee', 'drie'].map((id) => ({
    id,
    prompt: `Vraag ${id}`,
    options: [
      { id: 'goed', text: 'Goed', feedback: 'Ja.' },
      { id: 'fout', text: 'Fout', feedback: 'Nee.' },
    ],
    correctOptionId: 'goed',
    hints: [],
    sourceRefs: [],
  })),
};

const practice: PracticeStep = {
  id: 'aan-het-water',
  type: 'practice',
  practiceKind: 'at-the-water',
  title: 'Aan het water',
  intro: 'Doe het zelf.',
  items: ['vispas', 'staal-en-tang', 'onthaakmat'].map((id) => ({
    id,
    text: id,
    sourceRefs: [],
  })),
  successCriterion: 'Alles klaar.',
};

const game: InteractionStep = {
  id: 'spel',
  type: 'interaction',
  title: 'Voel-spel',
  intro: 'Speel.',
  interaction: {
    id: 'voel-spel',
    kind: 'trace-game',
    config: { choices: [], patterns: [], rounds: 8, durationMs: 3000 },
  },
  sourceRefs: [],
};

let counter = 0;

function attempt(fields: Partial<QuizAttemptRecord>): QuizAttemptRecord {
  counter += 1;
  return {
    id: `a${counter}`,
    user: 'kind',
    lesson_id: 'proefles',
    question_id: 'een',
    option_id: 'goed',
    correct: true,
    hints_used: 0,
    content_version: 2,
    created: `2026-10-23 10:00:${String(counter).padStart(2, '0')}.000Z`,
    updated: `2026-10-23 10:00:${String(counter).padStart(2, '0')}.000Z`,
    ...fields,
  };
}

function result(fields: Partial<InteractionResultRecord>): InteractionResultRecord {
  counter += 1;
  return {
    id: `r${counter}`,
    user: 'kind',
    lesson_id: 'proefles',
    interaction_id: 'voel-spel',
    kind: 'trace-game',
    score: 5,
    total: 8,
    detail: null,
    content_version: 2,
    created: `2026-10-23 11:00:${String(counter).padStart(2, '0')}.000Z`,
    updated: `2026-10-23 11:00:${String(counter).padStart(2, '0')}.000Z`,
    ...fields,
  };
}

describe('child progress', () => {
  it('the last activity is the newest updated of all records', () => {
    expect(
      lastActivity([
        { updated: '2026-10-22 09:00:00.000Z' },
        { updated: '2026-10-23 12:05:00.000Z' },
        { updated: '2026-10-23 08:00:00.000Z' },
      ]),
    ).toBe('2026-10-23 12:05:00.000Z');
  });

  it('without records there is no last activity', () => {
    expect(lastActivity([])).toBeNull();
  });

  it('the quiz counts the latest answer per question', () => {
    const attempts = [
      attempt({ question_id: 'een', option_id: 'fout', created: '2026-10-23 10:00:00.000Z' }),
      attempt({ question_id: 'een', option_id: 'goed', created: '2026-10-23 10:01:00.000Z' }),
      attempt({ question_id: 'twee', option_id: 'goed', created: '2026-10-23 10:01:00.000Z' }),
      attempt({ question_id: 'twee', option_id: 'fout', created: '2026-10-23 10:02:00.000Z' }),
      attempt({ question_id: 'drie', option_id: 'goed' }),
    ];
    expect(quizSummary(quiz, 2, attempts)).toMatchObject({
      correct: 2,
      answered: 3,
      questions: 3,
    });
  });

  it('answers of an older version do not count in the quiz score', () => {
    const attempts = [
      attempt({ question_id: 'een', option_id: 'goed', content_version: 1 }),
      attempt({ question_id: 'twee', option_id: 'goed' }),
    ];
    expect(quizSummary(quiz, 2, attempts)).toMatchObject({ correct: 1, answered: 1, answers: 1 });
  });

  it('an answer with an option that no longer exists does not count', () => {
    const attempts = [
      attempt({ question_id: 'een', option_id: 'weg', correct: true }),
      attempt({ question_id: 'gone', option_id: 'goed' }),
      attempt({ question_id: 'twee', option_id: 'goed' }),
    ];
    expect(quizSummary(quiz, 2, attempts)).toMatchObject({ correct: 1, answered: 1 });
  });

  it('a partly answered quiz says how many are answered', () => {
    const attempts = [
      attempt({ question_id: 'een', option_id: 'goed' }),
      attempt({ question_id: 'twee', option_id: 'fout' }),
    ];
    expect(quizSummary(quiz, 2, attempts)).toMatchObject({
      correct: 1,
      answered: 2,
      questions: 3,
    });
  });

  it('the quiz counts every answer and the hints of the current version', () => {
    const attempts = [
      attempt({ question_id: 'een', option_id: 'fout', hints_used: 1 }),
      attempt({ question_id: 'een', option_id: 'goed', hints_used: 2 }),
      attempt({ question_id: 'twee', option_id: 'goed', hints_used: 0 }),
      attempt({ question_id: 'drie', option_id: 'goed', hints_used: 5, content_version: 1 }),
    ];
    expect(quizSummary(quiz, 2, attempts)).toMatchObject({ answers: 3, hints: 3 });
    expect(quizSummary(quiz, 2, [])).toEqual({
      correct: 0,
      answered: 0,
      questions: 3,
      answers: 0,
      hints: 0,
    });
  });

  it('the checklist counts only items the lesson has now', () => {
    expect(checklistSummary(practice, ['vispas', 'weg', 'onthaakmat'])).toEqual({
      checked: 2,
      total: 3,
    });
  });

  it('an empty or missing checklist counts zero', () => {
    expect(checklistSummary(practice, [])).toEqual({ checked: 0, total: 3 });
    expect(checklistSummary(practice, null)).toEqual({ checked: 0, total: 3 });
  });

  it('the latest result of the current version is shown with the number of plays', () => {
    const results = [
      result({ score: 3, created: '2026-10-23 11:00:00.000Z' }),
      result({ score: 7, created: '2026-10-23 11:05:00.000Z' }),
      result({ score: 4, created: '2026-10-23 11:02:00.000Z' }),
      result({ interaction_id: 'ander-spel', score: 1, created: '2026-10-23 12:00:00.000Z' }),
    ];
    expect(interactionSummary(game, 2, results)).toEqual({
      latest: { score: 7, total: 8 },
      plays: 3,
    });
    expect(interactionSummary(game, 2, [])).toEqual({ latest: null, plays: 0 });
  });

  it('a result of an older version is not the latest', () => {
    const results = [
      result({ score: 3, created: '2026-10-23 11:00:00.000Z' }),
      result({ score: 8, content_version: 1, created: '2026-10-23 11:05:00.000Z' }),
    ];
    expect(interactionSummary(game, 2, results)).toEqual({
      latest: { score: 3, total: 8 },
      plays: 1,
    });
  });

  it('exercise help counts hints and shown solutions from detail', () => {
    const detail = {
      exercises: [
        { id: 'een', correct: true, attempts: 1, hints: 0, steps: 0, solution: false },
        { id: 'twee', correct: false, attempts: 3, hints: 3, steps: 2, solution: true },
        { id: 'drie', correct: true, attempts: 2, hints: 1, steps: 0, solution: false },
      ],
    };
    expect(exerciseHelp(detail)).toEqual({ hints: 4, solutions: 1, exercises: 3 });
  });

  it('exercise help is null for a detail of another shape', () => {
    expect(exerciseHelp(null)).toBeNull();
    expect(exerciseHelp('tekst')).toBeNull();
    expect(exerciseHelp([])).toBeNull();
    expect(exerciseHelp({ rounds: [] })).toBeNull();
    expect(exerciseHelp({ exercises: [null] })).toBeNull();
    expect(exerciseHelp({ exercises: [{ hints: '2', solution: true }] })).toBeNull();
    expect(exerciseHelp({ exercises: [{ hints: 2 }] })).toBeNull();
    expect(exerciseHelp({ exercises: [{ hints: -1, solution: false }] })).toBeNull();
  });

  it('typingSummary reads keys per minute and mistakes', () => {
    const detail = {
      keysPerMinute: 85,
      durationMs: 182000,
      mistakes: [
        { key: 'f', count: 3 },
        { key: ';', count: 2 },
        { key: 'shift', count: 1 },
        { key: 'a', count: 1 },
      ],
    };
    expect(typingSummary(detail)).toEqual({ keysPerMinute: 85, mistakes: ['f', ';', 'Shift'] });
    expect(typingSummary({ ...detail, mistakes: [] })).toEqual({ keysPerMinute: 85, mistakes: [] });
  });

  it('another shape gives null', () => {
    expect(typingSummary(null)).toBeNull();
    expect(typingSummary('92%')).toBeNull();
    expect(typingSummary([])).toBeNull();
    expect(typingSummary({ rounds: [] })).toBeNull();
    expect(typingSummary({ keysPerMinute: '85', mistakes: [] })).toBeNull();
    expect(typingSummary({ keysPerMinute: -1, mistakes: [] })).toBeNull();
    expect(typingSummary({ keysPerMinute: 85 })).toBeNull();
    expect(typingSummary({ keysPerMinute: 85, mistakes: [null] })).toBeNull();
    expect(typingSummary({ keysPerMinute: 85, mistakes: [{ key: 'f' }] })).toBeNull();
    expect(typingSummary({ keysPerMinute: 85, mistakes: [{ key: 3, count: 1 }] })).toBeNull();
  });

  it('space is spatie', () => {
    const detail = { keysPerMinute: 40, durationMs: 1000, mistakes: [{ key: 'space', count: 2 }] };
    expect(typingSummary(detail)?.mistakes).toEqual(['spatie']);
  });
});
