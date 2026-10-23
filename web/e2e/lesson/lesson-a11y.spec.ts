import AxeBuilder from '@axe-core/playwright';
import type { Locator, Page } from '@playwright/test';
import { expect, test } from '../fixtures';
import { answerAll, checkbox, practice, questionBlock, quiz, section, settle } from './actions';
import { openLesson } from './fixture';

async function expectNoViolations(page: Page, label: string): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations, label).toEqual([]);
}

/** Opens the hint of the first question, answers every question and ticks two items. */
async function workThrough(page: Page): Promise<void> {
  await questionBlock(page, quiz.questions[0])
    .getByRole('button', { name: 'Hint', exact: true })
    .click();
  await answerAll(page, [quiz.questions[0].id]);
  await checkbox(page, practice.items[0].id).check();
  await checkbox(page, practice.items[2].id).check();
  await expect(section(page, quiz.id).locator('.score')).toBeVisible();
  await expect(questionBlock(page, quiz.questions[0]).locator('.hint')).toBeVisible();
  await settle(page);
}

/** Every visible button, link and checklist label that is smaller than 44 × 44 px. */
async function smallTargets(page: Page) {
  return page.locator('a, button, snf-checklist label').evaluateAll((elements) =>
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
      })
      .filter((size) => size.width < 44 || size.height < 44),
  );
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

  test('the lesson has no axe violations with an answered quiz, an open hint and ticked items (light)', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await openLesson(page);
    await workThrough(page);
    await expectNoViolations(page, 'answered, light');
  });

  test('the lesson has no axe violations with an answered quiz, an open hint and ticked items (dark)', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await openLesson(page);
    await workThrough(page);
    await expectNoViolations(page, 'answered, dark');
  });

  test('every button, link and checklist label is at least 44 × 44 px', async ({ page }) => {
    await openLesson(page);
    const count = await page.locator('a, button, snf-checklist label').count();
    expect(count).toBeGreaterThan(20);
    // Before answering: every option and every hint button.
    expect(await section(page, quiz.id).getByRole('button', { name: 'Hint' }).count()).toBe(
      quiz.questions.filter((question) => question.hints.length).length,
    );
    expect(await smallTargets(page)).toEqual([]);
    // After answering: the closed options, "Opnieuw" and the ticked items.
    await workThrough(page);
    await expect(section(page, quiz.id).getByRole('button', { name: 'Opnieuw' })).toBeVisible();
    expect(await smallTargets(page)).toEqual([]);
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

  test('keyboard focus shows the focus ring on a quiz option and a checkbox', async ({ page }) => {
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

    // From the prompt of the first question, Tab reaches its first option.
    const block = questionBlock(page, quiz.questions[0]);
    await block.locator('.prompt').focus();
    await page.keyboard.press('Tab');
    await expectRing(block.locator('button.option').first(), 'quiz option');

    // From the heading of the practice step, Tab reaches the first checkbox.
    await section(page, practice.id).getByRole('heading', { level: 2 }).focus();
    await page.keyboard.press('Tab');
    await expectRing(checkbox(page, practice.items[0].id), 'checkbox');
    // Space ticks it.
    await page.keyboard.press('Space');
    await expect(checkbox(page, practice.items[0].id)).toBeChecked();
  });

  test('no animation longer than 1 ms with prefers-reduced-motion: reduce', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openLesson(page);
    await workThrough(page);
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
