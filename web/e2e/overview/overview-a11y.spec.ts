import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures';
import { loginAsNewChild } from '../support/accounts';
import { loginAs } from '../support/login';
import { card, childWithProgress, startedProefles, tabTo, wholeProefles } from './pages';

async function expectNoViolations(page: Page, label: string): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations, label).toEqual([]);
}

async function openWithProgress(page: Page, path: string): Promise<void> {
  const account = await childWithProgress([...wholeProefles]);
  await loginAs(page, account.username, path);
  await expect(page.locator('main')).not.toHaveAttribute('aria-busy', 'true');
  await expect(page.getByRole('progressbar').first()).toBeVisible();
}

/** Starts a child with a started lesson, but with the progress request failing. */
async function openWithProgressError(page: Page, path: string): Promise<void> {
  const account = await childWithProgress([...startedProefles]);
  await page.route('**/api/collections/lesson_progress/records**', (route) =>
    route.fulfill({ status: 503, body: '{}' }),
  );
  await loginAs(page, account.username, path);
  await expect(page.locator('.progress-error')).toBeVisible();
}

const pages = [
  { name: 'start page', path: '/' },
  { name: 'course overview', path: '/leren/proefcursus' },
] as const;

/** Every visible link and button that is smaller than 44 × 44 px. */
async function smallTargets(page: Page) {
  return page.locator('a, button').evaluateAll((elements) =>
    elements
      .filter((element) => element.getClientRects().length > 0)
      .map((element) => {
        const box = element.getBoundingClientRect();
        return {
          name: (element.textContent ?? '').replace(/\s+/g, ' ').trim(),
          width: box.width,
          height: box.height,
        };
      })
      .filter((size) => size.width < 44 || size.height < 44),
  );
}

test.describe('overview accessibility', () => {
  for (const { name, path } of pages) {
    for (const scheme of ['light', 'dark'] as const) {
      test(`the ${name} has no axe violations with progress (${scheme})`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: scheme });
        await openWithProgress(page, path);
        await expectNoViolations(page, `${name}, ${scheme}`);
      });

      test(`the ${name} has no axe violations with the progress error (${scheme})`, async ({
        page,
      }) => {
        await page.emulateMedia({ colorScheme: scheme });
        await openWithProgressError(page, path);
        await expectNoViolations(page, `${name}, error, ${scheme}`);
      });
    }
  }

  test('the course overview has no axe violations for a started lesson and a planned one (dark)', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    const account = await childWithProgress([...startedProefles]);
    await loginAs(page, account.username, '/leren/proefcursus');
    await expect(page.locator('.next')).toBeVisible();
    await expectNoViolations(page, 'started, dark');
  });

  test('every link and button on the start page and the course overview is at least 44 × 44 px', async ({
    page,
  }) => {
    await openWithProgress(page, '/');
    expect(await page.locator('a, button').count()).toBeGreaterThan(2);
    expect(await smallTargets(page)).toEqual([]);
    await card(page, 'Proefcursus').click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Proefcursus');
    await expect(page.locator('snf-lesson-item')).toHaveCount(2);
    expect(await page.locator('a, button').count()).toBeGreaterThan(2);
    expect(await smallTargets(page)).toEqual([]);
  });

  test('keyboard focus shows the focus ring on a course card and a lesson link', async ({
    page,
  }) => {
    await loginAsNewChild(page, '/');
    const ring = () =>
      page.evaluate(() => {
        const style = getComputedStyle(document.activeElement as Element);
        return { style: style.outlineStyle, width: style.outlineWidth };
      });
    await tabTo(page, card(page, 'Proefcursus').getByRole('link'));
    expect(await ring()).toEqual({ style: 'solid', width: '3px' });

    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/leren\/proefcursus$/);
    await tabTo(page, page.locator('snf-lesson-item a.title'));
    expect(await ring()).toEqual({ style: 'solid', width: '3px' });
  });

  test('the start page and the course overview can be used with the keyboard', async ({ page }) => {
    await loginAsNewChild(page, '/');
    await expect(card(page, 'Proefcursus')).toBeVisible();
    await tabTo(page, card(page, 'Proefcursus').getByRole('link'));
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/leren\/proefcursus$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Proefcursus');

    await tabTo(page, page.locator('snf-lesson-item a.title'));
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/leren\/proefcursus\/proefles$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Proefles: aanbeet of vastzitten?',
    );
  });

  test('no animation longer than 1 ms with prefers-reduced-motion: reduce', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openWithProgress(page, '/');
    for (const { path } of pages) {
      await page.goto(path);
      await expect(page.locator('main')).not.toHaveAttribute('aria-busy', 'true');
      await expect(page.getByRole('progressbar').first()).toBeVisible();
      // See server/auth.spec.ts: check how long each animation lasts, not whether one runs.
      const long = await page.evaluate(() =>
        document
          .getAnimations()
          .filter((animation) => {
            const timing = animation.effect?.getComputedTiming();
            return Number(timing?.duration ?? 0) * Number(timing?.iterations ?? 1) > 1;
          })
          .map((animation) => animation.id || animation.constructor.name),
      );
      expect(long, path).toEqual([]);
    }
    // These pages have no animation of their own (the bar is static, Ted only moves in the lesson),
    // so there is nothing to compare with when reduced motion is off; a new animation must stay short.
  });
});
