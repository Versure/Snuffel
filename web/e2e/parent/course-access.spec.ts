import AxeBuilder from '@axe-core/playwright';
import type { Locator, Page } from '@playwright/test';
import { expect, test } from '../fixtures';
import { createChild, currentBaseURL, uniqueName, type TestAccount } from '../support/accounts';
import { servedCourses } from '../support/courses';
import { storeStepStatuses } from '../support/progress';
import { card, logout, openAs } from '../overview/pages';
import { childLesson, openAsParent, openChildPage } from './pages';

// A course for selected children only (fixture `proefgekozen`, access selected-children) next to
// one for every child (`proefcursus`): the parent chooses on /ouder who sees it, a child that is
// not chosen sees it nowhere, also not through a direct link.

const chosenId = 'proefgekozen';
const chosenTitle = 'Proefcursus: gekozen kinderen';
const chosenLessonId = 'proefles-gekozen';
const chosenLessonTitle = 'Proefles: alleen voor gekozen kinderen';
const chosenPath = `/leren/${chosenId}`;
const chosenLessonPath = `${chosenPath}/${chosenLessonId}`;

/** The group of checkboxes of the chosen course on /ouder. */
function chosenGroup(page: Page): Locator {
  return page.getByRole('group', { name: chosenTitle, exact: true });
}

/** The checkbox of `child` at the chosen course on /ouder. */
function checkboxOf(page: Page, child: TestAccount): Locator {
  return chosenGroup(page).getByRole('checkbox', { name: child.name, exact: true });
}

function status(page: Page): Locator {
  return page.locator('snf-course-access [aria-live="polite"]');
}

/** The text of the "not found" page: the heading and Ted. */
async function notFoundText(page: Page): Promise<{ heading: string; ted: string }> {
  await expect(page.locator('main')).not.toHaveAttribute('aria-busy', 'true');
  return {
    heading: (await page.getByRole('heading', { level: 1 }).innerText()).trim(),
    ted: (await page.locator('main snf-ted-says').first().innerText()).replace(/\s+/g, ' ').trim(),
  };
}

/** Every request for a file of the chosen course, from now on. */
function chosenContentRequests(page: Page): string[] {
  const requests: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith(`/content/${chosenId}/`)) {
      requests.push(request.url());
    }
  });
  return requests;
}

/** Two new children with unique names; `assigned` get the chosen course. */
async function twoChildren(assigned: 'none' | 'a' = 'none') {
  const baseURL = currentBaseURL();
  const a = await createChild(baseURL, {
    name: uniqueName('A'),
    courses: assigned === 'a' ? [chosenId] : [],
  });
  const b = await createChild(baseURL, { name: uniqueName('B') });
  return { a, b };
}

