import AxeBuilder from '@axe-core/playwright';
import type { Locator, Page } from '@playwright/test';
import { expect, test } from '../fixtures';
import { createChild, currentBaseURL, uniqueName } from '../support/accounts';
import { tabTo } from '../overview/pages';
import {
  askToClear,
  childCard,
  childLesson,
  clearButton,
  openAsParent,
  openChildPage,
  proeflesTitle,
  storeWholeLesson,
} from './pages';

async function expectNoViolations(page: Page, label: string): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations, label).toEqual([]);
}

/** A child with a whole lesson of progress and a unique name. */
async function childWithLesson() {
  const child = await createChild(currentBaseURL(), { name: uniqueName() });
  await storeWholeLesson(child, 'proefles');
  return child;
}

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

/**
 * Gives a child card the focus the way a keyboard user gets it. The e2e database holds hundreds
 * of test children, so Tab-ing there from the top would take hundreds of presses: focus the card,
 * then move away and back with Tab and Shift+Tab, which makes the focus ring show.
 */
async function focusByKeyboard(target: Locator): Promise<void> {
  const page = target.page();
  await target.focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  await expect(target).toBeFocused();
}

const ring = (page: Page) =>
  page.evaluate(() => {
    const style = getComputedStyle(document.activeElement as Element);
    return { style: style.outlineStyle, width: style.outlineWidth };
  });

test.describe('parent accessibility', () => {
  for (const scheme of ['light', 'dark'] as const) {
    test(`/ouder has no axe violations (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      const child = await childWithLesson();
      await openAsParent(page, '/ouder');
      await expect(childCard(page, child.name)).toBeVisible();
      await expectNoViolations(page, `/ouder, ${scheme}`);
    });

    test(`the page of a child has no axe violations: progress, question and message (${scheme})`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: scheme });
      const child = await childWithLesson();
      await openChildPage(page, child);
      const row = childLesson(page, proeflesTitle);
      await expect(row.locator('.details')).toBeVisible();
      await expectNoViolations(page, `child, ${scheme}`);

      await askToClear(row);
      await expectNoViolations(page, `child with the question, ${scheme}`);

      await row.getByRole('button', { name: 'Ja, wissen' }).click();
      await expect(page.locator('p.cleared')).toContainText('is gewist');
      await expectNoViolations(page, `child after clearing, ${scheme}`);
    });
  }

  test('every link and button is at least 44 × 44 px', async ({ page }) => {
    const child = await childWithLesson();
    await openAsParent(page, '/');
    expect(await smallTargets(page)).toEqual([]);
    await page.locator('a.parent-link').click();
    await expect(childCard(page, child.name)).toBeVisible();
    expect(await page.locator('a, button').count()).toBeGreaterThan(2);
    expect(await smallTargets(page)).toEqual([]);

    await childCard(page, child.name).getByRole('link').click();
    const row = childLesson(page, proeflesTitle);
    await expect(clearButton(row)).toBeVisible();
    expect(await smallTargets(page)).toEqual([]);
    await askToClear(row);
    expect(await smallTargets(page)).toEqual([]);
    await row.getByRole('button', { name: 'Annuleren' }).click();
    await row.getByRole('button', { name: 'Voortgang wissen' }).click();
    await row.getByRole('button', { name: 'Ja, wissen' }).click();
    await expect(page.locator('p.cleared')).toContainText('is gewist');
    expect(await smallTargets(page)).toEqual([]);
  });

  test('keyboard focus shows the focus ring on a child card and the clear button', async ({
    page,
  }) => {
    const child = await childWithLesson();
    await openAsParent(page, '/ouder');
    await focusByKeyboard(childCard(page, child.name).getByRole('link'));
    expect(await ring(page)).toEqual({ style: 'solid', width: '3px' });
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(`/ouder/${child.id}$`));
    const button = clearButton(childLesson(page, proeflesTitle));
    await expect(button).toBeVisible();
    await tabTo(page, button);
    expect(await ring(page)).toEqual({ style: 'solid', width: '3px' });
  });

  test('the parent overview can be used with the keyboard', async ({ page }) => {
    const child = await childWithLesson();
    await openAsParent(page, '/ouder');
    await focusByKeyboard(childCard(page, child.name).getByRole('link'));
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(`/ouder/${child.id}$`));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(child.name);

    const row = childLesson(page, proeflesTitle);
    const button = clearButton(row);
    await tabTo(page, button);
    await page.keyboard.press('Enter');
    await expect(row.getByRole('group')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(row.getByRole('group')).toHaveCount(0);
    await expect(button).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(row.getByRole('group')).toBeFocused();
    await tabTo(page, row.getByRole('button', { name: 'Ja, wissen' }));
    await page.keyboard.press('Enter');
    await expect(page.locator('p.cleared')).toHaveText(
      `De voortgang van ${proeflesTitle} is gewist.`,
    );
    await expect(page.locator('p.cleared')).toBeFocused();
  });

  test('no animation longer than 1 ms with prefers-reduced-motion: reduce', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const child = await childWithLesson();
    await openAsParent(page, '/ouder');
    await expect(childCard(page, child.name)).toBeVisible();
    const longAnimations = () =>
      page.evaluate(() =>
        document
          .getAnimations()
          .filter((animation) => {
            const timing = animation.effect?.getComputedTiming();
            return Number(timing?.duration ?? 0) * Number(timing?.iterations ?? 1) > 1;
          })
          .map((animation) => animation.id || animation.constructor.name),
      );
    expect(await longAnimations(), '/ouder').toEqual([]);
    await childCard(page, child.name).getByRole('link').click();
    const row = childLesson(page, proeflesTitle);
    await expect(row.locator('.details')).toBeVisible();
    expect(await longAnimations(), 'child').toEqual([]);
    await askToClear(row);
    expect(await longAnimations(), 'question').toEqual([]);
    await row.getByRole('button', { name: 'Ja, wissen' }).click();
    await expect(page.locator('p.cleared')).toContainText('is gewist');
    expect(await longAnimations(), 'cleared').toEqual([]);
  });
});
