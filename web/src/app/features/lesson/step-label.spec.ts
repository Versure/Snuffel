import type { LessonStep } from '../../core/content/content.types';
import { stepLabel } from './step-label';

const step = (partial: object) => ({ id: 'stap', title: 'Titel', ...partial }) as LessonStep;

describe('stepLabel', () => {
  it('labels an explain step Uitleg', () => {
    expect(stepLabel(step({ type: 'explain', blocks: [] }))).toBe('Uitleg');
  });

  it('labels a trace-game Spel and a stepped-exercise Oefenen', () => {
    expect(stepLabel(step({ type: 'interaction', interaction: { kind: 'trace-game' } }))).toBe(
      'Spel',
    );
    expect(
      stepLabel(step({ type: 'interaction', interaction: { kind: 'stepped-exercise' } })),
    ).toBe('Oefenen');
  });

  it('labels a quiz Quiz', () => {
    expect(stepLabel(step({ type: 'quiz', questions: [] }))).toBe('Quiz');
  });

  it('labels practice Aan het water or Zelf doen', () => {
    expect(stepLabel(step({ type: 'practice', practiceKind: 'at-the-water' }))).toBe(
      'Aan het water',
    );
    expect(stepLabel(step({ type: 'practice', practiceKind: 'do-it-yourself' }))).toBe('Zelf doen');
  });
});
