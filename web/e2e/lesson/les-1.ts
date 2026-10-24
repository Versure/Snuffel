import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type {
  Course,
  ExplainStep,
  InteractionStep,
  Lesson,
  PracticeStep,
  QuizStep,
} from '../../src/app/core/content/content.types';
import { plainText } from '../../src/app/shared/inline-text/inline-markup';
import { normalize } from './fixture';

// Les 1 of the course roofvissen, read from disk (the real course, in the image and in the e2e
// build). The tests follow this file, not the reference lesson: it was rewritten (plan M13).
const courseDir = resolve(__dirname, '..', '..', '..', 'content', 'courses', 'roofvissen');

export const les1Course = JSON.parse(
  readFileSync(resolve(courseDir, 'course.json'), 'utf8'),
) as Course;
export const les1 = JSON.parse(
  readFileSync(resolve(courseDir, 'lessons', '01-aanbeet-of-vastzitten.json'), 'utf8'),
) as Lesson;

export const les1Path = '/leren/roofvissen/aanbeet-of-vastzitten';

export const les1Sources = new Map(les1Course.sources.map((source) => [source.id, source]));

export const les1Explain = les1.steps.find((step): step is ExplainStep => step.type === 'explain')!;
export const les1GameStep = les1.steps.find(
  (step): step is InteractionStep =>
    step.type === 'interaction' && step.interaction.kind === 'trace-game',
)!;
export const les1Quiz = les1.steps.find((step): step is QuizStep => step.type === 'quiz')!;
export const les1Water = les1.steps.find((step): step is PracticeStep => step.type === 'practice')!;

/** Every text of the lesson a reader should see, as plain text. */
export function les1VisibleTexts(): string[] {
  const texts: string[] = [
    les1.title,
    les1.sticker,
    les1.objective,
    les1.ted.intro.text,
    les1.ted.finished,
    `Ongeveer ${les1.estimatedMinutes} minuten`,
  ];
  for (const step of les1.steps) {
    texts.push(step.title);
    switch (step.type) {
      case 'explain':
        for (const block of step.blocks) {
          switch (block.type) {
            case 'signal-cards':
              for (const card of block.cards) texts.push(card.title, card.text);
              break;
            case 'rule':
              texts.push(block.title, block.text);
              break;
            case 'tip':
              texts.push(block.title ?? 'Tip', block.text);
              break;
            case 'figure':
              if (block.caption) texts.push(block.caption);
              break;
            default:
              texts.push(block.text);
          }
        }
        break;
      case 'interaction':
        texts.push(step.intro);
        if (step.interaction.kind === 'trace-game') {
          texts.push(...step.interaction.config.choices.map((choice) => choice.label));
        }
        break;
      case 'quiz':
        if (step.intro) texts.push(step.intro);
        for (const question of step.questions) {
          texts.push(question.prompt, ...question.options.map((option) => option.text));
        }
        break;
      case 'practice':
        texts.push(step.intro, step.successCriterion);
        for (const item of step.items) {
          texts.push(item.text, ...(item.links ?? []).map((link) => link.label));
        }
        break;
    }
  }
  for (const entry of les1.glossary) texts.push(entry.term, entry.definition);
  for (const reading of les1.furtherReading) {
    const source = les1Sources.get(reading.sourceRef)!;
    texts.push(source.title, source.publisher, reading.why);
  }
  for (const entry of les1.faq) texts.push(entry.q, entry.a);
  return texts.map((text) => normalize(plainText(text)));
}
