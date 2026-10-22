// Quiz rules: one quiz step per course lesson, 3-5 questions, 3-4 options, the correct option
// exists, and the longest option is at most 1.5 times the shortest (no give-away by length).
import { limits } from '../catalog.mjs';
import { plainText } from '../text.mjs';

/** Length in characters as a reader sees it: markup removed, trimmed. */
export function optionLength(text) {
  return [...plainText(text).trim()].length;
}

export function checkQuiz({ courses }) {
  const issues = [];
  for (const course of courses) {
    for (const lesson of course.lessons) {
      const issue = (code, path, message) =>
        issues.push({ code, file: lesson.file, path, message });
      const quizSteps = lesson.data.steps.filter((step) => step.type === 'quiz');
      if (course.data.kind === 'course' && quizSteps.length !== 1) {
        issue(
          'quiz-step-count',
          'steps',
          `een les van een leertraject heeft precies één quizstap, deze heeft er ${quizSteps.length}`,
        );
      }
      if (course.data.kind === 'practice' && quizSteps.length > 1) {
        issue(
          'quiz-step-count',
          'steps',
          `een oefenles heeft hoogstens één quizstap, deze heeft er ${quizSteps.length}`,
        );
      }
      lesson.data.steps.forEach((step, s) => {
        if (step.type !== 'quiz') return;
        const count = step.questions.length;
        if (count < limits.minQuestions || count > limits.maxQuestions) {
          issue(
            'quiz-question-count',
            `steps[${s}].questions`,
            `een quiz heeft ${limits.minQuestions} tot ${limits.maxQuestions} vragen, deze heeft er ${count}`,
          );
        }
        step.questions.forEach((question, q) => {
          const path = `steps[${s}].questions[${q}]`;
          const options = question.options;
          if (options.length < limits.minOptions || options.length > limits.maxOptions) {
            issue(
              'quiz-option-count',
              `${path}.options`,
              `een vraag heeft ${limits.minOptions} of ${limits.maxOptions} opties, deze heeft er ${options.length}`,
            );
          }
          if (!options.some((option) => option.id === question.correctOptionId)) {
            issue(
              'quiz-correct-option-missing',
              `${path}.correctOptionId`,
              `juiste optie "${question.correctOptionId}" is geen van de opties (${options
                .map((option) => option.id)
                .join(', ')})`,
            );
          }
          const lengths = options.map((option) => optionLength(option.text));
          const shortest = Math.min(...lengths);
          const longest = Math.max(...lengths);
          if (longest > limits.maxOptionLengthRatio * shortest) {
            issue(
              'quiz-option-length',
              `${path}.options`,
              `langste optie is ${longest} tekens, kortste ${shortest}; de langste mag hoogstens 1,5 × de kortste zijn (${Math.floor(limits.maxOptionLengthRatio * shortest)} tekens), anders verraadt de lengte het antwoord`,
            );
          }
        });
      });
    }
  }
  return issues;
}
