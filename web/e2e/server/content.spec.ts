import { createHash } from 'node:crypto';
import type { ContentManifest } from '../../src/app/core/content/content.types';
import { expect, test } from '../fixtures';

// The built content as served by PocketBase (the e2e server and the container). No assumption
// about fixtures: the e2e build has them, the image does not.
const hashOf = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex').slice(0, 16);

test.describe('content served by PocketBase', () => {
  test('serves the manifest as JSON with schemaVersion 1', async ({ request }) => {
    const response = await request.get('/content/manifest.json');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/json');
    const manifest = (await response.json()) as ContentManifest;
    expect(manifest.schemaVersion).toBe(1);
    expect(Array.isArray(manifest.courses)).toBe(true);
  });

  test('serves every manifest file with a matching hash', async ({ request }) => {
    const manifest = (await (
      await request.get('/content/manifest.json')
    ).json()) as ContentManifest;
    const files = manifest.courses.flatMap((course) => [
      { file: course.file, hash: course.hash },
      ...course.lessons.flatMap((lesson) =>
        lesson.file && lesson.hash ? [{ file: lesson.file, hash: lesson.hash }] : [],
      ),
    ]);
    for (const { file, hash } of files) {
      const response = await request.get(`/content/${file}?v=${hash}`);
      expect(response.status(), file).toBe(200);
      expect(response.headers()['content-type'], file).toContain('application/json');
      expect(hashOf(await response.body()), file).toBe(hash);
    }
  });

  test('serves every manifest asset with a matching hash', async ({ request }) => {
    const manifest = (await (
      await request.get('/content/manifest.json')
    ).json()) as ContentManifest;
    for (const course of manifest.courses) {
      expect(Array.isArray(course.assets), course.id).toBe(true);
      for (const { path, hash } of course.assets) {
        const url = `/content/${course.id}/${path}?v=${hash}`;
        const response = await request.get(url);
        expect(response.status(), url).toBe(200);
        expect(response.headers()['content-type'], url).toContain('image/svg+xml');
        expect(hashOf(await response.body()), url).toBe(hash);
      }
    }
  });

  test('loads content without CSP violations', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript(() => {
      (window as unknown as { __violations: string[] }).__violations = [];
      document.addEventListener('securitypolicyviolation', (event) => {
        (window as unknown as { __violations: string[] }).__violations.push(
          `${event.effectiveDirective} ${event.blockedURI}`,
        );
      });
    });
    await page.goto('/login');
    const loaded = await page.evaluate(async () => {
      const manifestResponse = await fetch('/content/manifest.json', { cache: 'no-cache' });
      const manifest = (await manifestResponse.json()) as {
        courses: { file: string; hash: string; lessons: { file?: string; hash?: string }[] }[];
      };
      const urls = manifest.courses.flatMap((course) => [
        `/content/${course.file}?v=${course.hash}`,
        ...course.lessons.flatMap((lesson) =>
          lesson.file ? [`/content/${lesson.file}?v=${lesson.hash}`] : [],
        ),
      ]);
      const statuses = await Promise.all(urls.map(async (url) => (await fetch(url)).status));
      return { manifest: manifestResponse.status, statuses };
    });
    expect(loaded.manifest).toBe(200);
    expect(loaded.statuses.every((status) => status === 200)).toBe(true);
    expect(
      await page.evaluate(() => (window as unknown as { __violations: string[] }).__violations),
    ).toEqual([]);
    expect(errors).toEqual([]);
  });
});
