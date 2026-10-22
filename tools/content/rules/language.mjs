// Language: terms between [[ ]] are in the glossary, subject terms from content/terms.json that
// occur in a lesson are in its glossary, and sentences are short (at most 15 words on average).
import { limits } from '../catalog.mjs';
import { countWords, inlineTerms, plainText, splitSentences } from '../text.mjs';
import { lessonTexts } from '../walk.mjs';

export function normalizeTerm(term) {
  return term.trim().toLocaleLowerCase('nl');
}

export function checkGlossaryReferences({ courses }) {
  const issues = [];
  for (const course of courses) {
    for (const lesson of course.lessons) {
      const glossary = new Set(lesson.data.glossary.map((entry) => normalizeTerm(entry.term)));
      for (const { path, text, glossary: inGlossary } of lessonTexts(lesson.data)) {
        if (inGlossary) continue;
        for (const { term } of inlineTerms(text)) {
          if (!glossary.has(normalizeTerm(term))) {
            issues.push({
              code: 'glossary-term-unknown',
              file: lesson.file,
              path,
              message: `[[${term}]] verwijst naar een term die niet in de glossary van deze les staat`,
            });
          }
        }
      }
    }
  }
  return issues;
}

const decimal = (value) => value.toFixed(1).replace('.', ',');

/** Average words per sentence over the reading text of a lesson, plus the longest sentence. */
export function sentenceStats(lesson) {
  let words = 0;
  let sentences = 0;
  let longest = { words: 0, path: '' };
  for (const entry of lessonTexts(lesson)) {
    if (!entry.reading) continue;
    for (const sentence of splitSentences(entry.text)) {
      const count = countWords(sentence);
      words += count;
      sentences += 1;
      if (count > longest.words) longest = { words: count, path: entry.path };
    }
  }
  return { average: sentences === 0 ? 0 : words / sentences, words, sentences, longest };
}

export function checkSentenceLength({ courses }) {
  const issues = [];
  for (const course of courses) {
    for (const lesson of course.lessons) {
      const { average, longest } = sentenceStats(lesson.data);
      if (average > limits.maxAverageSentenceWords) {
        issues.push({
          code: 'sentence-length',
          file: lesson.file,
          path: '',
          message: `gemiddeld ${decimal(average)} woorden per zin; dat mag hoogstens ${limits.maxAverageSentenceWords} zijn (langste zin: ${longest.words} woorden, bij ${longest.path})`,
        });
      }
    }
  }
  return issues;
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** A whole-word, case-insensitive pattern for a term or form (spaces match any whitespace). */
export function termPattern(form) {
  const body = form.trim().split(/\s+/).map(escapeRegExp).join('\\s+');
  return new RegExp(`(?<![\\p{L}\\p{N}])${body}(?![\\p{L}\\p{N}])`, 'iu');
}

/** Subject terms from content/terms.json that occur in a lesson must be in its glossary. */
export function checkTerms({ courses, terms }) {
  const issues = [];
  const patterns = terms.map((entry) => ({
    term: entry.term,
    forms: [entry.term, ...(entry.forms ?? [])].map((form) => ({
      form,
      pattern: termPattern(form),
    })),
  }));
  for (const course of courses) {
    for (const lesson of course.lessons) {
      const glossary = new Set(lesson.data.glossary.map((entry) => normalizeTerm(entry.term)));
      const texts = lessonTexts(lesson.data)
        .filter((entry) => !entry.glossary)
        .map((entry) => ({ path: entry.path, plain: plainText(entry.text) }));
      for (const { term, forms } of patterns) {
        if (glossary.has(normalizeTerm(term))) continue;
        const hit = findFirst(texts, forms);
        if (hit) {
          issues.push({
            code: 'term-not-in-glossary',
            file: lesson.file,
            path: hit.path,
            message: `vakterm "${term}" (gevonden als "${hit.found}") staat niet in de glossary van deze les`,
          });
        }
      }
    }
  }
  return issues;
}

function findFirst(texts, forms) {
  for (const { path, plain } of texts) {
    for (const { pattern } of forms) {
      const match = pattern.exec(plain);
      if (match) return { path, found: match[0] };
    }
  }
  return null;
}
