import { createHash } from 'node:crypto';
import type { ContentManifest, Lesson } from '../src/app/core/content/content.types';
import { expect, test } from './fixtures';

// ng serve with the content built with fixtures (pree2e: content:build --fixtures).
const hashOf = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex').slice(0, 16);

test.describe('content (with fixtures)', () => {
  test('serves the manifest with the fixture course', async ({ request }) => {
    const response = await request.get('/content/manifest.json');
    expect(response.status()).toBe(200);
    const manifest = (await response.json()) as ContentManifest;
    expect(manifest.schemaVersion).toBe(1);
    const course = manifest.courses.find((candidate) => candidate.id === 'proefcursus');
    expect(course?.lessons.map(({ id, status }) => [id, status])).toEqual([
      ['proefles', 'published'],
      ['proefles-later', 'planned'],
    ]);
  });

  test('serves the fixture lesson', async ({ request }) => {
    const manifest = (await (
      await request.get('/content/manifest.json')
    ).json()) as ContentManifest;
    const entry = manifest.courses
      .find((course) => course.id === 'proefcursus')
      ?.lessons.find((lesson) => lesson.id === 'proefles');
    expect(entry?.file).toBe('proefcursus/lessons/proefles.json');

    const response = await request.get(`/content/${entry?.file}?v=${entry?.hash}`);
    expect(response.status()).toBe(200);
    const body = await response.body();
    expect(hashOf(body)).toBe(entry?.hash);
    const lesson = JSON.parse(body.toString('utf8')) as Lesson;
    expect(lesson.id).toBe('proefles');
    expect(lesson.version).toBe(entry?.version);
    expect(lesson.title).toMatch(/^Proefles:/);

    const svg = await request.get('/content/proefcursus/assets/hengeltop.svg');
    expect(svg.status()).toBe(200);
  });
});
