import AxeBuilder from '@axe-core/playwright';
import type { Locator, Page } from '@playwright/test';
import { expect, test } from '../fixtures';
import { readableText, spokenText } from '../support/readable-text';
import {
  exerciseBlock,
  exerciseCard,
  exercises,
  exerciseStep,
  goToExercise,
  section,
} from './actions';
import { exerciseLesson, openExerciseLesson } from './fixture';

// {{a/b}} in lesson text is a stacked fraction (MathML), read in words by a screen reader, and
// the exercise shows how a typed fraction is read. All on the practice fixture (proefhuiswerk).

const exerciseAnchor = `#stap-${exerciseStep.id}`;
const reading = 'Zo lees ik jouw antwoord:';

interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
  height: number;
}

interface Geometry {
  numerator: Box;
  denominator: Box;
  whole: Box | null;
  fraction: Box;
  texts: string[];
  fontFamily: string;
  color: string;
  textColor: string;
  overflowX: boolean;
}

/** Where the parts of a stacked fraction (`snf-fraction`) are on screen, and how they look. */
async function geometry(fraction: Locator): Promise<Geometry> {
  return fraction.evaluate((host) => {
    const box = (element: Element): Box => {
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        height: rect.height,
      };
    };
    const mfrac = host.querySelector('mfrac')!;
    const [numerator, denominator] = [...mfrac.children];
    const whole = [...host.querySelectorAll('math > mn')][0] ?? null;
    return {
      numerator: box(numerator),
      denominator: box(denominator),
      whole: whole ? box(whole) : null,
      fraction: box(mfrac),
      texts: [...host.querySelectorAll('mn')].map((mn) => mn.textContent ?? ''),
      fontFamily: getComputedStyle(numerator).fontFamily,
      color: getComputedStyle(numerator).color,
      textColor: getComputedStyle(host.parentElement!).color,
      overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });
}

/** The numerator is above the denominator, with room for the bar between them. */
function expectStacked(shape: Geometry, label: string): void {
  expect(shape.numerator.bottom, `${label}: numerator above denominator`).toBeLessThan(
    shape.denominator.top,
  );
  expect(shape.numerator.height, `${label}: numerator has height`).toBeGreaterThan(0);
  expect(shape.denominator.height, `${label}: denominator has height`).toBeGreaterThan(0);
  // The bar sits in that gap: the fraction is taller than its two numbers together.
  expect(shape.fraction.height, `${label}: bar between`).toBeGreaterThan(
    shape.numerator.height + shape.denominator.height,
  );
  // Centred above each other, not side by side.
  expect(shape.numerator.left, label).toBeLessThan(shape.denominator.right);
  expect(shape.numerator.right, label).toBeGreaterThan(shape.denominator.left);
}

/** The text block of the lesson with the mixed number. */
const mixedText = exerciseLesson.steps
  .flatMap((step) => ('blocks' in step ? step.blocks : []))
  .map((block) => ('text' in block ? block.text : ''))
  .find((text) => text.includes('{{1 1/2}}'))!;

function lessonText(page: Page): Locator {
  return section(page, 'uitleg');
}

/** The paragraph of the text block that holds the mixed number {{1 1/2}}. */
function mixedParagraph(page: Page): Locator {
  return lessonText(page).locator('snf-inline-text', { hasText: 'Anderhalve liter is' });
}

function input(page: Page): Locator {
  return exerciseBlock(page).locator('input.input');
}

function readingLine(page: Page): Locator {
  return exerciseBlock(page).locator('.reading');
}

