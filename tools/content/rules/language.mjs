// Language: terms between [[ ]] are in the glossary of the lesson.
import { inlineTerms } from '../text.mjs';
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
