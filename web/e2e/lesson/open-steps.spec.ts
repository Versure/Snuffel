import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures';
import {
  exerciseBlock,
  exerciseStep,
  navLink,
  nextExercise,
  settle,
  solveExercise,
} from './actions';
import { openExerciseLesson, waitForStepAnchor } from './fixture';

// Issue 13: in a lesson it is clear how far you are, and a step that is easy to miss (the next
// exercise of a series, a quiz further down) is never overlooked. Central, so it works the same
// for every lesson: the homework fixture stands in for all of them.

const anchor = `#stap-${exerciseStep.id}`;

function lessonBar(page: Page) {
  return page.getByRole('progressbar', { name: 'Voortgang in deze les' });
}

function openSteps(page: Page) {
  return page.locator('.finished a.open-step');
}

test.describe('how far a child is in a lesson', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('a new lesson shows 0 of 4 steps and lists every step as not begun at the end', async ({
    page,
  }) => {
    await openExerciseLesson(page);
    await expect(lessonBar(page)).toHaveAttribute('aria-valuetext', '0 van 4 stappen klaar');
    await expect(openSteps(page)).toHaveText([
      /Naar stap 1, Uitleg: Stukjes pizza bij elkaar\s*,\s*nog niet begonnen/,
      /Naar stap 2, Oefenen: Oefenen\s*,\s*nog niet begonnen/,
      /Naar stap 3, Quiz: Quiz\s*,\s*nog niet begonnen/,
      /Naar stap 4, Zelf doen: Zelf doen\s*,\s*nog niet begonnen/,
    ]);
  });

  test('a half-done series says bezig, shows the exercises left and leads back to them', async ({
    page,
  }) => {
    await openExerciseLesson(page, { hash: anchor });
    await waitForStepAnchor(page, anchor);
    const block = exerciseBlock(page);
    const seriesBar = block.getByRole('progressbar', { name: 'Opgaven' });
    await expect(seriesBar).toHaveAttribute('aria-valuetext', '0 van 4 opgaven klaar');

    await solveExercise(page, 'gelijke-noemers');
    await expect(seriesBar).toHaveAttribute('aria-valuetext', '1 van 4 opgaven klaar');
    await expect(block.locator('.remaining')).toHaveText('Er komen nog 3 opgaven.');
    await nextExercise(page);
    await settle(page);

    // The step is begun, not done: the navigation and the end of the lesson both say so.
    await expect(navLink(page, 2, 'Oefenen', 'started')).toBeVisible();
    await expect(lessonBar(page)).toHaveAttribute('aria-valuetext', '0 van 4 stappen klaar');
    const oefenen = openSteps(page).filter({ hasText: 'Naar stap 2, Oefenen' });
    await expect(oefenen).toContainText('bezig');
    await expect(oefenen).toHaveClass(/started/);

    // The link at the end takes the child back to the exercise.
    await page.getByRole('heading', { name: 'Woordenlijst' }).scrollIntoViewIfNeeded();
    await oefenen.click();
    await expect(page.locator(`${anchor}-titel`)).toBeFocused();
    await expect(page).toHaveURL(new RegExp(`${anchor}$`));
  });

  test('finishing the series counts the step and takes it off the list', async ({ page }) => {
    await openExerciseLesson(page, { hash: anchor });
    await waitForStepAnchor(page, anchor);
    for (const id of ['gelijke-noemers', 'ongelijke-noemers', 'recept', 'kies-de-som']) {
      await solveExercise(page, id);
      await nextExercise(page);
    }
    await expect(navLink(page, 2, 'Oefenen', true)).toBeVisible();
    await expect(lessonBar(page)).toHaveAttribute('aria-valuetext', '1 van 4 stappen klaar');
    await expect(openSteps(page).filter({ hasText: 'Naar stap 2, Oefenen' })).toHaveCount(0);
    await expect(openSteps(page)).toHaveCount(3);
  });
});
