// Test helpers: a temporary copy of the fixture course that a test can break in one place.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import { checkContent, repoRoot } from './check.mjs';

const execFileAsync = promisify(execFile);

export const fixtureCourseDir = join(repoRoot, 'content', 'fixtures', 'courses', 'proefcursus');
export const fixtureLessonName = 'lessons/01-proefles.json';
// Pinned "today" for the checks on the repository: never before the newest accessedOn in content/.
export const fixtureToday = '2026-10-24';

/**
 * Copies the fixture course and content/terms.json to a temporary content root.
 * `place: 'fixtures'` (default) puts the course in content/fixtures/courses/proefcursus,
 * `place: 'courses'` in content/courses/proefcursus (published content).
 * Pass the node:test context `t` to remove the directory after the test.
 */
export function fixtureRoot(t, { place = 'fixtures' } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'snuffel-content-'));
  t?.after(() => rmSync(root, { recursive: true, force: true }));
  const coursesDir =
    place === 'fixtures'
      ? join(root, 'content', 'fixtures', 'courses')
      : join(root, 'content', 'courses');
  const courseDir = join(coursesDir, 'proefcursus');
  mkdirSync(join(root, 'content', 'courses'), { recursive: true });
  cpSync(fixtureCourseDir, courseDir, { recursive: true });
  cpSync(join(repoRoot, 'content', 'terms.json'), join(root, 'content', 'terms.json'));

  const relCourseDir =
    place === 'fixtures' ? 'content/fixtures/courses/proefcursus' : 'content/courses/proefcursus';
  const path = (rel) => join(courseDir, rel);
  const readJson = (rel) => JSON.parse(readFileSync(path(rel), 'utf8'));
  const writeJson = (rel, data) => writeFileSync(path(rel), `${JSON.stringify(data, null, 2)}\n`);
  const mutate = (rel, fn) => {
    const data = readJson(rel);
    const result = fn(data);
    writeJson(rel, result === undefined ? data : result);
  };

  return {
    root,
    courseDir,
    /** content-root relative paths, as they appear in issues */
    courseFile: `${relCourseDir}/course.json`,
    lessonFile: `${relCourseDir}/${fixtureLessonName}`,
    relCourseDir,
    path,
    readJson,
    writeJson,
    readLesson: () => readJson(fixtureLessonName),
    readCourse: () => readJson('course.json'),
    mutateLesson: (fn) => mutate(fixtureLessonName, fn),
    mutateCourse: (fn) => mutate('course.json', fn),
    writeFile: (rel, text) => {
      mkdirSync(dirname(path(rel)), { recursive: true });
      writeFileSync(path(rel), text);
    },
    remove: (rel) => unlinkSync(path(rel)),
    /** Copies the course to another course directory below the same parent. */
    copyCourseTo: (name) => {
      const target = join(dirname(courseDir), name);
      cpSync(courseDir, target, { recursive: true });
      return target;
    },
    check: (options = {}) => checkContent({ root, today: fixtureToday, ...options }),
  };
}

/** Runs a content tool CLI; resolves with `{ code, stdout, stderr }` (never rejects). */
export async function runTool(script, args = []) {
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [script, ...args]);
    return { code: 0, stdout, stderr };
  } catch (error) {
    return { code: error.code, stdout: error.stdout ?? '', stderr: error.stderr ?? '' };
  }
}

/** The codes of all errors, for a readable assertion message. */
export function codes(result) {
  return result.errors.map((error) => `${error.code} ${error.file} ${error.path}`);
}

/** Asserts that there is an error with this code (and path and file, when given). */
export function assertIssue(result, code, path, file) {
  const match = result.errors.find(
    (error) =>
      error.code === code &&
      (path === undefined || error.path === path) &&
      (file === undefined || error.file === file),
  );
  assert.ok(
    match,
    `expected ${code} at ${file ?? '*'} ${path ?? '*'}; got:\n${codes(result).join('\n')}`,
  );
  assert.ok(match.message.length > 0);
  return match;
}

/** Asserts that there is no error with this code. */
export function assertNoIssue(result, code) {
  const match = result.errors.filter((error) => error.code === code);
  assert.deepEqual(match, [], `unexpected ${code}`);
}

export function assertClean(result) {
  assert.deepEqual(codes(result), []);
}
