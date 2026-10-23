import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Page } from '@playwright/test';
import type { Course, Lesson } from '../../src/app/core/content/content.types';
import { expect } from '../fixtures';
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

/** Logs in as `username` (kind-a by default) and opens the fixture lesson, optionally at an anchor. */
export async function openLesson(page: Page, { hash = '', username = 'kind-a' } = {}) {
  await loginAs(page, username, `${lessonPath}${hash}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Proefles: aanbeet of vastzitten?',
  );
}

/** Whitespace collapsed to single spaces. */
export function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}
