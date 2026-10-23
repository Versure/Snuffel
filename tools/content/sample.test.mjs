// Ids starting with `voorbeeld-` are reserved for samples that `snuffel-leren --voorbeeld` writes
// to content/fixtures/courses. They must never appear in real content (content/courses).
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { repoRoot } from './check.mjs';
import { loadContent } from './load.mjs';
import { fixtureRoot } from './test-helpers.mjs';

export const sampleIdPrefix = 'voorbeeld-';

/**
 * Every course and lesson id in content/courses below `root` that starts with `voorbeeld-`:
 * course directories, course ids, lesson entries in course.json, lesson files and their ids.
 */
export function sampleIdsInRealContent(root) {
  const found = [];
  const note = (where, id) => {
    if (typeof id === 'string' && id.startsWith(sampleIdPrefix)) found.push(`${where}: ${id}`);
  };
  for (const course of loadContent(root, { fixtures: false }).courses) {
    note(course.relDir, course.name);
    note(course.file, course.data?.id);
    for (const entry of course.data?.lessons ?? []) note(`${course.file} lessons`, entry.id);
    for (const lesson of course.lessonFiles) {
      note(lesson.file, lesson.name.replace(/^lessons\/(\d+-)?/, '').replace(/\.json$/, ''));
      note(lesson.file, lesson.data?.id);
    }
  }
  return found;
}

describe('sample ids', () => {
  test('no course or lesson id under content/courses starts with voorbeeld-', () => {
    assert.deepEqual(sampleIdsInRealContent(repoRoot), []);
  });

  test('a voorbeeld- course in content/courses is found', (t) => {
    const fixture = fixtureRoot(t, { place: 'courses' });
    assert.deepEqual(sampleIdsInRealContent(fixture.root), []);
    fixture.mutateCourse((course) => {
      course.lessons[1].id = 'voorbeeld-later';
    });
    fixture.mutateLesson((lesson) => {
      lesson.id = 'voorbeeld-les';
    });
    fixture.copyCourseTo('voorbeeld-cursus');
    const found = sampleIdsInRealContent(fixture.root);
    assert.ok(found.some((line) => line.endsWith(': voorbeeld-cursus')));
    assert.ok(found.some((line) => line.endsWith(': voorbeeld-later')));
    assert.ok(found.some((line) => line.endsWith(': voorbeeld-les')));
  });

  test('a lesson file named NN-voorbeeld-… in content/courses is found', (t) => {
    const fixture = fixtureRoot(t, { place: 'courses' });
    fixture.writeJson('lessons/02-voorbeeld-los.json', fixture.readLesson());
    const found = sampleIdsInRealContent(fixture.root);
    assert.deepEqual(found, [
      `${fixture.relCourseDir}/lessons/02-voorbeeld-los.json: voorbeeld-los`,
    ]);
  });

  test('a voorbeeld- course in the fixtures is allowed', (t) => {
    const fixture = fixtureRoot(t);
    fixture.copyCourseTo('voorbeeld-cursus');
    assert.deepEqual(sampleIdsInRealContent(fixture.root), []);
  });
});