test.describe('fractions in lesson text', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('a {{a/b}} in lesson text is a stacked fraction', async ({ page }) => {
    await openExerciseLesson(page, { hash: '#stap-uitleg' });
    // The text block: "Dat schrijf je als {{3/5}}" in the example, and the exercise prompt.
    const example = lessonText(page).locator('snf-fraction').first();
    await expect(example.locator('math mfrac')).toBeVisible();
    await expect(example.locator('mfrac > mn')).toHaveText(['3', '5']);
    expectStacked(await geometry(example), 'example 3/5');

    const prompt = exerciseCard(page, 'gelijke-noemers').locator('.prompt');
    await expect(prompt).toBeVisible();
    const parts = prompt.locator('snf-fraction');
    await expect(parts).toHaveCount(2);
    await expect(parts.nth(0).locator('mfrac > mn')).toHaveText(['1', '5']);
    await expect(parts.nth(1).locator('mfrac > mn')).toHaveText(['2', '5']);
    expectStacked(await geometry(parts.nth(0)), 'prompt 1/5');
    expectStacked(await geometry(parts.nth(1)), 'prompt 2/5');
    // A plain number next to a fraction is no fraction: "+" is text.
    expect(await readableText(prompt)).toBe('Hoeveel is 1 vijfde + 2 vijfde?');
  });

  test('{{1 1/2}} is a mixed number: the whole number left of the fraction', async ({ page }) => {
    await openExerciseLesson(page, { hash: '#stap-uitleg' });
    const paragraph = mixedParagraph(page);
    // The same paragraph has a second, simple fraction: the mixed number comes first.
    const mixed = paragraph.locator('snf-fraction').first();
    await expect(paragraph.locator('snf-fraction')).toHaveCount(2);
    await expect(mixed.locator('mn')).toHaveText(['1', '1', '2']);
    const shape = await geometry(mixed);
    expectStacked(shape, 'mixed 1 1/2');
    expect(shape.whole, 'whole number').not.toBeNull();
    // Left of the fraction, with visible room between them: 1 1/2 never looks like 11/2.
    expect(
      shape.fraction.left - shape.whole!.right,
      'room between the whole number and the fraction',
    ).toBeGreaterThanOrEqual(1);
    // On the line of the fraction, not above or below it.
    expect(shape.whole!.top).toBeLessThan(shape.fraction.bottom);
    expect(shape.whole!.bottom).toBeGreaterThan(shape.fraction.top);
  });

  test('a screen reader reads the fraction in words', async ({ page }) => {
    await openExerciseLesson(page, { hash: '#stap-uitleg' });
    // The MathML is hidden from the screen reader; the words are in visually hidden text.
    await expect(lessonText(page).locator('snf-fraction math').first()).toHaveAttribute(
      'aria-hidden',
      'true',
    );
    const mixed = mixedParagraph(page);
    expect(await readableText(mixed)).toContain('Anderhalve liter is 1 en 1 half liter, of 1,5');
    await expect(mixed).toMatchAriaSnapshot(`- text: ${JSON.stringify(spokenText(mixedText))}`);

    const prompt = exerciseCard(page, 'gelijke-noemers').locator('.prompt');
    await expect(prompt).toBeVisible();
    // The aria snapshot puts a space around a box that is not inline (here before the "?"): the
    // visually hidden words are positioned absolutely, so they are a block, even in an inline host.
    await expect(prompt).toMatchAriaSnapshot('- paragraph: Hoeveel is 1 vijfde + 2 vijfde ?');
    // Every text of the exercise reads the way the content says it, with the fractions in words.
    const first = exercises[0];
    expect(await readableText(prompt)).toBe(spokenText(first.prompt));
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`the fraction has the font and colour of the text (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      await openExerciseLesson(page, { hash: '#stap-uitleg' });
      const fraction = lessonText(page).locator('snf-fraction').first();
      await expect(fraction).toBeVisible();
      const shape = await geometry(fraction);
      expect(shape.fontFamily).toMatch(/^"?Atkinson Hyperlegible/);
      expect(shape.color).toBe(shape.textColor);
      // The bar is there: the numbers are apart from each other by more than a hairline.
      expect(shape.denominator.top - shape.numerator.bottom).toBeGreaterThan(0);
      // The colour follows the theme: light text on a dark page, dark text on a light page.
      const [red, green, blue] = shape.color.match(/\d+(\.\d+)?/g)!.map(Number);
      const luminance = (red + green + blue) / 3;
      if (scheme === 'dark') expect(luminance).toBeGreaterThan(128);
      else expect(luminance).toBeLessThan(128);
    });
  }

  test('fractions fit on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await openExerciseLesson(page, { hash: '#stap-uitleg' });
    const fractions = lessonText(page).locator('snf-fraction');
    await expect(fractions.first()).toBeVisible();
    const count = await fractions.count();
    expect(count).toBeGreaterThan(3);
    // No horizontal scroll in the lesson, and no fraction breaks inside itself.
    const noScroll = () =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      );
    expect(await noScroll(), 'lesson').toBe(true);
    for (let index = 0; index < count; index += 1) {
      const shape = await geometry(fractions.nth(index));
      expectStacked(shape, `fraction ${index}`);
      expect(shape.fraction.right, `fraction ${index} inside the screen`).toBeLessThanOrEqual(375);
      expect(shape.fraction.left, `fraction ${index} inside the screen`).toBeGreaterThanOrEqual(0);
    }
    expect(await fractions.first().evaluate((host) => getComputedStyle(host).whiteSpace)).toBe(
      'nowrap',
    );
    expect(await fractions.first().evaluate((host) => host.getClientRects().length)).toBe(1);

    // The exercise with a typed mixed number: no horizontal scroll either.
    await expect(input(page)).toBeVisible();
    await input(page).fill('1 11/12');
    await expect(readingLine(page)).toBeVisible();
    expect(await noScroll(), 'exercise').toBe(true);
    const typed = await geometry(readingLine(page).locator('snf-fraction'));
    expect(typed.fraction.right).toBeLessThanOrEqual(375);
  });
});

test.describe('the exercise shows how a typed fraction is read', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('3/5 gives a stacked 3/5 and "Zo lees ik jouw antwoord: 3 vijfde"', async ({ page }) => {
    await openExerciseLesson(page, { hash: exerciseAnchor });
    const card = exerciseCard(page, 'gelijke-noemers');
    await expect(readingLine(page)).toHaveCount(0);
    await card.locator('input.input').fill('3/5');
    const line = readingLine(page);
    await expect(line).toBeVisible();
    await expect(line).toContainText(reading);
    await expect(line.locator('snf-fraction mfrac > mn')).toHaveText(['3', '5']);
    expectStacked(await geometry(line.locator('snf-fraction')), 'reading 3/5');
    expect(await readableText(line)).toBe(`${reading} 3 vijfde`);
    // It is the description of the input (read after its name), and not a live region.
    await expect(card.locator('input.input')).toHaveAccessibleDescription(
      /Zo lees ik jouw antwoord: 3 vijfde/,
    );
    const described = await card.locator('input.input').getAttribute('aria-describedby');
    expect(described).toContain((await line.getAttribute('id')) ?? 'missing');
    await expect(line).not.toHaveAttribute('aria-live', /./);
    await expect(line.locator('[aria-live]')).toHaveCount(0);
    // No fraction in the reading text of the text: the typed text is shown as typed.
    await expect(card.locator('input.input')).toHaveValue('3/5');
  });

  test('1 1/4 is a mixed number and 11/4 is eleven quarters', async ({ page }) => {
    await openExerciseLesson(page, { hash: exerciseAnchor });
    const card = exerciseCard(page, 'gelijke-noemers');
    await card.locator('input.input').fill('1 1/4');
    const line = readingLine(page);
    await expect(line.locator('snf-fraction math > mn')).toHaveText(['1']);
    await expect(line.locator('snf-fraction mfrac > mn')).toHaveText(['1', '4']);
    const mixed = await geometry(line.locator('snf-fraction'));
    expect(mixed.whole).not.toBeNull();
    expect(
      mixed.fraction.left - mixed.whole!.right,
      'room between the whole number and the fraction',
    ).toBeGreaterThanOrEqual(1);
    expect(await readableText(line)).toBe(`${reading} 1 en 1 vierde`);

    await card.locator('input.input').fill('11/4');
    await expect(line.locator('snf-fraction math > mn')).toHaveCount(0);
    await expect(line.locator('snf-fraction mfrac > mn')).toHaveText(['11', '4']);
    expect(await readableText(line)).toBe(`${reading} 11 vierde`);
    // Spaces around the slash are read as the same fraction.
    await card.locator('input.input').fill('3 / 5');
    await expect(line.locator('snf-fraction mfrac > mn')).toHaveText(['3', '5']);
  });

  test('words, a decimal, an empty field and a zero denominator give no line', async ({ page }) => {
    await openExerciseLesson(page, { hash: exerciseAnchor });
    const card = exerciseCard(page, 'gelijke-noemers');
    await card.locator('input.input').fill('3/5');
    await expect(readingLine(page)).toBeVisible();
    for (const typed of ['drie vijfde', '0,6', '', '3/0', 'abc']) {
      await card.locator('input.input').fill(typed);
      await expect(readingLine(page), `"${typed}"`).toHaveCount(0);
      await expect(card.locator('input.input')).toHaveAccessibleDescription(/^(?!.*Zo lees ik)/);
      // Back to a fraction: the line comes back.
      await card.locator('input.input').fill('3/5');
      await expect(readingLine(page)).toBeVisible();
    }
  });

  test('a number answer drops its unit; a decimal gives no line', async ({ page }) => {
    await openExerciseLesson(page, { hash: exerciseAnchor });
    // The first two are solved to get to "recept".
    await goToExercise(page, 'recept');
    const card = exerciseCard(page, 'recept');
    await card.locator('input.input').fill('3/4 liter');
    const line = readingLine(page);
    await expect(line.locator('snf-fraction mfrac > mn')).toHaveText(['3', '4']);
    expect(await readableText(line)).toBe(`${reading} 3 vierde`);
    await card.locator('input.input').fill('0,75');
    await expect(line).toHaveCount(0);
    await card.locator('input.input').fill('0.75 liter');
    await expect(line).toHaveCount(0);
  });

  test('the line stays after a right answer', async ({ page }) => {
    await openExerciseLesson(page, { hash: exerciseAnchor });
    const card = exerciseCard(page, 'gelijke-noemers');
    await card.locator('input.input').fill('3/5');
    await card.getByRole('button', { name: 'Controleer', exact: true }).click();
    await expect(card.getByRole('button', { name: 'Volgende opgave' })).toBeVisible();
    await expect(card.locator('input.input')).toBeDisabled();
    await expect(readingLine(page)).toBeVisible();
    await expect(readingLine(page).locator('snf-fraction mfrac > mn')).toHaveText(['3', '5']);
  });

  test('a choice exercise has no line', async ({ page }) => {
    await openExerciseLesson(page, { hash: exerciseAnchor });
    await goToExercise(page, 'kies-de-som');
    await expect(exerciseCard(page, 'kies-de-som').locator('button.option')).toHaveCount(3);
    await expect(readingLine(page)).toHaveCount(0);
  });
});

test.describe('fractions: accessibility', () => {
  for (const scheme of ['light', 'dark'] as const) {
    test(`the lesson with fractions has no axe violations in light and dark (${scheme})`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      await openExerciseLesson(page, { hash: '#stap-uitleg' });
      await expect(lessonText(page).locator('snf-fraction').first()).toBeVisible();
      const lesson = await new AxeBuilder({ page }).analyze();
      expect(lesson.violations, `lesson, ${scheme}`).toEqual([]);

      // The exercise with a visible reading (a mixed number, the widest), and the reading small.
      await expect(exerciseCard(page, 'gelijke-noemers').locator('input.input')).toBeVisible();
      await input(page).fill('1 1/4');
      await expect(readingLine(page)).toBeVisible();
      const exercise = await new AxeBuilder({ page }).analyze();
      expect(exercise.violations, `exercise with reading, ${scheme}`).toEqual([]);
      const size = await readingLine(page).evaluate((line) => {
        const box = line.getBoundingClientRect();
        return { height: box.height, left: box.left, right: box.right };
      });
      expect(size.height).toBeGreaterThan(0);
      expect(size.right).toBeLessThanOrEqual(page.viewportSize()!.width);
    });
  }

  test('the fixture still has the texts these tests look for', async () => {
    // Guard for the tests above: the fixture still has the texts they look for.
    expect(JSON.stringify(exerciseLesson)).toContain('{{1 1/2}}');
    expect(exercises[0].prompt).toBe('Hoeveel is {{1/5}} + {{2/5}}?');
  });
});
