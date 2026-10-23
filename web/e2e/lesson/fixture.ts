import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Page } from '@playwright/test';
import type { Course, Lesson } from '../../src/app/core/content/content.types';
import { expect } from '../fixtures';
import { loginAsNewChild, type TestAccount } from '../support/accounts';
import { loginAs } from '../support/login';

// The fixture lesson, read from disk: the e2e build has it (pree2e builds with --fixtures).
const courseDir = resolve(
  __dirname,
  '..',
  '..',
  '..',
  'content',
  'fixtures',
  'courses',
  'proefcursus',
);

export const fixtureCourse = JSON.parse(
  readFileSync(resolve(courseDir, 'course.json'), 'utf8'),
) as Course;
export const fixtureLesson = JSON.parse(
  readFileSync(resolve(courseDir, 'lessons', '01-proefles.json'), 'utf8'),
) as Lesson;

export const lessonPath = '/leren/proefcursus/proefles';

/**
 * Logs in and opens the fixture lesson, optionally at an anchor. By default as a new child of its
 * own (reading and clicking store progress, so tests never share an account); with `username` as
 * that seeded account. Returns the account when it is a new one.
 */
export async function openLesson(
  page: Page,
  { hash = '', username }: { hash?: string; username?: string } = {},
): Promise<TestAccount | null> {
  let account: TestAccount | null = null;
  if (username) await loginAs(page, username, `${lessonPath}${hash}`);
  else account = await loginAsNewChild(page, `${lessonPath}${hash}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Proefles: aanbeet of vastzitten?',
  );
  return account;
}

/** Whitespace collapsed to single spaces. */
export function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

// The practice fixture course with the stepped exercise (breuken optellen).
const exerciseDir = resolve(
  __dirname,
  '..',
  '..',
  '..',
  'content',
  'fixtures',
  'courses',
  'proefhuiswerk',
);

export const exerciseCourse = JSON.parse(
  readFileSync(resolve(exerciseDir, 'course.json'), 'utf8'),
) as Course;
export const exerciseLesson = JSON.parse(
  readFileSync(resolve(exerciseDir, 'lessons', '01-proefles-breuken.json'), 'utf8'),
) as Lesson;

export const exerciseLessonPath = '/leren/proefhuiswerk/proefles-breuken';

/** Like `openLesson`, for the exercise lesson: a new child, optionally at an anchor. */
export async function openExerciseLesson(
  page: Page,
  { hash = '' }: { hash?: string } = {},
): Promise<TestAccount> {
  const account = await loginAsNewChild(page, `${exerciseLessonPath}${hash}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Proefles: breuken optellen');
  return account;
}

/**
 * Waits until the lesson page has followed the anchor (`#stap-<id>`). It does that once the page
 * is stable (lazy parts loaded, progress restored) and then moves the focus to the step heading;
 * a test that starts typing before that would have its focus taken away.
 */
export async function waitForStepAnchor(page: Page, hash: string): Promise<void> {
  if (!hash.startsWith('#stap-')) return;
  await expect(page.locator(`${hash}-titel`)).toBeFocused();
}
