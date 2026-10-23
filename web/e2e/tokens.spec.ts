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

// The tokens of the trace game: fixed values, the same in light and dark.
const gameTokens: Record<string, string> = {
  '--snf-color-choice-yellow': '#ffd83d',
  '--snf-color-choice-purple': '#cfc3e8',
  '--snf-color-choice-green': '#8fe3a8',
  '--snf-color-choice-pink': '#ffb3cd',
  '--snf-color-choice-blue': '#7cc1d8',
  '--snf-color-choice-orange': '#ffc078',
  '--snf-color-game-screen': '#22183a',
  '--snf-color-game-screen-border': '#3d2d66',
  '--snf-color-game-water': '#2b5c8a',
  '--snf-color-game-wave': '#7cc1d8',
  '--snf-color-game-label': '#cfc3e8',
};

async function readGameTokens(page: Page): Promise<Record<string, string>> {
  return page.evaluate((names) => {
    const probe = document.createElement('div');
    document.body.append(probe);
    const result: Record<string, string> = {};
    for (const name of names) {
      probe.style.color = `var(${name})`;
      const [r, g, b] = (getComputedStyle(probe).color.match(/\d+/g) ?? []).slice(0, 3).map(Number);
      result[name] = '#' + [r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('');
    }
    probe.remove();
    return result;
  }, Object.keys(gameTokens));
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

  test('the trace game tokens are the same in light and dark', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    expect(await readGameTokens(page)).toEqual(gameTokens);
    await page.emulateMedia({ colorScheme: 'dark' });
    expect(await readGameTokens(page)).toEqual(gameTokens);
    await setTheme(page, 'dark');
    expect(await readGameTokens(page)).toEqual(gameTokens);
  });

  test('data-theme="light" wins over a dark system', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    await setTheme(page, 'light');
    expect(await readTokens(page)).toEqual(light);
  });
});
