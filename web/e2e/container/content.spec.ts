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
