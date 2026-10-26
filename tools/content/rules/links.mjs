// Links: only https, no trackers or tracking parameters, and no HTML in text. Also: no [[term]]
// in course.json (a course has no glossary to explain it).
import { inlineLinks, inlineTerms } from '../text.mjs';
import { trackerReason } from '../trackers.mjs';
import { lessonTexts } from '../walk.mjs';

const HTML = /<\/?[a-z][a-z0-9-]*(\s[^<>]*)?\/?>|<!--/i;

/** Issues for one URL (link-not-https or link-tracker). */
export function checkUrl(raw, file, path) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    url = undefined;
  }
  if (!url || url.protocol !== 'https:' || !raw.startsWith('https://') || !url.hostname) {
    return [
      {
        code: 'link-not-https',
        file,
        path,
        message: `link "${raw}" moet een volledige https://-link zijn`,
      },
    ];
  }
  const reason = trackerReason(url);
  if (reason) {
    return [{ code: 'link-tracker', file, path, message: `link "${raw}" mag niet: ${reason}` }];
  }
  return [];
}

/** Every text field of course.json, with its JSON path. */
export function courseTexts(course) {
  const fields = [
    'title',
    'audience',
    'goal',
    'successCriterion',
    'subject',
    'schoolLevel',
    'method',
    'chapter',
  ];
  const texts = fields
    .filter((field) => course[field] !== undefined)
    .map((field) => ({ path: field, text: course[field] }));
  texts.push({ path: 'ted.greeting', text: course.ted.greeting });
  course.lessons.forEach((entry, index) =>
    texts.push({ path: `lessons[${index}].title`, text: entry.title }),
  );
  course.sources.forEach((source, index) => {
    texts.push({ path: `sources[${index}].title`, text: source.title });
    texts.push({ path: `sources[${index}].publisher`, text: source.publisher });
    if (source.note !== undefined)
      texts.push({ path: `sources[${index}].note`, text: source.note });
  });
  return texts;
}

function htmlIssue(file, path) {
  return {
    code: 'markup-html',
    file,
    path,
    message:
      'HTML is niet toegestaan; gebruik **vet**, *cursief*, [label](https://…), [[term]] of {{1/5}}',
  };
}

export function checkLinks({ courses }) {
  const issues = [];
  for (const course of courses) {
    course.data.sources.forEach((source, index) =>
      issues.push(...checkUrl(source.url, course.file, `sources[${index}].url`)),
    );
    for (const { path, text } of courseTexts(course.data)) {
      if (HTML.test(text)) issues.push(htmlIssue(course.file, path));
      for (const url of inlineLinks(text)) issues.push(...checkUrl(url, course.file, path));
      for (const { term } of inlineTerms(text)) {
        issues.push({
          code: 'course-term-not-allowed',
          file: course.file,
          path,
          message: `[[${term}]] mag niet in course.json: een cursus heeft geen glossary; schrijf de term als gewone tekst`,
        });
      }
    }
    for (const lesson of course.lessons) {
      for (const { path, text } of lessonTexts(lesson.data)) {
        if (HTML.test(text)) issues.push(htmlIssue(lesson.file, path));
        for (const url of inlineLinks(text)) issues.push(...checkUrl(url, lesson.file, path));
      }
      lesson.data.steps.forEach((step, s) => {
        if (step.type !== 'practice') return;
        step.items.forEach((item, i) =>
          (item.links ?? []).forEach((link, l) =>
            issues.push(
              ...checkUrl(link.url, lesson.file, `steps[${s}].items[${i}].links[${l}].url`),
            ),
          ),
        );
      });
    }
  }
  return issues;
}
