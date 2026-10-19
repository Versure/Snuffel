import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

test.describe('placeholder page', () => {
  test('shows the Snuffel heading in Dutch', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'nl');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Snuffel');
  });

  test('has no accessibility violations', async ({ page }) => {
    await page.goto('/');
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
