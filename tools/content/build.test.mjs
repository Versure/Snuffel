import assert from 'node:assert/strict';
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { describe, test } from 'node:test';
import { buildContent, buildScript, contentHash, parseBuildArgs } from './build.mjs';
import { repoRoot } from './check.mjs';
import { validate } from './schema.mjs';
import { fixtureLessonName, fixtureRoot, fixtureToday, runTool } from './test-helpers.mjs';

function listFiles(dir) {
  const result = [];
  const walk = (current) => {
    for (const entry of readdirSync(current)) {
      const path = join(current, entry);
      if (statSync(path).isDirectory()) walk(path);
      else result.push(relative(dir, path).split(sep).join('/'));
    }
  };
  walk(dir);
  return result.sort();
}

function readTree(dir) {
  return Object.fromEntries(listFiles(dir).map((file) => [file, readFileSync(join(dir, file))]));
}

const isFigure = (block) => block.type === 'figure';

function build(fixture, options = {}) {
  const out = join(fixture.root, 'out', 'content');
  return {
    out,
    result: buildContent({ root: fixture.root, out, today: fixtureToday, ...options }),
  };
}

describe('content:build', () => {
  test('without --fixtures the manifest has no proefcursus', (t) => {
    const fixture = fixtureRoot(t);
    const { out, result } = build(fixture);
    assert.equal(result.ok, true);
    const manifest = JSON.parse(readFileSync(join(out, 'manifest.json'), 'utf8'));
    assert.deepEqual(manifest, { schemaVersion: 1, courses: [] });
    assert.deepEqual(listFiles(out), ['manifest.json']);
  });

  test('without --fixtures the manifest has no fixture course at all', (t) => {
    // The real repository: every course under content/fixtures/courses (the proefcursus, the
    // proefhuiswerk, and the sample course made with snuffel-leren --voorbeeld) stays out of the
    // image build.
    const fixtureCourses = readdirSync(join(repoRoot, 'content', 'fixtures', 'courses'), {
      withFileTypes: true,
    })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
    assert.ok(fixtureCourses.includes('proefcursus'));
    assert.ok(fixtureCourses.includes('proefhuiswerk'));
    const out = mkdtempSync(join(tmpdir(), 'snuffel-build-'));
    t.after(() => rmSync(out, { recursive: true, force: true }));
    const result = buildContent({ root: repoRoot, out: join(out, 'content') });
    assert.equal(result.ok, true);
    const manifest = JSON.parse(readFileSync(join(out, 'content', 'manifest.json'), 'utf8'));
    const ids = manifest.courses.map((course) => course.id);
    for (const name of fixtureCourses) assert.ok(!ids.includes(name), `${name} is in the manifest`);
    for (const file of result.files) {
      const [top] = file.split('/');
      assert.ok(!fixtureCourses.includes(top), `${file} comes from a fixture course`);
    }
  });

  test('without --fixtures the manifest has the roofvissen course with aanbeet-of-vastzitten', (t) => {
    // The real repository: les 1 of roofvissen goes into the image build.
    const out = mkdtempSync(join(tmpdir(), 'snuffel-build-'));
    t.after(() => rmSync(out, { recursive: true, force: true }));
    const result = buildContent({ root: repoRoot, out: join(out, 'content') });
    assert.equal(result.ok, true);
    const manifest = JSON.parse(readFileSync(join(out, 'content', 'manifest.json'), 'utf8'));
    const course = manifest.courses.find((candidate) => candidate.id === 'roofvissen');
    assert.ok(course, 'roofvissen is not in the manifest');
    assert.equal(course.kind, 'course');
    assert.equal(course.file, 'roofvissen/course.json');
    const lesson = course.lessons.find((candidate) => candidate.id === 'aanbeet-of-vastzitten');
    assert.ok(lesson, 'aanbeet-of-vastzitten is not in the manifest');
    assert.equal(lesson.status, 'published');
    assert.equal(lesson.file, 'roofvissen/lessons/aanbeet-of-vastzitten.json');
    assert.deepEqual(lesson.stepIds, ['uitleg', 'spel', 'quiz', 'water']);
    assert.ok(result.files.includes('roofvissen/course.json'));
    assert.ok(result.files.includes('roofvissen/lessons/aanbeet-of-vastzitten.json'));
    const built = JSON.parse(
      readFileSync(
        join(out, 'content', 'roofvissen', 'lessons', 'aanbeet-of-vastzitten.json'),
        'utf8',
      ),
    );
    assert.equal(built.id, 'aanbeet-of-vastzitten');
  });

  test('with --fixtures the lesson and asset are written', (t) => {
    const fixture = fixtureRoot(t);
    const { out, result } = build(fixture, { fixtures: true });
    assert.equal(result.ok, true);
    assert.deepEqual(listFiles(out), [
      'manifest.json',
      'proefcursus/assets/hengeltop.svg',
      'proefcursus/course.json',
      'proefcursus/lessons/proefles.json',
    ]);
    const manifest = JSON.parse(readFileSync(join(out, 'manifest.json'), 'utf8'));
    const [course] = manifest.courses;
    assert.equal(course.id, 'proefcursus');
    assert.equal(course.file, 'proefcursus/course.json');
    assert.deepEqual(
      course.lessons.map(({ id, status, file }) => [id, status, file]),
      [
        ['proefles', 'published', 'proefcursus/lessons/proefles.json'],
        ['proefles-later', 'planned', undefined],
      ],
    );
    assert.equal(course.lessons[0].version, 1);
    assert.equal(course.lessons[0].estimatedMinutes, fixture.readLesson().estimatedMinutes);
    const lesson = JSON.parse(readFileSync(join(out, 'proefcursus/lessons/proefles.json'), 'utf8'));
    assert.deepEqual(lesson, fixture.readLesson());
    const builtCourse = JSON.parse(readFileSync(join(out, 'proefcursus/course.json'), 'utf8'));
    assert.equal(builtCourse.lessons[0].file, 'lessons/proefles.json');
    assert.equal(builtCourse.lessons[1].file, undefined);
    assert.deepEqual(
      readFileSync(join(out, 'proefcursus/assets/hengeltop.svg')),
      readFileSync(fixture.path('assets/hengeltop.svg')),
    );
  });

  test('the manifest lists the step ids of every published lesson in lesson order', (t) => {
    const fixture = fixtureRoot(t);
    const { out } = build(fixture, { fixtures: true });
    const manifest = JSON.parse(readFileSync(join(out, 'manifest.json'), 'utf8'));
    const [published] = manifest.courses[0].lessons;
    assert.deepEqual(
      published.stepIds,
      fixture.readLesson().steps.map((step) => step.id),
    );
    assert.deepEqual(published.stepIds, ['uitleg', 'spel', 'quiz', 'zelf-doen']);
  });

  test('a planned lesson has no step ids in the manifest', (t) => {
    const fixture = fixtureRoot(t);
    const { out } = build(fixture, { fixtures: true });
    const manifest = JSON.parse(readFileSync(join(out, 'manifest.json'), 'utf8'));
    const planned = manifest.courses[0].lessons.find((lesson) => lesson.status === 'planned');
    assert.ok(planned);
    assert.equal('stepIds' in planned, false);
  });

  test('manifest matches manifest.schema.json', (t) => {
    const fixture = fixtureRoot(t);
    const { out } = build(fixture, { fixtures: true });
    const manifest = JSON.parse(readFileSync(join(out, 'manifest.json'), 'utf8'));
    assert.deepEqual(validate('manifest', manifest), []);
  });

  test('hashes match the bytes', (t) => {
    const fixture = fixtureRoot(t);
    const { out } = build(fixture, { fixtures: true });
    const manifest = JSON.parse(readFileSync(join(out, 'manifest.json'), 'utf8'));
    const entries = manifest.courses.flatMap((course) => [
      course,
      ...course.lessons.filter((lesson) => lesson.file),
    ]);
    assert.equal(entries.length, 2);
    for (const { file, hash } of entries) {
      assert.match(hash, /^[0-9a-f]{16}$/);
      assert.equal(contentHash(readFileSync(join(out, file))), hash, file);
    }
  });

  test('the manifest lists every copied asset with a matching hash', (t) => {
    const fixture = fixtureRoot(t);
    const { out } = build(fixture, { fixtures: true });
    const manifest = JSON.parse(readFileSync(join(out, 'manifest.json'), 'utf8'));
    for (const course of manifest.courses) {
      const copied = listFiles(join(out, course.id)).filter((file) => file.startsWith('assets/'));
      assert.deepEqual(
        course.assets.map((asset) => asset.path),
        copied,
      );
      for (const { path, hash } of course.assets) {
        assert.equal(contentHash(readFileSync(join(out, course.id, path))), hash, path);
      }
    }
    assert.deepEqual(
      manifest.courses[0].assets.map((asset) => asset.path),
      ['assets/hengeltop.svg'],
    );
  });

  test('manifest assets are unique by path and sorted', (t) => {
    const fixture = fixtureRoot(t);
    const svg = readFileSync(fixture.path('assets/hengeltop.svg'), 'utf8');
    fixture.writeFile('assets/z-top.svg', svg);
    fixture.writeFile('assets/a-top.svg', svg);
    fixture.mutateLesson((lesson) => {
      const step = lesson.steps.find((candidate) => candidate.blocks?.some(isFigure));
      const figure = step.blocks.find(isFigure);
      // Refers to hengeltop twice and the new ones out of order.
      for (const src of ['assets/z-top.svg', 'assets/hengeltop.svg', 'assets/a-top.svg']) {
        step.blocks.push({ ...figure, src });
      }
    });
    const { out, result } = build(fixture, { fixtures: true });
    assert.equal(result.ok, true);
    const manifest = JSON.parse(readFileSync(join(out, 'manifest.json'), 'utf8'));
    const paths = manifest.courses[0].assets.map((asset) => asset.path);
    assert.deepEqual(paths, ['assets/a-top.svg', 'assets/hengeltop.svg', 'assets/z-top.svg']);
    assert.equal(new Set(paths).size, paths.length);
    assert.deepEqual(paths, [...paths].sort());
  });

  test('a course without figures has an empty assets list', (t) => {
    const fixture = fixtureRoot(t);
    fixture.mutateLesson((lesson) => {
      for (const step of lesson.steps) {
        if (step.blocks) step.blocks = step.blocks.filter((block) => block.type !== 'figure');
      }
    });
    const { out, result } = build(fixture, { fixtures: true });
    assert.equal(result.ok, true);
    const manifest = JSON.parse(readFileSync(join(out, 'manifest.json'), 'utf8'));
    assert.deepEqual(manifest.courses[0].assets, []);
    assert.deepEqual(validate('manifest', manifest), []);
  });

  test('changing only an svg changes its asset hash and nothing else', (t) => {
    const fixture = fixtureRoot(t);
    const { out } = build(fixture, { fixtures: true });
    const before = JSON.parse(readFileSync(join(out, 'manifest.json'), 'utf8'));
    const lessonBefore = readFileSync(join(out, 'proefcursus/lessons/proefles.json'));
    const svg = readFileSync(fixture.path('assets/hengeltop.svg'), 'utf8');
    fixture.writeFile('assets/hengeltop.svg', svg.replace('</svg>', '<!-- anders --></svg>'));
    build(fixture, { fixtures: true });
    const after = JSON.parse(readFileSync(join(out, 'manifest.json'), 'utf8'));
    assert.notEqual(after.courses[0].assets[0].hash, before.courses[0].assets[0].hash);
    after.courses[0].assets[0].hash = before.courses[0].assets[0].hash;
    assert.deepEqual(after, before);
    assert.deepEqual(readFileSync(join(out, 'proefcursus/lessons/proefles.json')), lessonBefore);
  });

  test('two builds are identical', (t) => {
    const fixture = fixtureRoot(t);
    const { out } = build(fixture, { fixtures: true });
    const first = readTree(out);
    build(fixture, { fixtures: true });
    assert.deepEqual(readTree(out), first);
    // And into another directory.
    const second = join(fixture.root, 'out', 'second');
    buildContent({ root: fixture.root, out: second, fixtures: true, today: fixtureToday });
    assert.deepEqual(readTree(second), first);
  });

  test('a content error keeps the previous output', async (t) => {
    const fixture = fixtureRoot(t);
    const { out } = build(fixture, { fixtures: true });
    const before = readTree(out);
    fixture.mutateLesson((lesson) => {
      delete lesson.objective;
    });
    const { result } = build(fixture, { fixtures: true });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((error) => error.code === 'schema'));
    assert.deepEqual(readTree(out), before);

    const { code, stderr } = await runTool(buildScript, [
      '--root',
      fixture.root,
      '--out',
      out,
      '--fixtures',
    ]);
    assert.equal(code, 1);
    assert.match(stderr, /content:build: 1 fout/);
    assert.match(stderr, /objective: verplicht veld "objective" ontbreekt/);
    assert.match(stderr, /de vorige uitvoer blijft staan/);
    assert.deepEqual(readTree(out), before);
  });

  test('a stale file from an earlier build disappears', (t) => {
    const fixture = fixtureRoot(t);
    const { out } = build(fixture, { fixtures: true });
    writeFileSync(join(out, 'oud.json'), '{}');
    build(fixture, { fixtures: true });
    assert.ok(!listFiles(out).includes('oud.json'));
    assert.deepEqual(
      readdirSync(join(fixture.root, 'out')).filter((name) => name.startsWith('.')),
      [],
    );
  });

  test('staging directories left by an aborted build are removed', (t) => {
    const fixture = fixtureRoot(t);
    const parent = join(fixture.root, 'out');
    for (const name of ['.content-new-abc123', '.content-new-abc123-old', '.content-new-x']) {
      mkdirSync(join(parent, name, 'proefcursus'), { recursive: true });
      writeFileSync(join(parent, name, 'manifest.json'), '{}');
    }
    mkdirSync(join(parent, '.andere-map'), { recursive: true });
    const { result } = build(fixture, { fixtures: true });
    assert.equal(result.ok, true);
    assert.deepEqual(
      readdirSync(parent)
        .filter((name) => name.startsWith('.'))
        .sort(),
      ['.andere-map'],
    );
  });

  test('only assets that a lesson refers to are copied', (t) => {
    const fixture = fixtureRoot(t);
    fixture.writeFile('assets/ongebruikt.svg', '<svg xmlns="http://www.w3.org/2000/svg"/>\n');
    const { out } = build(fixture, { fixtures: true });
    assert.deepEqual(
      listFiles(out).filter((file) => file.includes('/assets/')),
      ['proefcursus/assets/hengeltop.svg'],
    );
  });

  test('the lesson file is named by its id, not by its number', (t) => {
    const fixture = fixtureRoot(t);
    assert.equal(fixtureLessonName, 'lessons/01-proefles.json');
    const { result } = build(fixture, { fixtures: true });
    assert.ok(result.files.includes('proefcursus/lessons/proefles.json'));
  });

  test('parseBuildArgs: no fixtures and web/public/content by default', () => {
    const options = parseBuildArgs([]);
    assert.equal(options.fixtures, false);
    assert.equal(options.out, join(repoRoot, 'web', 'public', 'content'));
    assert.equal(parseBuildArgs(['--fixtures']).fixtures, true);
  });
});
