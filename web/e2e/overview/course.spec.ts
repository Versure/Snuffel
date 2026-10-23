import { expect, test } from '../fixtures';
import { loginAsNewChild } from '../support/accounts';
import {
  childWithProgress,
  laterTitle,
  lessonRow,
  logout,
  openAs,
  proeflesTitle,
  startedProefles,
  wholeProefles,
} from './pages';
import { checkbox } from '../lesson/actions';
import { fixtureLesson, openLesson } from '../lesson/fixture';
import type { PracticeStep } from '../../src/app/core/content/content.types';

const practice = fixtureLesson.steps.find(
  (step): step is PracticeStep => step.type === 'practice',
)!;

test.describe('the course overview', () => {
  test('the course overview shows Ted, the goal and every lesson with its status', async ({
    page,
  }) => {
    await loginAsNewChild(page, '/leren/proefcursus');
    await expect(page).toHaveTitle('Proefcursus · Snuffel');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Proefcursus');
    await expect(page.locator('.greeting')).toContainText(
      'Dit is een proefcursus. Hier test ik alles uit!',
    );
    await expect(page.locator('.greeting snf-ted svg')).toBeVisible();
    await expect(page.locator('.goal')).toContainText(
      'Doel: Elk onderdeel van het inhoudsformaat één keer laten zien',
    );
    await expect(page.locator('.goal')).toContainText(
      'Gelukt als: De proefles laadt en elke check slaagt',
    );
    const bar = page.getByRole('progressbar');
    await expect(bar).toHaveAttribute('aria-valuetext', '0 van 2 lessen klaar');
    await expect(page.getByRole('link', { name: 'Naar de start' })).toHaveAttribute('href', '/');

    const items = page.locator('ol.lessons > li');
    await expect(items).toHaveCount(2);
    await expect(items.nth(0)).toContainText(proeflesTitle);
    await expect(items.nth(0)).toContainText('Ongeveer');
    await expect(items.nth(0)).toContainText('minuten');
    await expect(items.nth(0).locator('.label')).toHaveText('Nieuw');
    await expect(items.nth(1)).toContainText(laterTitle);
    await expect(items.nth(1).locator('.label')).toHaveText('Komt nog');
    await expect(items.nth(0).locator('.number')).toHaveText('1');
    // A list for every browser (also Safari, despite list-style: none), with the number heard.
    const list = page.getByRole('list').filter({ has: page.locator('snf-lesson-item') });
    await expect(list.getByRole('listitem')).toHaveCount(2);
    await expect(
      list.getByRole('listitem').nth(0).getByText('Les 1', { exact: true }),
    ).toBeAttached();
    await expect(
      list.getByRole('listitem').nth(1).getByText('Les 2', { exact: true }),
    ).toBeAttached();
    await expect(items.nth(1).locator('.number')).toHaveText('2');
  });

  test('each of two children sees only its own lesson statuses', async ({ page }) => {
    const childA = await childWithProgress(wholeProefles);
    const childB = await childWithProgress(startedProefles);

    await openAs(page, childA.username, '/leren/proefcursus');
    await expect(lessonRow(page, proeflesTitle).locator('.label')).toHaveText('Klaar ✓');
    await expect(lessonRow(page, proeflesTitle).locator('.label')).toHaveClass(/label--completed/);
    await expect(page.getByRole('progressbar')).toHaveAttribute(
      'aria-valuetext',
      '1 van 2 lessen klaar',
    );
    // The planned lesson is not finished, but there is nothing to go on with.
    await expect(page.locator('.all-done')).toContainText('Alles klaar! Goed gesnuffeld.');
    await expect(page.locator('.next')).toHaveCount(0);
    await expect(page.getByText('Verder met')).toHaveCount(0);

    await logout(page);
    await openAs(page, childB.username, '/leren/proefcursus');
    await expect(lessonRow(page, proeflesTitle).locator('.label')).toHaveText(
      'Bezig: 1 van 4 stappen klaar',
    );
    await expect(lessonRow(page, proeflesTitle).locator('.label')).toHaveClass(/label--started/);
    await expect(page.locator('.next')).toHaveText(`Verder met: ${proeflesTitle}`);
    await expect(page.locator('.all-done')).toHaveCount(0);
    await expect(page.getByRole('progressbar')).toHaveAttribute(
      'aria-valuetext',
      '0 van 2 lessen klaar',
    );
  });

  test('a new child sees Nieuw and Begin met', async ({ page }) => {
    await loginAsNewChild(page, '/leren/proefcursus');
    await expect(lessonRow(page, proeflesTitle).locator('.label')).toHaveClass(/label--new/);
    await expect(lessonRow(page, proeflesTitle).locator('.label')).toHaveText('Nieuw');
    const next = page.locator('.next');
    await expect(next).toHaveText(`Begin met: ${proeflesTitle}`);
    await next.click();
    await expect(page).toHaveURL(/\/leren\/proefcursus\/proefles$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(proeflesTitle);
  });

  test('a planned lesson says Komt nog and is no link', async ({ page }) => {
    await loginAsNewChild(page, '/leren/proefcursus');
    const row = lessonRow(page, laterTitle);
    await expect(row.locator('.label')).toHaveText('Komt nog');
    await expect(row.locator('.label')).toHaveClass(/label--planned/);
    await expect(row.getByRole('link')).toHaveCount(0);
    await expect(page.getByRole('link', { name: laterTitle })).toHaveCount(0);
    await expect(page.getByRole('link', { name: proeflesTitle, exact: true })).toHaveAttribute(
      'href',
      '/leren/proefcursus/proefles',
    );
  });

  test('ticking every item in the lesson shows the lesson as started in the overview', async ({
    page,
  }) => {
    await openLesson(page);
    for (const item of practice.items) await checkbox(page, item.id).check();
    for (const item of practice.items) await expect(checkbox(page, item.id)).toBeChecked();
    await page.waitForLoadState('networkidle');
    await page.getByRole('link', { name: 'Naar de lessen' }).first().click();
    await expect(page).toHaveURL(/\/leren\/proefcursus$/);
    await expect(lessonRow(page, proeflesTitle).locator('.label')).toHaveText(
      'Bezig: 1 van 4 stappen klaar',
    );
    await expect(page.locator('.next')).toHaveText(`Verder met: ${proeflesTitle}`);
  });

  test('the lesson links back to the course overview', async ({ page }) => {
    await openLesson(page);
    const back = page.getByRole('link', { name: 'Naar de lessen' }).first();
    await expect(back).toHaveAttribute('href', '/leren/proefcursus');
    await back.click();
    await expect(page).toHaveURL(/\/leren\/proefcursus$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Proefcursus');
  });

  test('an unknown course shows Ted oops', async ({ page }) => {
    await loginAsNewChild(page, '/leren/bestaat-niet');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Leertraject niet gevonden');
    await expect(page.getByText('Dit leertraject kan ik niet vinden.')).toBeVisible();
    await expect(page).toHaveTitle('Leertraject niet gevonden · Snuffel');
    await page.getByRole('link', { name: 'Naar de start' }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test('the practice course shows its subject and school level', async ({ page }) => {
    await loginAsNewChild(page, '/leren/proefhuiswerk');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Proefhuiswerk');
    await expect(page.locator('.practice')).toHaveText(
      'Rekenen · groep 7-8 · Hoofdstuk 0: breuken (testdata)',
    );
    await expect(page.locator('.greeting')).toContainText(
      'Dit is proefhuiswerk. Hier test ik de oefeningen uit!',
    );
    await expect(lessonRow(page, 'Proefles: breuken optellen').locator('.label')).toHaveText(
      'Nieuw',
    );
  });
});
