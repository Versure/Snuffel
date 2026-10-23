// `npm run content:check`: validates all content against the schemas and the content rules
// (docs/plan/implementatieplan.md 2.4) and prints every problem in Dutch with file and JSON path.
//
// Usage: node tools/content/check.mjs [--base <ref>] [--no-fixtures]
// --base: the ref to compare published ids and versions with (default main, else origin/main).
// Exit code 0 without errors, 1 with errors.
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { loadContent } from './load.mjs';
import { formatReport, sortIssues } from './report.mjs';
import { checkAssets } from './rules/assets.mjs';
import { checkGlossaryReferences, checkSentenceLength, checkTerms } from './rules/language.mjs';
import { checkLinks } from './rules/links.mjs';
import { checkQuiz } from './rules/quiz.mjs';
import { checkSources } from './rules/sources.mjs';
import { compareWithBase, resolveBase } from './rules/stability.mjs';
import { checkStructure } from './rules/structure.mjs';
import { checkTiming } from './rules/timing.mjs';
import { validate } from './schema.mjs';

export const repoRoot = resolve(import.meta.dirname, '..', '..');

/** Content rules in order; each takes the context and returns issues. */
export const contentRules = [
  checkStructure,
  checkSources,
  checkGlossaryReferences,
  checkQuiz,
  checkTiming,
  checkSentenceLength,
  checkTerms,
  checkLinks,
  checkAssets,
];

/** Local date as YYYY-MM-DD. */
export function localToday(now = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function withFile(file, issues) {
  return issues.map((issue) => ({ ...issue, file }));
}

/**
 * Loads and validates content. Courses with a parse or schema error (in course.json or one of
 * its lesson files) are left out of the content rules: fix the schema errors first.
 *
 * With `stability` (default), content/courses is also compared with `base` (default main, else
 * origin/main; see rules/stability.mjs). Without such a ref this part is skipped with a warning.
 *
 * Returns `{ errors, warnings, courses, terms }`; `courses` are the fully valid courses with
 * `lessons: [{ entry, index, file, data }]` (published lessons only).
 */
export function checkContent({
  root = repoRoot,
  fixtures = true,
  today = localToday(),
  rules = contentRules,
  stability = true,
  base,
} = {}) {
  const loaded = loadContent(root, { fixtures });
  const errors = [...loaded.issues];
  const warnings = [];

  let terms = [];
  if (loaded.terms.data !== undefined) {
    const termErrors = withFile(loaded.terms.file, validate('terms', loaded.terms.data));
    errors.push(...termErrors);
    if (termErrors.length === 0) terms = loaded.terms.data.terms;
  }

  const courses = [];
  let invalidPublishedContent = false;
  for (const course of loaded.courses) {
    let valid = course.data !== undefined;
    if (course.data !== undefined) {
      const courseErrors = withFile(course.file, validate('course', course.data));
      errors.push(...courseErrors);
      if (courseErrors.length > 0) valid = false;
    }
    for (const lessonFile of course.lessonFiles) {
      if (lessonFile.data === undefined) {
        valid = false;
        continue;
      }
      const lessonErrors = withFile(lessonFile.file, validate('lesson', lessonFile.data));
      errors.push(...lessonErrors);
      if (lessonErrors.length > 0) valid = false;
    }
    if (!valid) {
      if (course.relDir.startsWith('content/courses/')) invalidPublishedContent = true;
      continue;
    }
    const lessons = [];
    course.data.lessons.forEach((entry, index) => {
      if (entry.status !== 'published') return;
      const lessonFile = course.lessonFiles.find((candidate) => candidate.name === entry.file);
      if (lessonFile) lessons.push({ entry, index, file: lessonFile.file, data: lessonFile.data });
    });
    courses.push({ ...course, lessons });
  }

  const context = { root, courses, terms, today };
  for (const rule of rules) errors.push(...rule(context));

  if (stability) {
    const { ref, explicit } = resolveBase(root, base);
    if (invalidPublishedContent) {
      warnings.push(
        'id-stabiliteit niet gecontroleerd: los eerst de schemafouten in content/courses op',
      );
    } else if (!ref && explicit) {
      errors.push({
        code: 'base-not-found',
        file: 'content/courses',
        path: '',
        message: `basis "${explicit}" voor de vergelijking van id's bestaat niet in git`,
      });
    } else if (!ref) {
      warnings.push('id-stabiliteit niet gecontroleerd: geen main gevonden (ook geen origin/main)');
    } else {
      errors.push(...compareWithBase({ root, courses, ref }));
    }
  }

  return { errors: sortIssues(errors), warnings, courses, terms };
}

export function parseCheckArgs(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      fixtures: { type: 'boolean', default: true },
      base: { type: 'string' },
      root: { type: 'string' },
    },
    allowNegative: true,
  });
  return {
    fixtures: values.fixtures,
    base: values.base,
    root: values.root ? resolve(values.root) : repoRoot,
  };
}

function main() {
  let options;
  try {
    options = parseCheckArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`content:check: ${error.message}`);
    process.exit(2);
  }
  const result = checkContent(options);
  const report = formatReport(result);
  if (result.errors.length > 0) {
    console.error(report);
    process.exit(1);
  }
  console.log(report);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}

export const checkScript = join(import.meta.dirname, 'check.mjs');
