import { expect, test } from '../fixtures';
import { fixtureLesson, openLesson } from './fixture';

test.describe('lesson page extras', () => {
  test('the lesson page logs no console errors or page errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error' || message.type() === 'warning') {
        errors.push(`${message.type()}: ${message.text()}`);
      }
    });
    page.on('pageerror', (error) => errors.push(error.message));
    await openLesson(page);
    await page.getByRole('link', { name: 'Stap 4: Zelf doen' }).click();
    await page.locator('section#stap-uitleg').scrollIntoViewIfNeeded();
    await page.locator('section#vragen').scrollIntoViewIfNeeded();
    expect(errors).toEqual([]);
  });

  test('only same-origin requests are made while reading the whole lesson', async ({ page }) => {
    const origins = new Set<string>();
    page.on('request', (request) => {
      if (/^https?:/.test(request.url())) origins.add(new URL(request.url()).origin);
    });
    await openLesson(page);
    await page.locator('section#vragen').scrollIntoViewIfNeeded();
    await page.getByRole('button', { name: 'shad', exact: true }).first().click();
    expect([...origins]).toEqual([new URL(page.url()).origin]);
  });

  test('buttons and links are at least 44 × 44 px with a glossary term open', async ({ page }) => {
    await openLesson(page);
    const terms = page.locator('main button[aria-expanded]');
    const count = await terms.count();
    expect(count).toBeGreaterThan(3);
    // Open every term at once: the definitions must not hide or shrink anything.
    for (let index = 0; index < count; index += 1) await terms.nth(index).click();
    const small = await page.locator('a, button').evaluateAll((elements) =>
      elements
        .filter((element) => element.getClientRects().length > 0)
        .map((element) => {
          const box = element.getBoundingClientRect();
          return {
            name: (element.textContent ?? '').replace(/\s+/g, ' ').trim(),
            width: box.width,
            height: box.height,
          };
        })
        .filter((size) => size.width < 44 || size.height < 44),
    );
    expect(small).toEqual([]);
  });

  test('tap targets stay 44 × 44 px in dark mode', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await openLesson(page);
    const small = await page.locator('a, button').evaluateAll((elements) =>
      elements
        .filter((element) => element.getClientRects().length > 0)
        .map((element) => {
          const box = element.getBoundingClientRect();
          return { name: element.textContent?.trim(), width: box.width, height: box.height };
        })
        .filter((size) => size.width < 44 || size.height < 44),
    );
    expect(small).toEqual([]);
  });

  test('the figure keeps its light background in dark mode', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await openLesson(page);
    const img = page.locator('snf-figure-block figure img');
    await img.scrollIntoViewIfNeeded();
    const background = await img.evaluate((element) => {
      let current: Element | null = element;
      while (current) {
        const color = getComputedStyle(current).backgroundColor;
        if (color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent') return color;
        current = current.parentElement;
      }
      return '';
    });
    const [red, green, blue] = background.match(/\d+/g)!.map(Number);
    // Light: luminance well above the middle.
    expect(0.2126 * red + 0.7152 * green + 0.0722 * blue).toBeGreaterThan(200);
  });

  test('with reduced motion the step navigation jumps without smooth scrolling', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openLesson(page);
    expect(
      await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior),
    ).toBe('auto');
    await page.getByRole('link', { name: 'Stap 3: Quiz' }).click();
    const heading = page.locator('section#stap-quiz').getByRole('heading', { level: 2 });
    await expect(heading).toBeInViewport();
    // Ted does not wiggle.
    const running = await page.evaluate(
      () =>
        document.getAnimations().filter((animation) => {
          const timing = animation.effect?.getComputedTiming();
          return Number(timing?.duration ?? 0) * Number(timing?.iterations ?? 1) > 1;
        }).length,
    );
    expect(running).toBe(0);
  });

  test('the whole lesson can be read with the keyboard: every control is reachable and closes with Escape', async ({
    page,
  }) => {
    await openLesson(page);
    const first = page.locator('main button[aria-expanded]').first();
    await first.focus();
    await page.keyboard.press('Enter');
    await expect(first).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Escape');
    await expect(first).toHaveAttribute('aria-expanded', 'false');
    await page.keyboard.press('Space');
    await expect(first).toHaveAttribute('aria-expanded', 'true');

    // Tabbing through the page never lands on something invisible, and every stop has a name.
    const stops: { name: string; visible: boolean }[] = [];
    await page.locator('body').focus();
    for (let index = 0; index < 80; index += 1) {
      await page.keyboard.press('Tab');
      stops.push(
        await page.evaluate(() => {
          const element = document.activeElement as HTMLElement;
          const box = element.getBoundingClientRect();
          return {
            name: (element.textContent ?? element.getAttribute('aria-label') ?? '').trim(),
            visible: box.width > 0 && box.height > 0,
          };
        }),
      );
    }
    expect(stops.filter((stop) => !stop.visible)).toEqual([]);
    expect(stops.filter((stop) => stop.name === '')).toEqual([]);
  });

  test('a lesson heading order never skips a level', async ({ page }) => {
    await openLesson(page);
    const levels = await page
      .locator('main h1, main h2, main h3, main h4')
      .evaluateAll((elements) => elements.map((element) => Number(element.tagName.slice(1))));
    expect(levels[0]).toBe(1);
    for (let index = 1; index < levels.length; index += 1) {
      expect(levels[index] - levels[index - 1], `heading ${index}`).toBeLessThanOrEqual(1);
    }
    expect(levels.filter((level) => level === 2).length).toBeGreaterThanOrEqual(
      fixtureLesson.steps.length,
    );
  });
});
