// Reads content from disk: courses (content/courses and, with fixtures, content/fixtures/courses)
// and the term list (content/terms.json). Parse errors become `json-invalid` with line and column.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/** Path relative to the content root, always with forward slashes (stable in messages). */
export function relativePath(root, path) {
  return relative(root, path).split(sep).join('/');
}

/** The course roots below `root`: real content, plus the fixtures when asked. */
export function courseRoots(root, { fixtures = false } = {}) {
  const roots = [join(root, 'content', 'courses')];
  if (fixtures) roots.push(join(root, 'content', 'fixtures', 'courses'));
  return roots;
}

/** 1-based line and column of a character offset. */
export function lineAndColumn(text, offset) {
  const before = text.slice(0, offset);
  const line = before.split('\n').length;
  const column = offset - before.lastIndexOf('\n');
  return { line, column };
}

/**
 * Offset of the first syntax error in `text` (a small JSON scanner, because the message of
 * JSON.parse does not always carry a position). Returns -1 for valid JSON.
 */
export function jsonErrorOffset(text) {
  let i = 0;
  const fail = () => {
    throw i;
  };
  const ws = () => {
    while (i < text.length && ' \t\n\r'.includes(text[i])) i++;
  };
  const literal = (word) => {
    if (text.startsWith(word, i)) i += word.length;
    else fail();
  };
  const string = () => {
    i++;
    while (i < text.length && text[i] !== '"') {
      if (text[i] === '\\') {
        i++;
        if (text[i] === 'u') {
          if (!/^[0-9a-fA-F]{4}$/.test(text.slice(i + 1, i + 5))) fail();
          i += 4;
        } else if (!'"\\/bfnrt'.includes(text[i] ?? '')) fail();
      } else if (text.charCodeAt(i) < 0x20) fail();
      i++;
    }
    if (i >= text.length) fail();
    i++;
  };
  const number = () => {
    const match = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/.exec(text.slice(i));
    if (!match) fail();
    i += match[0].length;
  };
  const value = () => {
    ws();
    const char = text[i];
    if (char === '{') {
      i++;
      ws();
      if (text[i] === '}') return void i++;
      for (;;) {
        ws();
        if (text[i] !== '"') fail();
        string();
        ws();
        if (text[i] !== ':') fail();
        i++;
        value();
        ws();
        if (text[i] === ',') i++;
        else if (text[i] === '}') return void i++;
        else fail();
      }
    }
    if (char === '[') {
      i++;
      ws();
      if (text[i] === ']') return void i++;
      for (;;) {
        value();
        ws();
        if (text[i] === ',') i++;
        else if (text[i] === ']') return void i++;
        else fail();
      }
    }
    if (char === '"') return string();
    if (char === 't') return literal('true');
    if (char === 'f') return literal('false');
    if (char === 'n') return literal('null');
    return number();
  };
  try {
    value();
    ws();
    if (i < text.length) fail();
    return -1;
  } catch (offset) {
    if (typeof offset === 'number') return Math.min(offset, text.length);
    throw offset;
  }
}

/**
 * Parses JSON. Returns `{ data }` or `{ error }` (an issue with code `json-invalid`, the line and
 * column of the problem, and the original parser message).
 */
export function parseJson(text, file) {
  try {
    return { data: JSON.parse(text) };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    const offset = jsonErrorOffset(text);
    let where = '';
    if (offset >= 0) {
      const { line, column } = lineAndColumn(text, offset);
      where = ` op regel ${line}, kolom ${column}`;
    }
    return {
      error: {
        code: 'json-invalid',
        file,
        path: '',
        message: `ongeldige JSON${where} (${reason})`,
      },
    };
  }
}

function readJson(root, path, issues) {
  const file = relativePath(root, path);
  const { data, error } = parseJson(readFileSync(path, 'utf8'), file);
  if (error) issues.push(error);
  return { file, data };
}

function listDirectories(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => statSync(join(dir, name)).isDirectory())
    .sort();
}

/**
 * Loads every course below the course roots.
 *
 * Returns `{ courses, terms, issues }`:
 * - `courses`: `[{ dir, relDir, name, file, data, lessonFiles: [{ name, file, data }] }]`, where
 *   `name` is the directory name and `lessonFiles` holds every `.json` file in `lessons/`
 *   (`name` like `lessons/01-proefles.json`); `data` is undefined when the JSON is invalid;
 * - `terms`: `{ file, data }` for content/terms.json;
 * - `issues`: problems found while reading (json-invalid, course-file-missing, terms-file-missing).
 */
export function loadContent(root, { fixtures = false } = {}) {
  const issues = [];
  const courses = [];
  for (const coursesDir of courseRoots(root, { fixtures })) {
    for (const name of listDirectories(coursesDir)) {
      const dir = join(coursesDir, name);
      const coursePath = join(dir, 'course.json');
      const relDir = relativePath(root, dir);
      if (!existsSync(coursePath)) {
        issues.push({
          code: 'course-file-missing',
          file: `${relDir}/course.json`,
          path: '',
          message: `de map ${relDir} heeft geen course.json`,
        });
        continue;
      }
      const course = readJson(root, coursePath, issues);
      const lessonsDir = join(dir, 'lessons');
      const lessonFiles = existsSync(lessonsDir)
        ? readdirSync(lessonsDir)
            .filter((entry) => entry.endsWith('.json'))
            .sort()
            .map((entry) => ({
              name: `lessons/${entry}`,
              ...readJson(root, join(lessonsDir, entry), issues),
            }))
        : [];
      courses.push({ dir, relDir, name, file: course.file, data: course.data, lessonFiles });
    }
  }

  const termsPath = join(root, 'content', 'terms.json');
  let terms = { file: 'content/terms.json', data: undefined };
  if (existsSync(termsPath)) {
    terms = readJson(root, termsPath, issues);
  } else {
    issues.push({
      code: 'terms-file-missing',
      file: 'content/terms.json',
      path: '',
      message: 'content/terms.json ontbreekt (de lijst met vaktermen)',
    });
  }
  return { courses, terms, issues };
}
