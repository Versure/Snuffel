import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

async function openStyleGuide(page: Page): Promise<void> {
  await page.goto('/stijl');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('huisstijl');
}

function themeButton(page: Page, name: 'Licht' | 'Donker' | 'Systeem') {
  return page.getByRole('group', { name: 'Thema' }).getByRole('button', { name });
}

async function expectNoAxeViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
}

test.describe('style guide /stijl', () => {
  test.describe('has no accessibility violations', () => {
    test('with a light system theme', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'light' });
      await openStyleGuide(page);
      await expectNoAxeViolations(page);
    });

    test('with a dark system theme', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'dark' });
      await openStyleGuide(page);
      await expectNoAxeViolations(page);
    });

    test('after choosing "Donker" on a light system', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'light' });
      await openStyleGuide(page);
      await themeButton(page, 'Donker').click();
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
      await expect(themeButton(page, 'Donker')).toHaveAttribute('aria-pressed', 'true');
      await expectNoAxeViolations(page);
    });

    test('after choosing "Licht" on a dark system', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'dark' });
      await openStyleGuide(page);
      await themeButton(page, 'Licht').click();
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
      await expect(themeButton(page, 'Licht')).toHaveAttribute('aria-pressed', 'true');
      await expectNoAxeViolations(page);
    });
  });

  test('"Systeem" removes the chosen theme', async ({ page }) => {
    await openStyleGuide(page);
    await themeButton(page, 'Donker').click();
    await themeButton(page, 'Systeem').click();
    await expect(page.locator('html')).not.toHaveAttribute('data-theme');
  });

  test('every button is at least 44 × 44 px', async ({ page }) => {
    await openStyleGuide(page);
    const targets = page.locator('button, a[snf-button]');
    const count = await targets.count();
    expect(count).toBeGreaterThan(0);
    for (let index = 0; index < count; index++) {
      const target = targets.nth(index);
      const box = await target.boundingBox();
      const label = (await target.textContent())?.trim();
      expect(box, `bounding box of "${label}"`).not.toBeNull();
      expect(box?.width ?? 0, `width of "${label}"`).toBeGreaterThanOrEqual(44);
      expect(box?.height ?? 0, `height of "${label}"`).toBeGreaterThanOrEqual(44);
    }
  });

  test('shows a visible focus ring after Tab', async ({ page }) => {
    await openStyleGuide(page);
    await page.keyboard.press('Tab');
    const outline = await page.evaluate(() => {
      const active = document.activeElement;
      if (!active || active === document.body) return null;
      const style = getComputedStyle(active);
      return { style: style.outlineStyle, width: style.outlineWidth };
    });
    expect(outline).not.toBeNull();
    expect(outline?.style).not.toBe('none');
    expect(outline?.width).toBe('3px');
  });

  test('has no running animations with reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openStyleGuide(page);
    const animated = await page.evaluate(() => {
      const toMs = (value: string): number =>
        Math.max(
          ...value
            .split(',')
            .map((part) => part.trim())
            .map((part) => parseFloat(part) * (part.endsWith('ms') ? 1 : 1000)),
        );
      const found: string[] = [];
      for (const element of Array.from(document.querySelectorAll('*'))) {
        for (const pseudo of [null, '::before', '::after']) {
          const style = getComputedStyle(element, pseudo);
          if (style.animationName !== 'none' && toMs(style.animationDuration) > 0.01) {
            found.push(`${element.tagName.toLowerCase()}${pseudo ?? ''}: ${style.animationName}`);
          }
        }
      }
      return found;
    });
    expect(animated).toEqual([]);
  });
});
