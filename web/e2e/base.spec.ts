import { expect, test } from './fixtures';

test.describe('base styles', () => {
  test('headings use Bangers', async ({ page }) => {
    await page.goto('/');
    const fontFamily = await page
      .getByRole('heading', { level: 1 })
      .evaluate((el) => getComputedStyle(el).fontFamily);
    expect(fontFamily).toMatch(/^"?Bangers"?/);
  });

  test('the h1 is ink in light mode', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveCSS('color', 'rgb(20, 20, 20)');
  });

  test('the h1 is yellow in dark mode', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveCSS('color', 'rgb(255, 216, 61)');
  });

  test('scrolls smoothly when motion is allowed', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/');
    await expect(page.locator('html')).toHaveCSS('scroll-behavior', 'smooth');
  });

  test('does not scroll smoothly with reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.locator('html')).toHaveCSS('scroll-behavior', 'auto');
  });
});