test.describe('who sees a course', () => {
  test('the parent ticks child A: A sees and opens the course, B finds it nowhere', async ({
    page,
  }) => {
    const { a, b } = await twoChildren();
    await openAsParent(page, '/ouder');
    await expect(page.getByRole('heading', { name: 'Wie ziet welke cursus?' })).toBeVisible();
    await expect(checkboxOf(page, a)).not.toBeChecked();
    await checkboxOf(page, a).check();
    await expect(status(page)).toHaveText(`${a.name} ziet nu ${chosenTitle}.`);
    await expect(checkboxOf(page, a)).toBeChecked();
    await expect(checkboxOf(page, b)).not.toBeChecked();
    // Stored: after a reload the box is still ticked.
    await page.reload();
    await expect(checkboxOf(page, a)).toBeChecked();
    await logout(page);

    // A sees the card and opens the lesson.
    await openAs(page, a.username, '/');
    await card(page, chosenTitle).click();
    await expect(page).toHaveURL(new RegExp(`${chosenPath}$`));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(chosenTitle);
    await page.getByRole('link', { name: `Begin met: ${chosenLessonTitle}` }).click();
    await expect(page).toHaveURL(new RegExp(`${chosenLessonPath}$`));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(chosenLessonTitle);
    await logout(page);

    // B does not see the card, and a direct link looks like a course that does not exist.
    const requests = chosenContentRequests(page);
    await openAs(page, b.username, '/');
    await expect(card(page, 'Proefcursus')).toBeVisible();
    await expect(card(page, chosenTitle)).toHaveCount(0);

    await page.goto('/leren/bestaat-niet');
    const unknownCourse = await notFoundText(page);
    const unknownCourseTitle = await page.title();
    await page.goto(chosenPath);
    expect(await notFoundText(page)).toEqual(unknownCourse);
    expect(await page.title()).toBe(unknownCourseTitle);
    expect(unknownCourse.heading).toBe('Leertraject niet gevonden');

    await page.goto(`/leren/bestaat-niet/${chosenLessonId}`);
    const unknownLesson = await notFoundText(page);
    const unknownLessonTitle = await page.title();
    await page.goto(chosenLessonPath);
    expect(await notFoundText(page)).toEqual(unknownLesson);
    expect(await page.title()).toBe(unknownLessonTitle);
    expect(unknownLesson.ted).toBe('Deze les kan ik niet vinden.');

    expect(requests, `requests to /content/${chosenId}/`).toEqual([]);
  });

  test('the parent sees on the start page for whom the course is', async ({ page }) => {
    const { a, b } = await twoChildren('a');
    await openAsParent(page, '/');
    const sticker = card(page, chosenTitle).locator('snf-sticker');
    await expect(sticker).toContainText('Voor: ');
    await expect(sticker).toContainText(a.name);
    await expect(sticker).not.toContainText(b.name);
    // A course for every child has no sticker.
    await expect(card(page, 'Proefcursus').locator('snf-sticker')).toHaveCount(0);
  });

  test('the parent unticks A: A no longer sees the course, the progress stays', async ({
    page,
  }) => {
    const { a } = await twoChildren('a');
    await storeStepStatuses(currentBaseURL(), a, [
      { courseId: chosenId, lessonId: chosenLessonId, stepId: 'uitleg', status: 'completed' },
    ]);
    await openAs(page, a.username, '/');
    await expect(card(page, chosenTitle)).toContainText('0 van 1 lessen klaar');
    await logout(page);

    await openAsParent(page, '/ouder');
    await expect(checkboxOf(page, a)).toBeChecked();
    await checkboxOf(page, a).uncheck();
    await expect(status(page)).toHaveText(
      `${a.name} ziet ${chosenTitle} niet meer. De voortgang blijft bewaard.`,
    );
    await expect(checkboxOf(page, a)).not.toBeChecked();

    // On the page of A: the course with its progress, and that A does not see it.
    await page.goto(`/ouder/${a.id}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(a.name);
    const course = page
      .locator('section.course')
      .filter({ has: page.getByRole('heading', { name: chosenTitle, exact: true }) });
    await expect(course.locator('.hidden-for')).toHaveText(`Niet zichtbaar voor ${a.name}`);
    await expect(childLesson(page, chosenLessonTitle).locator('snf-lesson-status')).toContainText(
      'Bezig',
    );
    await logout(page);

    await openAs(page, a.username, '/');
    await expect(card(page, 'Proefcursus')).toBeVisible();
    await expect(card(page, chosenTitle)).toHaveCount(0);
    await page.goto(chosenPath);
    expect((await notFoundText(page)).heading).toBe('Leertraject niet gevonden');
  });

  test('a course for every child is seen by A and B, without checkboxes', async ({ page }) => {
    const { a, b } = await twoChildren();
    for (const child of [a, b]) {
      await openAs(page, child.username, '/');
      await expect(card(page, 'Proefcursus')).toBeVisible();
      await card(page, 'Proefcursus').click();
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Proefcursus');
      await logout(page);
    }
    await openAsParent(page, '/ouder');
    await expect(page.locator('snf-course-access .all-children')).toContainText('Proefcursus');
    await expect(page.getByRole('group', { name: 'Proefcursus', exact: true })).toHaveCount(0);
  });

  test('a save that fails sets the box back with a message', async ({ page }) => {
    const { a } = await twoChildren();
    await openAsParent(page, '/ouder');
    await expect(checkboxOf(page, a)).not.toBeChecked();
    await page.route('**/api/collections/course_assignments/records**', (route) =>
      route.request().method() === 'POST'
        ? route.fulfill({ status: 503, contentType: 'application/json', body: '{}' })
        : route.continue(),
    );
    await checkboxOf(page, a).click();
    await expect(status(page)).toHaveText('Opslaan lukt niet. Probeer het nog eens.');
    await expect(checkboxOf(page, a)).not.toBeChecked();
    await expect(checkboxOf(page, a)).toBeEnabled();

    // Nothing was stored: after a reload the box is still empty.
    await page.unroute('**/api/collections/course_assignments/records**');
    await page.reload();
    await expect(checkboxOf(page, a)).not.toBeChecked();
  });

  test('when the assignments do not load a child gets only the courses for everyone', async ({
    page,
  }) => {
    // Even a child that is chosen gets nothing extra: better too little than too much.
    const { a } = await twoChildren('a');
    await page.route('**/api/collections/course_assignments/records**', (route) =>
      route.request().method() === 'GET'
        ? route.fulfill({ status: 503, contentType: 'application/json', body: '{}' })
        : route.continue(),
    );
    const requests = chosenContentRequests(page);
    await openAs(page, a.username, '/');
    await expect(card(page, 'Proefcursus')).toBeVisible();
    await expect(card(page, chosenTitle)).toHaveCount(0);
    await expect(page.getByText('Niet alle leertrajecten kan ik nu laten zien.')).toBeVisible();

    await page.goto(chosenPath);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Leertraject laden lukt niet');
    await page.goto(chosenLessonPath);
    await expect(page.locator('main')).not.toHaveAttribute('aria-busy', 'true');
    await expect(page.getByText(chosenLessonTitle)).toHaveCount(0);
    expect(requests, `requests to /content/${chosenId}/`).toEqual([]);

    // A course for every child still opens.
    await page.goto('/leren/proefcursus');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Proefcursus');
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`/ouder with the section has no axe violations (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      const { a } = await twoChildren('a');
      await openAsParent(page, '/ouder');
      await expect(checkboxOf(page, a)).toBeChecked();
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations, `/ouder, ${scheme}`).toEqual([]);
    });
  }

  test('every checkbox label is at least 44 × 44 px and the checkbox has a focus ring', async ({
    page,
  }) => {
    const { a } = await twoChildren();
    await openAsParent(page, '/ouder');
    await expect(checkboxOf(page, a)).toBeVisible();
    const small = await page.locator('snf-course-access label').evaluateAll((labels) =>
      labels
        .map((label) => {
          const box = label.getBoundingClientRect();
          return { name: (label.textContent ?? '').trim(), width: box.width, height: box.height };
        })
        .filter((size) => size.width < 44 || size.height < 44),
    );
    expect(small).toEqual([]);
    // The whole label is the tap area: a tap on the name ticks the box.
    await chosenGroup(page).locator('label', { hasText: a.name }).locator('.name').click();
    await expect(checkboxOf(page, a)).toBeChecked();
    await expect(status(page)).toHaveText(`${a.name} ziet nu ${chosenTitle}.`);

    // Keyboard: the focused checkbox shows the focus ring.
    await checkboxOf(page, a).focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(checkboxOf(page, a)).toBeFocused();
    const ring = await page.evaluate(() => {
      const style = getComputedStyle(document.activeElement as Element);
      return { style: style.outlineStyle, width: style.outlineWidth };
    });
    expect(ring).toEqual({ style: 'solid', width: '3px' });
  });

  test('on the page of a child only the courses it does not see say "Niet zichtbaar"', async ({
    page,
  }) => {
    const { a, b } = await twoChildren('a');
    const courseOn = (title: string) =>
      page
        .locator('section.course')
        .filter({ has: page.getByRole('heading', { name: title, exact: true }) });
    const selected = servedCourses.filter((course) => course.access === 'selected-children');
    expect(selected.map((course) => course.id)).toContain(chosenId);

    await openChildPage(page, a);
    await expect(courseOn(chosenTitle)).toBeVisible();
    await expect(courseOn(chosenTitle).locator('.hidden-for')).toHaveCount(0);
    await expect(courseOn('Proefcursus').locator('.hidden-for')).toHaveCount(0);
    await expect(page.locator('.hidden-for')).toHaveCount(selected.length - 1);

    await page.goto(`/ouder/${b.id}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(b.name);
    await expect(courseOn(chosenTitle).locator('.hidden-for')).toHaveText(
      `Niet zichtbaar voor ${b.name}`,
    );
    await expect(page.locator('.hidden-for')).toHaveCount(selected.length);
  });
});
