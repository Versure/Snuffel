import type { Interaction, LessonStep, PracticeStep } from '../../core/content/content.types';

/** The short label of a step in the step navigation (plan M7, question 2). */
export function stepLabel(step: LessonStep): string {
  switch (step.type) {
    case 'explain':
      return 'Uitleg';
    case 'interaction':
      return interactionLabel(step.interaction.kind);
    case 'quiz':
      return 'Quiz';
    case 'practice':
      return practiceLabel(step.practiceKind);
  }
}

function interactionLabel(kind: Interaction['kind']): string {
  switch (kind) {
    case 'trace-game':
      return 'Spel';
    case 'stepped-exercise':
      return 'Oefenen';
  }
}

function practiceLabel(kind: PracticeStep['practiceKind']): string {
  switch (kind) {
    case 'at-the-water':
      return 'Aan het water';
    case 'do-it-yourself':
      return 'Zelf doen';
  }
}
