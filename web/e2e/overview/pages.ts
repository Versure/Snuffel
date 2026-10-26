import type { Locator, Page } from '@playwright/test';
import { expect } from '../fixtures';
import { createChild, currentBaseURL, type TestAccount } from '../support/accounts';
import { loginAs } from '../support/login';
import { storeStepStatuses, type StepRecord } from '../support/progress';

export const lessonSteps = ['uitleg', 'spel', 'quiz', 'zelf-doen'] as const;

/** Every step of `proefles` completed. */
export const wholeProefles: readonly StepRecord[] = lessonSteps.map((stepId) => ({
  courseId: 'proefcursus',
  lessonId: 'proefles',
  stepId,
  status: 'completed',
}));

/** One step of `proefles` completed, three not touched: the lesson is started. */
export const startedProefles: readonly StepRecord[] = [
  { courseId: 'proefcursus', lessonId: 'proefles', stepId: 'uitleg', status: 'completed' },
];

/** One step of `proefles-breuken` started. */
export const startedBreuken: readonly StepRecord[] = [
  {
    courseId: 'proefhuiswerk',
    lessonId: 'proefles-breuken',
    stepId: 'uitleg',
    status: 'started',
  },
];

/** Every step of `proefles-breuken` completed: all of Proefhuiswerk is done. */
export const wholeBreuken: readonly StepRecord[] = (
  ['uitleg', 'oefenen', 'quiz', 'zelf-doen'] as const
).map((stepId) => ({
  courseId: 'proefhuiswerk',
  lessonId: 'proefles-breuken',
  stepId,
  status: 'completed',
}));

/** A new child with the given progress, stored through the REST API as that child. */
export async function childWithProgress(records: readonly StepRecord[]): Promise<TestAccount> {
  const baseURL = currentBaseURL();
  const account = await createChild(baseURL);
  if (records.length > 0) await storeStepStatuses(baseURL, account, records);
  return account;
}

/** Logs in as `username` and lands on `path`; waits until the page is no longer loading. */
export async function openAs(page: Page, username: string, path: string): Promise<void> {
  await loginAs(page, username, path);
  await expect(page.locator('main')).not.toHaveAttribute('aria-busy', 'true');
}

export async function logout(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Uitloggen' }).click();
  await expect(page).toHaveURL(/\/login/);
}

/** The card of a course on the start page. */
export function card(page: Page, title: string): Locator {
  return page
    .locator('snf-course-card')
    .filter({ has: page.getByRole('heading', { name: title, exact: true }) });
}

/** The row of a lesson in the course overview. */
export function lessonRow(page: Page, title: string): Locator {
  return page.locator('snf-lesson-item').filter({ hasText: title });
}

export const proeflesTitle = 'Proefles: aanbeet of vastzitten?';
export const laterTitle = 'Proefles: een les die nog komt';

/** Presses Tab until `target` has the focus (at most `max` times). */
export async function tabTo(page: Page, target: Locator, max = 12): Promise<void> {
  for (let presses = 0; presses < max; presses += 1) {
    await page.keyboard.press('Tab');
    if (await target.evaluate((element) => element === document.activeElement)) break;
  }
  await expect(target).toBeFocused();
}
