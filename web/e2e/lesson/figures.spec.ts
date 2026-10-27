import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Page } from '@playwright/test';
import type { Course, FigureBlock, Lesson } from '../../src/app/core/content/content.types';
import { expect, test } from '../fixtures';
import { loginAsNewChild } from '../support/accounts';

// M16: the figures in the course blind-typen (svg in a figure block, on the cream card).

const courseDir = resolve(__dirname, '..', '..', '..', 'content', 'courses', 'blind-typen');
const course = JSON.parse(readFileSync(resolve(courseDir, 'course.json'), 'utf8')) as Course;

function lesson(id: string): Lesson {
  const entry = course.lessons.find((candidate) => candidate.id === id);
  return JSON.parse(readFileSync(resolve(courseDir, entry!.file!), 'utf8')) as Lesson;
}

function figures(data: Lesson): FigureBlock[] {
  return data.steps.flatMap((step) =>
    step.type === 'explain'
      ? step.blocks.filter((block): block is FigureBlock => block.type === 'figure')
      : [],
  );
}

const firstLesson = lesson('thuisrij');

async function openCourseLesson(page: Page, id: string): Promise<void> {
  await loginAsNewChild(page, `/leren/blind-typen/${id}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(lesson(id).title);
}

/** The figures on the page, after every image has loaded (lazy images are scrolled to). */
async function loadedImages(page: Page) {
  const images = page.locator('snf-figure-block img');
  const count = await images.count();
  for (let index = 0; index < count; index += 1) {
    const image = images.nth(index);
    await image.scrollIntoViewIfNeeded();
    await expect
      .poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth))
      .toBeGreaterThan(0);
  }
  return images;
}

async function expectNoViolations(page: Page, label: string): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations, label).toEqual([]);
}

test.describe('figures in blind-typen', () => {
  test('lesson 1 shows every figure with its alt text', async ({ page }) => {
    await openCourseLesson(page, 'thuisrij');
    const expected = figures(firstLesson);
    expect(expected.length).toBeGreaterThanOrEqual(2);
    const images = await loadedImages(page);
    await expect(images).toHaveCount(expected.length);
    for (const [index, figure] of expected.entries()) {
      await expect(images.nth(index)).toHaveAttribute('alt', figure.alt);
      await expect(images.nth(index)).toHaveAttribute(
        'src',
        new RegExp(`^/content/blind-typen/${figure.src.replace(/\./g, '\\.')}\\?v=[0-9a-f]{16}$`),
      );
    }
    // The home row with the finger colours and the hands with the bumps on F and J.
    expect(expected.map((figure) => figure.src)).toEqual(
      expect.arrayContaining(['assets/toetsen-thuisrij.svg', 'assets/handen-thuisrij.svg']),
    );
  });

  test('lesson 3 shows the keyboard with the new keys g and h', async ({ page }) => {
    await openCourseLesson(page, 'g-en-h');
    const images = await loadedImages(page);
    const keyboard = images.and(page.locator('img[src*="toetsen-g-en-h.svg"]'));
    await expect(keyboard).toHaveCount(1);
    await expect(keyboard).toHaveAttribute('alt', /de G naast de F en de H naast de J/);
  });

  test('every figure of the course is served and is an svg', async ({ request }) => {
    const sources = new Set(
      course.lessons.flatMap((entry) => figures(lesson(entry.id)).map((figure) => figure.src)),
    );
    expect(sources.size).toBeGreaterThanOrEqual(course.lessons.length);
    for (const src of sources) {
      const response = await request.get(`/content/blind-typen/${src}`);
      expect(response.ok(), src).toBe(true);
      expect(await response.text(), src).toMatch(/^<svg [^>]*viewBox="0 0 400 \d+"/);
    }
  });

  test('lesson 1 with figures has no axe violations (light)', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await openCourseLesson(page, 'thuisrij');
    await loadedImages(page);
    await expectNoViolations(page, 'light');
  });

  test('lesson 1 with figures has no axe violations (dark)', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await openCourseLesson(page, 'thuisrij');
    await loadedImages(page);
    await expectNoViolations(page, 'dark');
  });

  test('a figure stays on the cream card in dark mode', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await openCourseLesson(page, 'thuisrij');
    const frame = page.locator('snf-figure-block .frame').first();
    await expect(frame).toHaveCSS('background-color', 'rgb(255, 246, 220)');
    const body = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(body).not.toBe('rgb(255, 246, 220)');
  });

  test('the figures fit the page without horizontal scrolling', async ({ page }) => {
    await openCourseLesson(page, 'thuisrij');
    const images = await loadedImages(page);
    const overflow = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    }));
    expect(overflow.scroll).toBeLessThanOrEqual(overflow.client);
    const width = await page.evaluate(() => window.innerWidth);
    for (let index = 0; index < (await images.count()); index += 1) {
      const box = await images.nth(index).boundingBox();
      expect(box, `image ${index}`).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    }
  });
});
