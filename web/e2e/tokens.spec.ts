import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

interface ThemeTokens {
  background: string;
  text: string;
  heading: string;
}

const light: ThemeTokens = { background: '#ffd83d', text: '#141414', heading: '#141414' };
const dark: ThemeTokens = { background: '#1d1036', text: '#fff6dc', heading: '#ffd83d' };

// Resolves each token through a probe element, so var() references become a concrete colour.
async function readTokens(page: Page): Promise<ThemeTokens> {
  return page.evaluate(() => {
    const probe = document.createElement('div');
    document.body.append(probe);
    const resolve = (token: string): string => {
      probe.style.color = `var(${token})`;
      const [r, g, b] = (getComputedStyle(probe).color.match(/\d+/g) ?? []).slice(0, 3).map(Number);
      return '#' + [r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('');
    };
    const tokens = {
      background: resolve('--snf-color-background'),
      text: resolve('--snf-color-text'),
      heading: resolve('--snf-color-heading'),
    };
    probe.remove();
    return tokens;
  });
}

async function setTheme(page: Page, theme: 'light' | 'dark'): Promise<void> {
  await page.evaluate((value) => document.documentElement.setAttribute('data-theme', value), theme);
}

test.describe('design tokens', () => {
  test('use the light theme when the system is light', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    expect(await readTokens(page)).toEqual(light);
  });

  test('use the dark theme when the system is dark', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    expect(await readTokens(page)).toEqual(dark);
  });

  test('data-theme="dark" wins over a light system', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    await setTheme(page, 'dark');
    expect(await readTokens(page)).toEqual(dark);
  });

  test('data-theme="light" wins over a dark system', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    await setTheme(page, 'light');
    expect(await readTokens(page)).toEqual(light);
  });
});
