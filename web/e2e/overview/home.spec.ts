import { expect, test } from '../fixtures';
import { loginAsNewChild } from '../support/accounts';
import {
  card,
  childWithProgress,
  logout,
  openAs,
  startedBreuken,
  startedProefles,
  wholeProefles,
} from './pages';

/** The progress bar of a card: what a screen reader hears and how full it is. */
async function expectCard(
  page: Parameters<typeof card>[0],
  title: string,
  text: string,
  now: number,
): Promise<void> {
  const target = card(page, title);
  await expect(target).toContainText(text);
  const bar = target.getByRole('progressbar');
  await expect(bar).toHaveAttribute('aria-valuenow', String(now));
  await expect(bar).toHaveAttribute('aria-valuetext', text);
}

test.describe('the start page', () => {
  test('Ted greets the child by name on the start page', async ({ page }) => {
    await openAs(page, 'kind-a', '/');
    await expect(page).toHaveTitle(/Snuffel/);
    await expect(page.locator('.greeting')).toHaveText('Hoi, Kind A!');
    await expect(page.getByText('Waar gaan we vandaag op snuffelen?')).toBeVisible();
    await expect(page.locator('snf-ted-says snf-ted svg').first()).toBeVisible();
  });

  test('the start page shows the courses and the practice courses with a progress bar', async ({
    page,
  }) => {
    await loginAsNewChild(page, '/');
    await expect(page.getByRole('heading', { level: 2 })).toHaveText([
      'Leertrajecten',
      'Huiswerk oefenen',
    ]);
    const courses = page.getByRole('region', { name: 'Leertrajecten' });
    const practice = page.getByRole('region', { name: 'Huiswerk oefenen' });
    await expect(courses.locator('snf-course-card')).toHaveCount(1);
    await expect(practice.locator('snf-course-card')).toHaveCount(1);
    await expect(courses.getByRole('heading', { level: 3 })).toHaveText('Proefcursus');
    await expect(practice.getByRole('heading', { level: 3 })).toHaveText('Proefhuiswerk');
    await expectCard(page, 'Proefcursus', '0 van 2 lessen klaar', 0);
    await expectCard(page, 'Proefhuiswerk', '0 van 1 lessen klaar', 0);
    for (const bar of await page.getByRole('progressbar').all()) {
      await expect(bar).toHaveAttribute('aria-valuemin', '0');
      await expect(bar).toHaveAccessibleName(/lessen klaar/);
    }
  });

  test('each of two children sees only its own progress on the start page', async ({ page }) => {
    const childA = await childWithProgress(wholeProefles);
    const childB = await childWithProgress(startedBreuken);

    await openAs(page, childA.username, '/');
    await expectCard(page, 'Proefcursus', '1 van 2 lessen klaar', 1);
    await expectCard(page, 'Proefhuiswerk', '0 van 1 lessen klaar', 0);
    await expect(page.getByText('Alle lessen klaar!')).toHaveCount(0);

    await logout(page);
    await openAs(page, childB.username, '/');
    await expectCard(page, 'Proefcursus', '0 van 2 lessen klaar', 0);
    // A started lesson is not a completed one.
    await expectCard(page, 'Proefhuiswerk', '0 van 1 lessen klaar', 0);
  });

  test("after logging out and in as another child the start page shows only that child's progress", async ({
    page,
  }) => {
    const childA = await childWithProgress(wholeProefles);
    const childB = await childWithProgress([]);

    await openAs(page, childA.username, '/');
    await expectCard(page, 'Proefcursus', '1 van 2 lessen klaar', 1);
    await logout(page);

    // Log in as the other child in the same tab, without a reload in between.
    await page.getByLabel('Gebruikersnaam').fill(childB.username);
    await page.getByLabel('Wachtwoord').fill('snuffel-test');
    await page.getByRole('button', { name: 'Inloggen' }).click();
    await expect(page.locator('.greeting')).toHaveText('Hoi, Testkind!');
    await expect(page.locator('main')).not.toHaveAttribute('aria-busy', 'true');
    await expectCard(page, 'Proefcursus', '0 van 2 lessen klaar', 0);

    // And back: child A still has its own.
    await logout(page);
    await page.getByLabel('Gebruikersnaam').fill(childA.username);
    await page.getByLabel('Wachtwoord').fill('snuffel-test');
    await page.getByRole('button', { name: 'Inloggen' }).click();
    await expectCard(page, 'Proefcursus', '1 van 2 lessen klaar', 1);
  });

  test('the parent sees only its own progress on the start page', async ({ page }) => {
    // The children have progress, and the rules let the parent read it: only the filter on
    // `user` keeps it out of the parent's start page.
    await childWithProgress(wholeProefles);
    await childWithProgress([...startedBreuken]);
    await openAs(page, 'ouder', '/');
    await expect(page.locator('.greeting')).toHaveText('Hoi, Ouder!');
    await expectCard(page, 'Proefcursus', '0 van 2 lessen klaar', 0);
    await expectCard(page, 'Proefhuiswerk', '0 van 1 lessen klaar', 0);
  });

  test('a card opens the course overview', async ({ page }) => {
    await loginAsNewChild(page, '/');
    await card(page, 'Proefcursus').click();
    await expect(page).toHaveURL(/\/leren\/proefcursus$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Proefcursus');
    await expect(page).toHaveTitle('Proefcursus · Snuffel');
  });

  test('progress that cannot be loaded shows a message and a retry', async ({ page }) => {
    const pattern = '**/api/collections/lesson_progress/records**';
    await page.route(pattern, (route) => route.fulfill({ status: 503, body: '{}' }));
    await childWithProgress(startedProefles).then(async (account) => {
      await openAs(page, account.username, '/');
    });
    const error = page.locator('.progress-error');
    await expect(error).toContainText('Je voortgang kan ik nu niet ophalen.');
    // The cards are there, without a bar and without "van … lessen klaar".
    await expect(page.locator('snf-course-card')).toHaveCount(2);
    await expect(page.getByRole('progressbar')).toHaveCount(0);
    await expect(page.getByText(/lessen klaar/)).toHaveCount(0);

    await page.unroute(pattern);
    await error.getByRole('button', { name: 'Opnieuw' }).click();
    await expect(error).toHaveCount(0);
    await expectCard(page, 'Proefcursus', '0 van 2 lessen klaar', 0);
  });

  test('content that cannot be loaded shows a retry', async ({ page }) => {
    const pattern = '**/content/manifest.json*';
    await page.route(pattern, (route) => route.fulfill({ status: 503, body: 'nee' }));
    await loginAsNewChild(page, '/');
    await expect(page.getByText('Snuffel kan de leertrajecten nu niet laden.')).toBeVisible();
    await expect(page.locator('snf-course-card')).toHaveCount(0);
    await page.unroute(pattern);
    await page.getByRole('button', { name: 'Opnieuw' }).click();
    await expect(page.locator('snf-course-card')).toHaveCount(2);
    await expect(page.getByText('Snuffel kan de leertrajecten nu niet laden.')).toHaveCount(0);
  });

  test('without courses Ted says there is nothing yet', async ({ page }) => {
    await page.route('**/content/manifest.json*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ schemaVersion: 1, courses: [] }),
      }),
    );
    await loginAsNewChild(page, '/');
    await expect(
      page.getByText('Er staan nog geen leertrajecten klaar. Ted is nog aan het snuffelen.'),
    ).toBeVisible();
    await expect(page.locator('snf-course-card')).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 2 })).toHaveCount(0);
  });
});
