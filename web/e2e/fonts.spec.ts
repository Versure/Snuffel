import { expect, test } from './fixtures';

const fontFiles = [
  '/fonts/bangers-latin-400-normal.woff2',
  '/fonts/atkinson-hyperlegible-latin-400-normal.woff2',
  '/fonts/atkinson-hyperlegible-latin-700-normal.woff2',
];

test.describe('fonts', () => {
  for (const path of fontFiles) {
    test(`serves ${path} from the own origin`, async ({ page, baseURL }) => {
      const response = await page.request.get(path);
      expect(response.status()).toBe(200);
      expect(new URL(response.url()).origin).toBe(new URL(baseURL ?? '').origin);
    });
  }

  test('loads Bangers and Atkinson Hyperlegible', async ({ page }) => {
    await page.goto('/');
    const loaded = await page.evaluate(async () => {
      // Request both faces so the browser fetches them, then wait until loading is done.
      await Promise.all([
        document.fonts.load('16px "Bangers"'),
        document.fonts.load('700 16px "Atkinson Hyperlegible"'),
      ]);
      await document.fonts.ready;
      return {
        bangers: document.fonts.check('16px "Bangers"'),
        atkinson: document.fonts.check('700 16px "Atkinson Hyperlegible"'),
      };
    });
    expect(loaded).toEqual({ bangers: true, atkinson: true });
  });
});
