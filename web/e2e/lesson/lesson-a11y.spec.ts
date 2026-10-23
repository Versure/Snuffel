import AxeBuilder from '@axe-core/playwright';
import type { Locator, Page } from '@playwright/test';
import { expect, test } from '../fixtures';
import { openLesson } from './fixture';

async function expectNoViolations(page: Page, label: string): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations, label).toEqual([]);
}

function term(page: Page, name: string): Locator {
  return page.locator('snf-example-block').getByRole('button', { name, exact: true });
}

test.describe('lesson accessibility', () => {
  test('the lesson has no axe violations (light)', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await openLesson(page);
    await expectNoViolations(page, 'light');
  });

  test('the lesson has no axe violations (dark)', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await openLesson(page);
    await expectNoViolations(page, 'dark');
  });

  test('the lesson has no axe violations with data-theme dark on a light system', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await openLesson(page);
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    await expectNoViolations(page, 'data-theme dark');
  });

  test('the lesson has no axe violations with an open glossary term', async ({ page }) => {
    await openLesson(page);
    await term(page, 'shad').click();
    await expect(term(page, 'shad')).toHaveAttribute('aria-expanded', 'true');
    await expectNoViolations(page, 'open term');
  });

  test('every button and link on the lesson page is at least 44 × 44 px', async ({ page }) => {
    await openLesson(page);
    const sizes = await page.locator('a, button').evaluateAll((elements) =>
      elements
        // Only what is on screen: not inside a closed definition.
        .filter((element) => element.getClientRects().length > 0)
        .map((element) => {
          const box = element.getBoundingClientRect();
          return {
            name: (element.textContent ?? '').replace(/\s+/g, ' ').trim(),
            width: box.width,
            height: box.height,
          };
        }),
    );
    expect(sizes.length).toBeGreaterThan(20);
    const small = sizes.filter((size) => size.width < 44 || size.height < 44);
    expect(small).toEqual([]);
  });

  test('keyboard focus shows the focus ring on the step navigation and a term', async ({
    page,
  }) => {
    await openLesson(page);
    const expectRing = async (target: Locator, label: string) => {
      await expect(target, label).toBeFocused();
      const outline = await target.evaluate((element) => {
        const style = getComputedStyle(element);
        return { style: style.outlineStyle, width: style.outlineWidth };
      });
      expect(outline.style, label).not.toBe('none');
      expect(outline.width, label).toBe('3px');
    };

    // Tab from the start link to the first link of the step navigation.
    await page.getByRole('link', { name: 'Naar de start' }).first().focus();
    await page.keyboard.press('Tab');
    await expectRing(page.getByRole('link', { name: 'Stap 1: Uitleg' }), 'step navigation');

    // From the last step link, Tab reaches the first term in the example.
    await page.getByRole('link', { name: 'Stap 4: Zelf doen' }).focus();
    await page.keyboard.press('Tab');
    await expectRing(term(page, 'shad'), 'term');
  });

  test('no animation longer than 1 ms with prefers-reduced-motion: reduce', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openLesson(page);
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
    expect(long).toEqual([]);
    // Without reduced motion Ted wiggles (so the check above is meaningful).
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await expect
      .poll(() => page.evaluate(() => document.getAnimations().length))
      .toBeGreaterThan(0);
  });

  test('no horizontal scrolling on the page', async ({ page }) => {
    await openLesson(page);
    await term(page, 'shad').click();
    const overflow = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    }));
    expect(overflow.scroll).toBeLessThanOrEqual(overflow.client);
    // body has overflow-x: hidden, so also check that nothing sticks out of the viewport.
    const wide = await page.evaluate(() =>
      [...document.querySelectorAll('main *')]
        .filter((element) => {
          const box = element.getBoundingClientRect();
          return box.width > 0 && (box.right > window.innerWidth + 1 || box.left < -1);
        })
        .map((element) => element.tagName.toLowerCase() + '.' + element.className),
    );
    expect(wide).toEqual([]);
  });
});
