// Sources: every sourceRef exists in course.json, no claim rests on low sources only, and the
// access dates are real dates that are not in the future.
import { sourceRefLists } from '../walk.mjs';

/** True for an existing calendar date in the form YYYY-MM-DD. */
export function isRealDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

export function checkSources({ courses, today }) {
  const issues = [];
  for (const course of courses) {
    const sources = new Map(course.data.sources.map((source) => [source.id, source]));

    course.data.sources.forEach((source, index) => {
      const path = `sources[${index}].accessedOn`;
      if (!isRealDate(source.accessedOn)) {
        issues.push({
          code: 'source-date-invalid',
          file: course.file,
          path,
          message: `"${source.accessedOn}" is geen bestaande datum`,
        });
      } else if (source.accessedOn > today) {
        issues.push({
          code: 'source-date-future',
          file: course.file,
          path,
          message: `datum ${source.accessedOn} ligt na vandaag (${today})`,
        });
      }
    });

    for (const lesson of course.lessons) {
      for (const { path, refs } of sourceRefLists(lesson.data)) {
        const known = [];
        refs.forEach((ref, index) => {
          const source = sources.get(ref);
          if (source) {
            known.push(source);
          } else {
            issues.push({
              code: 'source-ref-missing',
              file: lesson.file,
              path: `${path}[${index}]`,
              message: `bron "${ref}" staat niet in de bronnen van course.json`,
            });
          }
        });
        if (known.length > 0 && known.every((source) => source.reliability === 'low')) {
          issues.push({
            code: 'source-only-low',
            file: lesson.file,
            path,
            message: `steunt alleen op bronnen met reliability "low" (${known
              .map((source) => source.id)
              .join(', ')}); voeg een bron met "medium" of "high" toe`,
          });
        }
      }
      lesson.data.furtherReading.forEach((entry, index) => {
        if (!sources.has(entry.sourceRef)) {
          issues.push({
            code: 'source-ref-missing',
            file: lesson.file,
            path: `furtherReading[${index}].sourceRef`,
            message: `bron "${entry.sourceRef}" staat niet in de bronnen van course.json`,
          });
        }
      });
    }
  }
  return issues;
}
