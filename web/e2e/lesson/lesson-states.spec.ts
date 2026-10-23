import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures';
import { loginAsNewChild } from '../support/accounts';
import { testPassword } from '../support/login';
import { fixtureCourse, fixtureLesson, lessonPath, openLesson } from './fixture';

const lessonTitle = 'Proefles: aanbeet of vastzitten?';

function bubble(page: Page) {
  return page.locator('main snf-speech-bubble').first();
}

function backToStart(page: Page) {
  return page.locator('main').getByRole('link', { name: 'Naar de start' });
}

test.describe('who may read a lesson', () => {
  test('without a session the lesson goes to /login and back after logging in', async ({
    page,
  }) => {
    await page.goto(lessonPath);
    await expect(page).toHaveURL(/\/login\?terug=%2Fleren%2Fproefcursus%2Fproefles$/);
    await page.getByLabel('Gebruikersnaam').fill('kind-b');
    await page.getByLabel('Wachtwoord').fill(testPassword);
    await page.getByRole('button', { name: 'Inloggen' }).click();
    await expect(page).toHaveURL(new RegExp(`${lessonPath}$`));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(lessonTitle);
  });

  test('a child can read the lesson', async ({ page }) => {
    await openLesson(page);
    await expect(page.locator('snf-lesson-step')).toHaveCount(fixtureLesson.steps.length);
  });

  test('the parent can read the lesson', async ({ page }) => {
    await openLesson(page, { username: 'ouder' });
    await expect(page.locator('snf-lesson-step')).toHaveCount(fixtureLesson.steps.length);
  });

  test('the page title is the lesson title', async ({ page }) => {
    await openLesson(page);
    await expect(page).toHaveTitle(`${lessonTitle} · Snuffel`);
  });
});

test.describe('when a lesson cannot be shown', () => {
  test('an unknown lesson shows Ted oops', async ({ page }) => {
    await loginAsNewChild(page, '/leren/proefcursus/bestaat-niet');
    await expect(bubble(page)).toHaveText('Deze les kan ik niet vinden.');
    await expect(page.locator('main snf-ted svg')).toHaveCSS('--m-mond-oeps', 'inline');
    await expect(page).toHaveTitle('Les niet gevonden · Snuffel');
    await expect(backToStart(page)).toHaveAttribute('href', '/');
  });

  test('an unknown course shows Ted oops', async ({ page }) => {
    await loginAsNewChild(page, '/leren/bestaat-niet/proefles');
    await expect(bubble(page)).toHaveText('Deze les kan ik niet vinden.');
    await expect(page).toHaveTitle('Les niet gevonden · Snuffel');
    await backToStart(page).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test('a planned lesson says it is coming', async ({ page }) => {
    const planned = fixtureCourse.lessons.find((entry) => entry.status === 'planned')!;
    await loginAsNewChild(page, `/leren/proefcursus/${planned.id}`);
    await expect(bubble(page)).toHaveText('Aan deze les wordt nog gewerkt. Hij komt eraan!');
    await expect(page.locator('main snf-ted svg')).toHaveCSS('--m-mond-denk', 'inline');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(planned.title);
    await expect(backToStart(page)).toBeVisible();
  });

  test('a server error shows a retry button that loads the lesson', async ({ page }) => {
    await page.route('**/content/proefcursus/lessons/**', (route) =>
      route.fulfill({ status: 503, body: 'Service Unavailable' }),
    );
    await loginAsNewChild(page, lessonPath);
    await expect(bubble(page)).toHaveText('Snuffel kan de les nu niet laden.');
    await expect(backToStart(page)).toBeVisible();

    await page.unroute('**/content/proefcursus/lessons/**');
    await page.getByRole('button', { name: 'Opnieuw' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(lessonTitle);
    await expect(page.getByRole('button', { name: 'Opnieuw' })).toHaveCount(0);
  });
});
