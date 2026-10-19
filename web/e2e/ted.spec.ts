import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

const MOOD_VARIABLES = [
  '--m-bril',
  '--m-ogen-blij',
  '--m-ogen-denk',
  '--m-mond-blij',
  '--m-mond-denk',
  '--m-mond-oeps',
] as const;

const MOODS: { mood: string; label: string; variables: Record<string, string> }[] = [
  { mood: 'cool', label: 'Ted, een pluizige bruine pup met zonnebril', variables: {} },
  {
    mood: 'happy',
    label: 'Ted, een pluizige bruine pup, kijkt blij',
    variables: { '--m-bril': 'none', '--m-ogen-blij': 'inline' },
  },
  {
    mood: 'thinking',
    label: 'Ted, een pluizige bruine pup, denkt na',
    variables: {
      '--m-bril': 'none',
      '--m-ogen-denk': 'inline',
      '--m-mond-blij': 'none',
      '--m-mond-denk': 'inline',
    },
  },
  {
    mood: 'oops',
    label: 'Ted, een pluizige bruine pup, kijkt geschrokken',
    variables: {
      '--m-bril': 'none',
      '--m-ogen-denk': 'inline',
      '--m-mond-blij': 'none',
      '--m-mond-oeps': 'inline',
    },
  },
];

async function openTedSection(page: Page): Promise<void> {
  await page.goto('/stijl');
  await expect(page.getByRole('heading', { level: 2, name: 'Ted', exact: true })).toBeVisible();
}

test.describe('Ted', () => {
  for (const { mood, label, variables } of MOODS) {
    test(`mood "${mood}" shows its label and CSS variables on /stijl`, async ({ page }) => {
      await openTedSection(page);
      const ted = page.getByRole('img', { name: label, exact: true });
      await expect(ted).toHaveCount(1);
      await ted.scrollIntoViewIfNeeded();
      const computed = await ted.evaluate((svg, names) => {
        const style = getComputedStyle(svg);
        return Object.fromEntries(names.map((name) => [name, style.getPropertyValue(name).trim()]));
      }, MOOD_VARIABLES);
      const expected = Object.fromEntries(
        MOOD_VARIABLES.map((name) => [name, variables[name] ?? '']),
      );
      expect(computed).toEqual(expected);
    });
  }

  test('shows four distinct Ted images in the "Ted" section', async ({ page }) => {
    await openTedSection(page);
    for (const { label } of MOODS) {
      await expect(page.getByRole('img', { name: label, exact: true })).toBeVisible();
    }
    await expect(page.getByRole('img', { name: /^Ted, een pluizige bruine pup/ })).toHaveCount(4);
  });

  test('loads the sprite from the own origin as valid XML', async ({ page, baseURL }) => {
    const sprite = page.waitForResponse(
      (response) => new URL(response.url()).pathname === '/assets/ted.svg',
    );
    await openTedSection(page);
    const response = await sprite;
    expect(response.status()).toBe(200);
    expect(new URL(response.url()).origin).toBe(new URL(baseURL ?? 'http://localhost').origin);

    const text = await response.text();
    expect(text).toContain('<symbol id="ted"');

    // A browser refuses a malformed sprite and silently draws nothing, so parse it as XML.
    const parseError = await page.evaluate((source) => {
      const doc = new DOMParser().parseFromString(source, 'image/svg+xml');
      return doc.querySelector('parsererror')?.textContent ?? null;
    }, text);
    expect(parseError, 'XML parse error in /assets/ted.svg').toBeNull();

    const ted = page.getByRole('img', { name: MOODS[0].label, exact: true });
    const box = await ted.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThan(0);
    expect(box?.height ?? 0).toBeGreaterThan(0);
  });

  test('draws visible content for Ted (the sprite is rendered)', async ({ page }) => {
    await openTedSection(page);
    const ted = page.getByRole('img', { name: MOODS[0].label, exact: true });
    await ted.scrollIntoViewIfNeeded();
    // An empty <use> has no bounding box; a drawn symbol does.
    await expect
      .poll(() => ted.evaluate((svg) => svg.querySelector('use')?.getBBox().width ?? 0))
      .toBeGreaterThan(0);
  });

  test.describe('wiggle', () => {
    const wigglingTed = (page: Page) => page.locator('snf-ted-says snf-ted svg').first();

    test('has no animation with reduced motion', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await openTedSection(page);
      const name = await wigglingTed(page).evaluate((svg) => getComputedStyle(svg).animationName);
      expect(name).toBe('none');
    });

    test('runs snf-ted-wiggle without a motion preference', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await openTedSection(page);
      const name = await wigglingTed(page).evaluate((svg) => getComputedStyle(svg).animationName);
      expect(name).toBe('snf-ted-wiggle');
    });
  });
});
