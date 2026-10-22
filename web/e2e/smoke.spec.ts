import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

test.describe('placeholder page', () => {
  test('shows the Snuffel heading in Dutch', async ({ page }) => {
    await page.goto('/');
    // Without a session the app sends you to the login page (M5).
    await expect(page).toHaveURL(/\/login\?terug=%2F$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'nl');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Snuffel');
  });

  test('has no accessibility violations', async ({ page }) => {
    await page.goto('/');
    // Scan the login page only once the redirect has finished and it has rendered.
    await expect(page).toHaveURL(/\/login\?terug=%2F$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Snuffel');
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
