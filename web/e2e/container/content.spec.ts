import type { ContentManifest } from '../../src/app/core/content/content.types';
import type { APIRequestContext } from '@playwright/test';
import { expect, test } from '../fixtures';

// The image is built with `npm run content:build` without --fixtures: no test lesson for a child.
test.describe('content in the image', () => {
  test('the manifest has no fixture course', async ({ request }) => {
    const response = await request.get('/content/manifest.json');
    expect(response.status()).toBe(200);
    const manifest = (await response.json()) as ContentManifest;
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.courses.map((course) => course.id)).not.toContain('proefcursus');
    expect(manifest.courses.map((course) => course.id)).not.toContain('proefhuiswerk');
  });

  test('the image has les 1 of roofvissen', async ({ request }) => {
    const manifest = (await (
      await request.get('/content/manifest.json')
    ).json()) as ContentManifest;
    const course = manifest.courses.find((candidate) => candidate.id === 'roofvissen');
    expect(course, 'course roofvissen in the manifest').toBeDefined();
    expect(course!.kind).toBe('course');
    const entry = course!.lessons.find((candidate) => candidate.id === 'aanbeet-of-vastzitten');
    expect(entry, 'lesson aanbeet-of-vastzitten').toBeDefined();
    expect(entry!.status).toBe('published');
    expect(entry!.file).toBeTruthy();
    // The lesson file loads with the hash from the manifest, and is the lesson.
    const response = await request.get(`/content/${entry!.file}?v=${entry!.hash}`);
    expect(response.status()).toBe(200);
    const lesson = (await response.json()) as { id: string; steps: { id: string }[] };
    expect(lesson.id).toBe('aanbeet-of-vastzitten');
    expect(lesson.steps.map((step) => step.id)).toEqual(['uitleg', 'spel', 'quiz', 'water']);
    // The course file is there too.
    const courseFile = await request.get('/content/roofvissen/course.json');
    expect(courseFile.status()).toBe(200);
    expect(((await courseFile.json()) as { id: string }).id).toBe('roofvissen');
  });

  for (const id of ['proefcursus', 'proefhuiswerk']) {
    test(`the fixture course file ${id} is not in the image`, async ({ request }) => {
      await expectNoCourseFile(request, id);
    });
  }
});

async function expectNoCourseFile(request: APIRequestContext, id: string): Promise<void> {
  {
    const response = await request.get(`/content/${id}/course.json`);
    // PocketBase answers unknown paths with index.html (SPA fallback) or 404; never the course.
    const text = await response.text();
    const parse = (): unknown => {
      try {
        return JSON.parse(text);
      } catch {
        return null;
      }
    };
    expect((parse() as { id?: string } | null)?.id).not.toBe(id);
  }
}
