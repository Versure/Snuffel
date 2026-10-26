// Fixtures for the unit tests of the parent pages (not used by the app).
import type { Interaction, Lesson, ManifestLesson } from '../../core/content/content.types';
import type {
  ChecklistStateRecord,
  InteractionResultRecord,
  LessonProgressRecord,
  QuizAttemptRecord,
} from '../../core/pocketbase/types';
import type { LessonRecords } from '../../core/progress/progress.service';

export const proeflesEntry: ManifestLesson = {
  id: 'proefles',
  title: 'Proefles',
  status: 'published',
  version: 2,
  estimatedMinutes: 10,
  file: 'proefcursus/lessons/01-proefles.json',
  hash: '0123456789abcdef',
  stepIds: ['uitleg', 'spel', 'quiz', 'zelf-doen', 'oefenen', 'typen'],
};

export const proefles: Lesson = {
  schemaVersion: 1,
  id: 'proefles',
  version: 2,
  title: 'Proefles',
  sticker: 'Proef',
  objective: 'Doel',
  concept: 'Begrip',
  estimatedMinutes: 10,
  glossary: [],
  ted: {
    intro: { mood: 'happy', text: 'Hoi' },
    correct: ['Goed'],
    incorrect: ['Fout'],
    finished: 'Klaar',
  },
  steps: [
    { id: 'uitleg', type: 'explain', title: 'Uitleg', blocks: [] },
    {
      id: 'spel',
      type: 'interaction',
      title: 'Voel de lijn',
      intro: 'Voel',
      sourceRefs: [],
      interaction: {
        id: 'voel-spel',
        kind: 'trace-game',
        config: { choices: [], patterns: [], rounds: 8, durationMs: 1000 },
      },
    },
    {
      id: 'quiz',
      type: 'quiz',
      title: 'Quiz',
      questions: ['v1', 'v2', 'v3', 'v4'].map((id) => ({
        id,
        prompt: id,
        options: [
          { id: 'a', text: 'A', feedback: 'Goed' },
          { id: 'b', text: 'B', feedback: 'Fout' },
        ],
        correctOptionId: 'a',
        hints: [],
        sourceRefs: [],
      })),
    },
    {
      id: 'zelf-doen',
      type: 'practice',
      practiceKind: 'at-the-water',
      title: 'Aan het water',
      intro: 'Doe',
      successCriterion: 'Gelukt',
      items: ['vispas', 'haak', 'net'].map((id) => ({ id, text: id, sourceRefs: [] })),
    },
    {
      id: 'oefenen',
      type: 'interaction',
      title: 'Oefenen',
      intro: 'Oefen',
      sourceRefs: [],
      interaction: { id: 'breuken', kind: 'stepped-exercise', config: { exercises: [] } },
    },
    {
      id: 'typen',
      type: 'interaction',
      title: 'Typen',
      intro: 'Typ',
      sourceRefs: [],
      interaction: {
        id: 'thuisrij',
        kind: 'typing-drill',
        config: { lines: ['asdf jkl;'], newKeys: [] },
      },
    },
  ],
  furtherReading: [],
  faq: [],
};

/** The kind of every interaction of the test lesson. */
const KINDS: Readonly<Record<string, Interaction['kind']>> = {
  'voel-spel': 'trace-game',
  breuken: 'stepped-exercise',
  thuisrij: 'typing-drill',
};

const base = { user: 'a1', lesson_id: 'proefles', updated: '2026-01-01 10:00:00.000Z' };

export function stepRecord(
  stepId: string,
  status: 'started' | 'completed',
  updated = base.updated,
): LessonProgressRecord {
  return {
    ...base,
    id: `p-${stepId}`,
    created: updated,
    updated,
    course_id: 'proefcursus',
    step_id: stepId,
    status,
    content_version: 2,
  };
}

export function attemptRecord(
  questionId: string,
  optionId: string,
  created: string,
  hints = 0,
  version = 2,
): QuizAttemptRecord {
  return {
    ...base,
    id: `q-${questionId}-${created}`,
    created,
    updated: created,
    question_id: questionId,
    option_id: optionId,
    correct: optionId === 'a',
    hints_used: hints,
    content_version: version,
  };
}

export function checklistRecord(checked: string[]): ChecklistStateRecord {
  return {
    ...base,
    id: 'c-zelf-doen',
    created: base.updated,
    checklist_id: 'zelf-doen',
    checked,
  };
}

export function resultRecord(
  interactionId: string,
  score: number,
  total: number,
  created: string,
  detail: unknown = null,
): InteractionResultRecord {
  return {
    ...base,
    id: `r-${interactionId}-${created}`,
    created,
    updated: created,
    interaction_id: interactionId,
    kind: KINDS[interactionId] ?? 'trace-game',
    score,
    total,
    detail,
    content_version: 2,
  };
}

export function records(parts: Partial<LessonRecords> = {}): LessonRecords {
  return { steps: [], checklists: [], attempts: [], results: [], ...parts };
}
