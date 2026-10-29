import { expect, test } from './fixtures';

test.describe('favicon', () => {
  test('shows Ted instead of the Angular logo', async ({ page, request }) => {
    await page.goto('/login');
    const icons = page.locator('link[rel="icon"]');
    await expect(icons).toHaveCount(2);
    await expect(icons.nth(0)).toHaveAttribute('href', 'favicon.svg');
    await expect(icons.nth(1)).toHaveAttribute('href', 'favicon.ico');

    const svg = await request.get('/favicon.svg');
    expect(svg.ok()).toBe(true);
    const body = await svg.text();
    expect(body).toContain('Ted');
    // The cool mood: sunglasses on by default.
    expect(body).toContain('display:var(--m-bril,inline)');

    const ico = await request.get('/favicon.ico');
    expect(ico.ok()).toBe(true);
  });
});
