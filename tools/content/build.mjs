// `npm run content:build`: checks the content and writes it for the app to web/public/content/:
//   manifest.json                              courses and lessons with file and hash, the step
//                                              ids (stepIds) of every published lesson, and per
//                                              course the hash of every asset
//   <course-id>/course.json                    lessons[].file rewritten to lessons/<lesson-id>.json
//   <course-id>/lessons/<lesson-id>.json       one file per published lesson, named by its id
//   <course-id>/assets/…                       only the assets a lesson refers to
// Fixtures (content/fixtures) only with --fixtures: for `npm start` and the e2e tests, never in
// the image. The output is deterministic and replaces the previous output in one go; on a
// content error nothing is written. Id stability against main is not checked here (no git in
// the image build); that is part of `npm run content:check`.
//
// Usage: node tools/content/build.mjs [--fixtures] [--out <dir>]
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { checkContent, repoRoot } from './check.mjs';
import { formatReport } from './report.mjs';
import { lessonFigures } from './rules/assets.mjs';
import { validate } from './schema.mjs';

export const defaultOutDir = join(repoRoot, 'web', 'public', 'content');

/** First 16 hex characters of the sha-256 of the bytes. */
export function contentHash(bytes) {
  return createHash('sha256').update(bytes).digest('hex').slice(0, 16);
}

const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * Builds the output files in memory: `{ files: Map<relative path, Buffer>, manifest }`.
 * `courses` are the valid courses from checkContent.
 */
export function buildFiles(courses) {
  const files = new Map();
  const write = (path, bytes) => {
    files.set(path, bytes);
    return contentHash(bytes);
  };
  const json = (data) => Buffer.from(`${JSON.stringify(data)}\n`);

  const manifestCourses = [];
  for (const course of [...courses].sort((a, b) => byId(a.data, b.data))) {
    const id = course.data.id;
    const lessons = [];
    const assets = new Set();
    for (const entry of course.data.lessons) {
      if (entry.status !== 'published') {
        lessons.push({ id: entry.id, title: entry.title, status: entry.status });
        continue;
      }
      const lesson = course.lessons.find((candidate) => candidate.entry.id === entry.id);
      const file = `${id}/lessons/${entry.id}.json`;
      const hash = write(file, json(lesson.data));
      for (const { src } of lessonFigures(lesson.data)) assets.add(src);
      lessons.push({
        id: entry.id,
        title: entry.title,
        status: entry.status,
        version: lesson.data.version,
        estimatedMinutes: lesson.data.estimatedMinutes,
        file,
        hash,
        stepIds: lesson.data.steps.map((step) => step.id),
      });
    }
    const assetList = [...assets].sort().map((src) => ({
      path: src,
      hash: write(`${id}/${src}`, readFileSync(join(course.dir, ...src.split('/')))),
    }));
    const courseData = {
      ...course.data,
      lessons: course.data.lessons.map((entry) =>
        entry.status === 'published' ? { ...entry, file: `lessons/${entry.id}.json` } : entry,
      ),
    };
    const courseFile = `${id}/course.json`;
    const courseHash = write(courseFile, json(courseData));
    manifestCourses.push({
      id,
      title: course.data.title,
      kind: course.data.kind,
      access: course.data.access ?? 'all-children',
      file: courseFile,
      hash: courseHash,
      lessons,
      assets: assetList,
    });
  }
  const manifest = { schemaVersion: 1, courses: manifestCourses };
  const problems = validate('manifest', manifest);
  if (problems.length > 0) {
    throw new Error(`manifest does not match manifest.schema.json: ${JSON.stringify(problems)}`);
  }
  files.set('manifest.json', json(manifest));
  return { files, manifest };
}

/**
 * Removes staging directories (`.<out>-new-*` and their `-old` twin) that an aborted build left
 * next to the output directory, so they never end up in the app build. Returns the removed names.
 */
export function removeStaleStaging(outDir) {
  const parent = dirname(outDir);
  if (!existsSync(parent)) return [];
  const prefix = `.${basename(outDir)}-new-`;
  const stale = readdirSync(parent).filter((name) => name.startsWith(prefix));
  for (const name of stale) rmSync(join(parent, name), { recursive: true, force: true });
  return stale.sort();
}

/**
 * Checks and builds. Returns `{ ok: true, manifest }`, or `{ ok: false, errors, warnings }`
 * (the previous output stays as it was).
 */
export function buildContent({
  root = repoRoot,
  fixtures = false,
  out = defaultOutDir,
  today,
} = {}) {
  const result = checkContent({ root, fixtures, stability: false, ...(today ? { today } : {}) });
  if (result.errors.length > 0)
    return { ok: false, errors: result.errors, warnings: result.warnings };

  const { files, manifest } = buildFiles(result.courses);
  const outDir = resolve(out);
  removeStaleStaging(outDir);
  mkdirSync(dirname(outDir), { recursive: true });
  const staging = mkdtempSync(join(dirname(outDir), `.${basename(outDir)}-new-`));
  try {
    for (const [path, content] of files) {
      const target = join(staging, ...path.split('/'));
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, content);
    }
    // Swap in one go: the old output only disappears once the new one is complete.
    const previous = `${staging}-old`;
    if (existsSync(outDir)) renameSync(outDir, previous);
    renameSync(staging, outDir);
    rmSync(previous, { recursive: true, force: true });
  } catch (error) {
    rmSync(staging, { recursive: true, force: true });
    throw error;
  }
  return { ok: true, manifest, files: [...files.keys()].sort() };
}

export function parseBuildArgs(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      fixtures: { type: 'boolean', default: false },
      out: { type: 'string' },
      root: { type: 'string' },
    },
  });
  return {
    fixtures: values.fixtures,
    out: values.out ? resolve(values.out) : defaultOutDir,
    root: values.root ? resolve(values.root) : repoRoot,
  };
}

function main() {
  let options;
  try {
    options = parseBuildArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`content:build: ${error.message}`);
    process.exit(2);
  }
  const result = buildContent(options);
  if (!result.ok) {
    console.error(formatReport(result, 'content:build'));
    console.error('content:build: niets geschreven; de vorige uitvoer blijft staan');
    process.exit(1);
  }
  const lessons = result.manifest.courses.flatMap((course) => course.lessons);
  const published = lessons.filter((lesson) => lesson.status === 'published').length;
  console.log(
    `content:build: ${result.manifest.courses.length} cursus(sen), ${published} gepubliceerde les(sen)${
      options.fixtures ? ' (met fixtures)' : ''
    } naar ${relative(process.cwd(), options.out) || '.'}`,
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}

export const buildScript = fileURLToPath(import.meta.url);
