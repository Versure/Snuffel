import AxeBuilder from '@axe-core/playwright';
import type { APIRequestContext, Page } from '@playwright/test';
import type { ContentManifest, Lesson } from '../../src/app/core/content/content.types';
import { plainText } from '../../src/app/shared/inline-text/inline-markup';
import { expect, test } from '../fixtures';
import { loginAs } from '../support/login';

// Every published lesson in the served manifest (the e2e build has the fixtures, so this covers
// the proefles and every lesson that snuffel-leren makes, also the sample lesson).

interface PublishedLesson {
  path: string;
  lesson: Lesson;
}

async function publishedLessons(request: APIRequestContext): Promise<PublishedLesson[]> {
  const manifest = (await (await request.get('/content/manifest.json')).json()) as ContentManifest;
  const result: PublishedLesson[] = [];
  for (const course of manifest.courses) {
    for (const entry of course.lessons) {
      if (entry.status !== 'published' || !entry.file) continue;
      const response = await request.get(`/content/${entry.file}?v=${entry.hash}`);
      expect(response.ok(), entry.file).toBe(true);
      result.push({
        path: `/leren/${course.id}/${entry.id}`,
        lesson: (await response.json()) as Lesson,
      });
    }
  }
  expect(result.length).toBeGreaterThan(0);
  return result;
}

/** The lesson page shows the lesson and none of the error states. */
async function expectLessonShown(page: Page, { path, lesson }: PublishedLesson): Promise<void> {
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
  test('every published lesson in the manifest opens with its title and steps', async ({
    page,
    request,
  }) => {
    const lessons = await publishedLessons(request);
    let first = true;
    for (const published of lessons) {
      if (first) {
        await loginAs(page, 'kind-a', published.path);
        first = false;
      } else {
        await page.goto(published.path);
      }
      await expectLessonShown(page, published);
      const headings = page.locator('snf-lesson-step h2');
      await expect(headings, published.path).toHaveCount(published.lesson.steps.length);
      for (const [index, step] of published.lesson.steps.entries()) {
        await expect(headings.nth(index), `${published.path} ${step.id}`).toContainText(
          plainText(step.title).trim(),
        );
      }
    }
  });

  test('every published lesson has no axe violations', async ({ page, request }) => {
    const lessons = await publishedLessons(request);
    let first = true;
    for (const published of lessons) {
      if (first) {
        await loginAs(page, 'kind-a', published.path);
        first = false;
      } else {
        await page.goto(published.path);
      }
      await expectLessonShown(page, published);
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations, published.path).toEqual([]);
    }
  });
});
