// Id stability against main: progress hangs on ids, so a lesson that is published on main keeps
// its course id, lesson id and step, question, option, interaction and checklist item ids, under
// the same parent; it stays published; and any change raises `version`.
// Only content/courses is compared; fixtures are test data and fall outside this check.
import { execFileSync } from 'node:child_process';
import { posix } from 'node:path';
import { parseJson } from '../load.mjs';
import { lessonIds } from '../walk.mjs';

const coursesPrefix = 'content/courses/';

/** Runs git in `root`, without GIT_* variables from a surrounding hook. Returns stdout or null. */
function git(root, args) {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !name.startsWith('GIT_')),
  );
  try {
    return execFileSync('git', args, {
      cwd: root,
      env,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch {
    return null;
  }
}

function refExists(root, ref) {
  return git(root, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]) !== null;
}

/**
 * The ref to compare with: `explicit` when given (null when it does not exist), otherwise
 * `main`, then `origin/main`. Returns `{ ref }` or `{ ref: null, explicit }`.
 */
export function resolveBase(root, explicit) {
  if (explicit) return { ref: refExists(root, explicit) ? explicit : null, explicit };
  for (const candidate of ['main', 'origin/main']) {
    if (refExists(root, candidate)) return { ref: candidate };
  }
  return { ref: null };
}

/** Courses in content/courses at `ref`: `Map<dir name, { data, lessons: Map<file, data> }>`. */
export function readBaseCourses(root, ref) {
  const listing = git(root, ['ls-tree', '-r', '--name-only', ref, '--', 'content/courses']);
  const courses = new Map();
  if (!listing) return courses;
  const files = listing.split('\n').filter(Boolean);
  const read = (path) => {
    const text = git(root, ['show', `${ref}:./${path}`]);
    return text === null ? undefined : parseJson(text, path).data;
  };
  for (const path of files) {
    const match = /^content\/courses\/([^/]+)\/course\.json$/.exec(path);
    if (!match) continue;
    const data = read(path);
    if (!data || !Array.isArray(data.lessons)) continue;
    const lessons = new Map();
    for (const entry of data.lessons) {
      if (entry.status !== 'published' || typeof entry.file !== 'string') continue;
      const lessonPath = posix.join('content/courses', match[1], entry.file);
      if (!files.includes(lessonPath)) continue;
      const lesson = read(lessonPath);
      if (lesson) lessons.set(entry.file, lesson);
    }
    courses.set(match[1], { data, lessons });
  }
  return courses;
}

/** JSON with sorted keys, so that key order does not count as a change. */
export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function withoutVersion(lesson) {
  const { version: _version, ...rest } = lesson;
  return rest;
}

const kindNames = {
  step: 'stap',
  question: 'vraag',
  option: 'optie',
  interaction: 'interactie',
  item: 'checklist-item',
};

/** Compares the ids of one published lesson with its version on main. */
function compareLesson(oldLesson, newLesson, file, issues) {
  const newIds = lessonIds(newLesson);
  for (const old of lessonIds(oldLesson)) {
    const same = newIds.find(
      (entry) => entry.kind === old.kind && entry.id === old.id && entry.parent === old.parent,
    );
    if (same) continue;
    // Options are unique per question only; other ids share the lesson namespace.
    const elsewhere = newIds.find((entry) =>
      old.kind === 'option'
        ? entry.kind === 'option' && entry.id === old.id
        : entry.kind !== 'option' && entry.id === old.id,
    );
    const what = `${kindNames[old.kind]} "${old.id}"`;
    if (elsewhere) {
      issues.push({
        code: 'id-moved',
        file,
        path: elsewhere.path,
        message: `${what} hoorde op main bij ${old.parent ? `"${old.parent}"` : 'de les'} (${old.path}); een gepubliceerd id blijft op zijn plek en wordt niet hergebruikt`,
      });
    } else {
      issues.push({
        code: 'id-removed',
        file,
        path: old.path,
        message: `${what} is gepubliceerd op main (${old.path}) en mag niet verdwijnen of hernoemd worden; voortgang hangt eraan`,
      });
    }
  }

  const oldVersion = oldLesson.version;
  const newVersion = newLesson.version;
  if (newVersion < oldVersion) {
    issues.push({
      code: 'version-not-bumped',
      file,
      path: 'version',
      message: `version is ${newVersion}, lager dan op main (${oldVersion})`,
    });
  } else if (
    newVersion === oldVersion &&
    canonical(withoutVersion(oldLesson)) !== canonical(withoutVersion(newLesson))
  ) {
    issues.push({
      code: 'version-not-bumped',
      file,
      path: 'version',
      message: `de les is gewijzigd ten opzichte van main; verhoog version naar ${oldVersion + 1}`,
    });
  }
}

/**
 * Compares content/courses with `ref`. `courses` are the current valid courses (fixtures are
 * ignored). Returns issues.
 */
export function compareWithBase({ root, courses, ref }) {
  const issues = [];
  const current = courses.filter((course) => course.relDir.startsWith(coursesPrefix));
  const byId = new Map(current.map((course) => [course.data.id, course]));
  for (const [dirName, old] of readBaseCourses(root, ref)) {
    if (old.lessons.size === 0) continue;
    const course = byId.get(old.data.id);
    const courseFile = course?.file ?? `${coursesPrefix}${dirName}/course.json`;
    if (!course) {
      issues.push({
        code: 'id-removed',
        file: courseFile,
        path: 'id',
        message: `cursus "${old.data.id}" heeft gepubliceerde lessen op main en mag niet verdwijnen of hernoemd worden`,
      });
    }
    for (const [oldFile, oldLesson] of old.lessons) {
      const oldEntry = old.data.lessons.find((entry) => entry.file === oldFile);
      const id = oldEntry.id;
      const index = course ? course.data.lessons.findIndex((entry) => entry.id === id) : -1;
      if (index < 0) {
        const other = current.find(
          (candidate) =>
            candidate !== course && candidate.data.lessons.some((entry) => entry.id === id),
        );
        if (other) {
          issues.push({
            code: 'id-moved',
            file: other.file,
            path: `lessons[${other.data.lessons.findIndex((entry) => entry.id === id)}].id`,
            message: `les "${id}" hoort op main bij cursus "${old.data.id}" en mag niet naar een andere cursus`,
          });
        } else if (course) {
          issues.push({
            code: 'id-removed',
            file: courseFile,
            path: 'lessons',
            message: `les "${id}" is gepubliceerd op main en mag niet uit course.json verdwijnen of hernoemd worden`,
          });
        }
        continue;
      }
      const entry = course.data.lessons[index];
      if (entry.status !== 'published') {
        issues.push({
          code: 'lesson-unpublished',
          file: courseFile,
          path: `lessons[${index}].status`,
          message: `les "${id}" is gepubliceerd op main en moet "published" blijven`,
        });
        continue;
      }
      const lesson = course.lessons.find((candidate) => candidate.entry.id === id);
      if (lesson) compareLesson(oldLesson, lesson.data, lesson.file, issues);
    }
  }
  return issues;
}
