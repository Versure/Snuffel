// Reading time: words / 130 + minutes per interaction step + 1 minute per quiz question,
// between 8 and 12 minutes and at most 2 minutes from estimatedMinutes.
import { interactionCatalog, limits } from '../catalog.mjs';
import { countWords } from '../text.mjs';
import { lessonTexts } from '../walk.mjs';

const decimal = (value) => value.toFixed(1).replace('.', ',');

/** `{ minutes, words, interactionMinutes, questionMinutes }`; minutes rounded to one decimal. */
export function computeMinutes(lesson) {
  const words = lessonTexts(lesson)
    .filter((entry) => entry.reading)
    .reduce((sum, entry) => sum + countWords(entry.text), 0);
  const interactionMinutes = lesson.steps
    .filter((step) => step.type === 'interaction')
    .reduce((sum, step) => sum + interactionCatalog[step.interaction.kind].minutes, 0);
  const questionMinutes = lesson.steps
    .filter((step) => step.type === 'quiz')
    .reduce((sum, step) => sum + step.questions.length * limits.minutesPerQuestion, 0);
  const minutes =
    Math.round((words / limits.wordsPerMinute + interactionMinutes + questionMinutes) * 10) / 10;
  return { minutes, words, interactionMinutes, questionMinutes };
}

export function checkTiming({ courses }) {
  const issues = [];
  for (const course of courses) {
    for (const lesson of course.lessons) {
      const { minutes, words, interactionMinutes, questionMinutes } = computeMinutes(lesson.data);
      const how = `${words} woorden / ${limits.wordsPerMinute} + ${interactionMinutes} min interactie + ${questionMinutes} min quiz`;
      if (minutes < limits.minMinutes || minutes > limits.maxMinutes) {
        issues.push({
          code: 'duration-out-of-range',
          file: lesson.file,
          path: 'estimatedMinutes',
          message: `berekende tijd is ${decimal(minutes)} minuten (${how}); een les duurt ${limits.minMinutes} tot ${limits.maxMinutes} minuten`,
        });
      }
      const estimate = lesson.data.estimatedMinutes;
      if (Math.abs(estimate - minutes) > limits.maxEstimateDeviation) {
        issues.push({
          code: 'duration-mismatch',
          file: lesson.file,
          path: 'estimatedMinutes',
          message: `estimatedMinutes is ${estimate}, maar de berekende tijd is ${decimal(minutes)} minuten (${how}); het verschil mag hoogstens ${limits.maxEstimateDeviation} minuten zijn`,
        });
      }
    }
  }
  return issues;
}
