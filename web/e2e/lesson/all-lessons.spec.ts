import AxeBuilder from '@axe-core/playwright';
import type { APIRequestContext, Page } from '@playwright/test';
import type { ContentManifest, Lesson } from '../../src/app/core/content/content.types';
import { plainText } from '../../src/app/shared/inline-text/inline-markup';
import { expect, test } from '../fixtures';
import { loginAsNewChild } from '../support/accounts';
import { publishedLessonIds, type PublishedLessonId } from '../support/courses';

// Every published lesson in content/ (the e2e build has the fixtures, so this covers the proefles
// and every lesson that snuffel-leren makes, also the sample lesson), one test per lesson.

async function manifest(request: APIRequestContext): Promise<ContentManifest> {
  const response = await request.get('/content/manifest.json');
  expect(response.ok()).toBe(true);
  return (await response.json()) as ContentManifest;
}

/** The lesson as the app serves it, found through the served manifest. */
async function servedLesson(
  request: APIRequestContext,
  { courseId, lessonId }: PublishedLessonId,
): Promise<Lesson> {
  const course = (await manifest(request)).courses.find((candidate) => candidate.id === courseId);
  const entry = course?.lessons.find((candidate) => candidate.id === lessonId);
  expect(entry?.status, `${courseId}/${lessonId} in the manifest`).toBe('published');
  expect(entry?.file, `${courseId}/${lessonId} has a file`).toBeTruthy();
  const response = await request.get(`/content/${entry!.file}?v=${entry!.hash}`);
  expect(response.ok(), entry!.file).toBe(true);
  return (await response.json()) as Lesson;
}

/** The lesson page shows the lesson and none of the error states. */
async function expectLessonShown(page: Page, path: string, lesson: Lesson): Promise<void> {
  await expect(page.getByRole('heading', { level: 1 }), path).toHaveText(
    plainText(lesson.title).trim(),
  );
  const main = page.getByRole('main');
  for (const error of [
    'Deze les kan ik niet vinden',
    'kan de les nu niet laden',
    'nieuwere versie',
  ]) {
    await expect(main, `${path}: ${error}`).not.toContainText(error);
  }
}

test.describe('all published lessons', () => {
  test('the manifest has exactly the published lessons in content/', async ({ request }) => {
    expect(publishedLessonIds.length).toBeGreaterThan(0);
    const served = (await manifest(request)).courses.flatMap((course) =>
      course.lessons
        .filter((entry) => entry.status === 'published' && entry.file)
        .map((entry) => `${course.id}/${entry.id}`),
    );
    expect(served.sort()).toEqual(
      publishedLessonIds.map(({ courseId, lessonId }) => `${courseId}/${lessonId}`).sort(),
    );
  });

  for (const id of publishedLessonIds) {
    const path = `/leren/${id.courseId}/${id.lessonId}`;

    test(`${path} opens with its title and steps and has no axe violations`, async ({
      page,
      request,
    }) => {
      const lesson = await servedLesson(request, id);
      await loginAsNewChild(page, path);
      await expectLessonShown(page, path, lesson);
      const headings = page.locator('snf-lesson-step h2');
      await expect(headings, path).toHaveCount(lesson.steps.length);
      for (const [index, step] of lesson.steps.entries()) {
        await expect(headings.nth(index), `${path} ${step.id}`).toContainText(
          plainText(step.title).trim(),
        );
      }
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations, path).toEqual([]);
    });
  }
});
