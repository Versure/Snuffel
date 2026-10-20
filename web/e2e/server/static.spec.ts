import { expect, test } from '../fixtures';

// The production build, served by PocketBase (tools/serve-pocketbase.mjs or the container).
test.describe('static files served by PocketBase', () => {
  test('serves the app on /', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Snuffel');
  });

  test('falls back to the app for SPA routes opened directly', async ({ page }) => {
    const response = await page.goto('/stijl');
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle('Huisstijl · Snuffel');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('huisstijl');
  });

  test('serves Ted as SVG', async ({ request }) => {
    const response = await request.get('/assets/ted.svg');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('image/svg+xml');
  });

  test('serves fonts as woff2', async ({ request }) => {
    const response = await request.get('/fonts/bangers-latin-400-normal.woff2');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('font/woff2');
  });

  test('answers the health check', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.status()).toBe(200);
  });
});
