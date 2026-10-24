import { expect, test } from '../fixtures';
import { createChild, currentBaseURL, uniqueName } from '../support/accounts';
import { loginAs } from '../support/login';
import { storeStepStatuses } from '../support/progress';
import { childWithProgress, startedProefles, wholeProefles } from '../overview/pages';
import { childCard, openAsParent, parentUsername } from './pages';

test.describe('the parent overview (/ouder)', () => {
  test('the parent sees every child with its last activity and completed lessons', async ({
    page,
  }) => {
    const baseURL = currentBaseURL();
    const done = await createChild(baseURL, { name: uniqueName('Klaar') });
    const started = await createChild(baseURL, { name: uniqueName('Bezig') });
    const idle = await createChild(baseURL, { name: uniqueName('Rustig') });
    for (const [account, records] of [
      [done, wholeProefles],
      [started, startedProefles],
    ] as const) {
      await storeStepStatuses(baseURL, account, records);
    }

    await openAsParent(page, '/ouder');
    await expect(page).toHaveTitle('Ouderoverzicht · Snuffel');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ouderoverzicht');
    await expect(page.locator('snf-ted-says.ted')).toContainText('Zo gaat het met de kinderen.');

    const doneCard = childCard(page, done.name);
    await expect(doneCard).toBeVisible();
    await expect(doneCard.locator('.last-activity')).toHaveText(
      /Laatst actief: (vandaag|gisteren) om \d{1,2}:\d{2}/,
    );
    await expect(doneCard.locator('.lessons-completed')).toHaveText('1 les klaar');

    const startedCard = childCard(page, started.name);
    await expect(startedCard.locator('.last-activity')).toHaveText(/Laatst actief: /);
    await expect(startedCard.locator('.lessons-completed')).toHaveText('0 lessen klaar');

    const idleCard = childCard(page, idle.name);
    await expect(idleCard.locator('.last-activity')).toHaveText('Nog niet actief');
    await expect(idleCard.locator('.lessons-completed')).toHaveText('0 lessen klaar');
  });

  test('the parent is not in the list of children', async ({ page }) => {
    await openAsParent(page, '/ouder');
    await expect(page.locator('snf-child-card').first()).toBeVisible();
    // The parent account has the name "Ouder" in the seed; no card may be the parent itself.
    const names = await page.locator('snf-child-card h2').allInnerTexts();
    const parentName = await page.getByRole('banner').innerText();
    expect(parentName).toContain('Ouder');
    expect(names).not.toContain('Ouder');
    // Cards are links to /ouder/<id> of a child; none is the parent's own id.
    const parentId = await page.evaluate(
      () =>
        (JSON.parse(localStorage.getItem('pocketbase_auth') ?? '{}') as { record?: { id: string } })
          .record?.id,
    );
    expect(parentId).toBeTruthy();
    const hrefs = await page
      .locator('snf-child-card a')
      .evaluateAll((links) => links.map((link) => link.getAttribute('href')));
    expect(hrefs).not.toContain(`/ouder/${parentId}`);
  });

  test('a child without activity says Nog niet actief', async ({ page }) => {
    const child = await createChild(currentBaseURL(), { name: uniqueName() });
    await openAsParent(page, '/ouder');
    const card = childCard(page, child.name);
    await expect(card.locator('.last-activity')).toHaveText('Nog niet actief');
  });

  test('a card opens the page of the child', async ({ page }) => {
    const named = await createChild(currentBaseURL(), { name: uniqueName() });
    await openAsParent(page, '/ouder');
    await childCard(page, named.name).getByRole('link').click();
    await expect(page).toHaveURL(new RegExp(`/ouder/${named.id}$`));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(named.name);
    await expect(page).toHaveTitle(`${named.name} · Ouderoverzicht · Snuffel`);
    await page.locator('a.back').click();
    await expect(page).toHaveURL(/\/ouder$/);
  });

  test('the start page of the parent links to the parent overview and a child has no such link', async ({
    page,
  }) => {
    await openAsParent(page, '/');
    const link = page.locator('a.parent-link');
    await expect(link).toHaveText('Naar het ouderoverzicht');
    await link.click();
    await expect(page).toHaveURL(/\/ouder$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ouderoverzicht');

    const child = await createChild(currentBaseURL());
    await page.getByRole('button', { name: 'Uitloggen' }).click();
    await loginAs(page, child.username, '/');
    await expect(page.getByText('Hoi, Testkind!')).toBeVisible();
    await expect(page.getByText('Naar het ouderoverzicht')).toHaveCount(0);
    await expect(page.locator('a.parent-link')).toHaveCount(0);
  });

  test('a child on /ouder or /ouder/<id> goes to the start page', async ({ page }) => {
    const child = await createChild(currentBaseURL());
    await loginAs(page, child.username, '/ouder');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText('Hoi, Testkind!')).toBeVisible();
    await page.goto(`/ouder/${child.id}`);
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText('Hoi, Testkind!')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Ouderoverzicht' })).toHaveCount(0);
  });

  test('children that cannot be loaded show a retry', async ({ page }) => {
    const child = await createChild(currentBaseURL(), { name: uniqueName() });
    const pattern = '**/api/collections/users/records**';
    await page.route(pattern, (route) => route.fulfill({ status: 503, body: '{}' }));
    await loginAs(page, parentUsername, '/ouder');
    await expect(page.getByRole('button', { name: 'Opnieuw' })).toBeVisible();
    await expect(page.locator('.state-ted')).toContainText(
      'Het ouderoverzicht kan ik nu niet laden.',
    );
    await expect(page.locator('snf-child-card')).toHaveCount(0);

    await page.unroute(pattern);
    await page.getByRole('button', { name: 'Opnieuw' }).click();
    await expect(childCard(page, child.name)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Opnieuw' })).toHaveCount(0);
  });

  test('activity that cannot be loaded shows the cards without numbers and a retry', async ({
    page,
  }) => {
    // The default name is shared by many children, so the card is found by its link.
    const child = await childWithProgress(wholeProefles);
    const pattern = '**/api/collections/lesson_progress/records**';
    await page.route(pattern, (route) => route.fulfill({ status: 503, body: '{}' }));
    await loginAs(page, parentUsername, '/ouder');
    await expect(page.locator('.activity-error')).toContainText('Opnieuw');
    const card = page.locator(`snf-child-card:has(a[href="/ouder/${child.id}"])`);
    await expect(card).toBeVisible();
    await expect(card.locator('.lessons-completed')).toHaveCount(0);

    await page.unroute(pattern);
    await page.locator('.activity-error').getByRole('button', { name: 'Opnieuw' }).click();
    await expect(page.locator('.activity-error')).toHaveCount(0);
    await expect(card.locator('.lessons-completed')).toHaveText('1 les klaar');
  });
});
