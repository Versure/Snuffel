// Fractions in text: every `{{` and `}}` must form a valid {{a/b}} or {{n a/b}} (M14). In the app
// anything else stays plain text, so a typo would show the braces to the child.
import { inlineFractionProblems } from '../text.mjs';
import { lessonTexts } from '../walk.mjs';
import { courseTexts } from './links.mjs';

const HOW = 'Schrijf {{teller/noemer}} of {{geheel teller/noemer}}';

/** The Dutch message for one problem from inlineFractionProblems. */
export function fractionMessage({ snippet, reason, suggestion }) {
  switch (reason) {
    case 'not-whole':
      return `"${snippet}" is geen geldige breuk: alleen hele getallen, zonder komma of punt. ${HOW}.`;
    case 'zero-denominator':
      return `"${snippet}": de noemer van een breuk is nooit 0.`;
    case 'minus':
      return `"${snippet}": geen min binnen de haken; schrijf ${suggestion}.`;
    case 'spaces':
      return `"${snippet}": geen spaties binnen de haken, behalve één tussen het gehele getal en de breuk ({{1 1/4}}).`;
    case 'mixed-improper':
      return `"${snippet}": in een gemengd getal is het gehele getal minstens 1 en de teller kleiner dan de noemer; schrijf ${suggestion}.`;
    case 'stray-brace':
      return `"${snippet}": een losse { of } direct naast een breuk; schrijf ${suggestion}.`;
    case 'unclosed':
      return `"${snippet}": {{ zonder }}.`;
    case 'unopened':
      return `"}}" zonder {{.`;
    case 'inside-link-or-term':
      return `"${snippet}" mag niet in een link of in [[term|…]]: dat is platte tekst.`;
    default:
      return `"${snippet}" is geen geldige breuk. ${HOW}, met hele getallen.`;
  }
}

function issuesFor(file, path, text) {
  return inlineFractionProblems(text).map((problem) => ({
    code: 'markup-fraction-invalid',
    file,
    path,
    message: fractionMessage(problem),
  }));
}

export function checkFractions({ courses }) {
  const issues = [];
  for (const course of courses) {
    for (const { path, text } of courseTexts(course.data)) {
      issues.push(...issuesFor(course.file, path, text));
    }
    for (const lesson of course.lessons) {
      for (const { path, text } of lessonTexts(lesson.data)) {
        issues.push(...issuesFor(lesson.file, path, text));
      }
    }
  }
  return issues;
}
