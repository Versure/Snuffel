import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures';
import { readableText, spokenText } from '../support/readable-text';
import {
  answerExercise,
  askAllHints,
  exerciseBlock,
  exerciseCard,
  exerciseStep,
  exerciseTedText,
  exercises,
  finishSeries,
  goToExercise,
  navLink,
  nextExercise,
  section,
  settle,
  solveExercise,
  storedRecords,
} from './actions';
import { exerciseLesson, openExerciseLesson, waitForStepAnchor } from './fixture';

const ted = exerciseLesson.ted;
const resultsPattern = '**/api/collections/interaction_results/records**';
const anchor = `#stap-${exerciseStep.id}`;

function exercise(id: string) {
  return exercises.find((candidate) => candidate.id === id)!;
}

function previous(page: Page) {
  return section(page, exerciseStep.id).locator('.previous');
}

function oefenenLink(page: Page, done: boolean | 'started') {
  return navLink(page, 2, 'Oefenen', done);
}

/** Whether what Ted says starts with one of the lines. */
function startsWithLine(said: string, lines: readonly string[]): boolean {
  return lines.map(spokenText).some((line) => said.startsWith(line));
}

test.describe('the stepped exercise', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('shows the first exercise with its input and Controleer', async ({ page }) => {
    await openExerciseLesson(page, { hash: anchor });
    const card = exerciseCard(page, 'gelijke-noemers');
    await expect(card.locator('.heading')).toHaveText('Opgave 1 van 4');
    await expect
      .poll(() => readableText(card.locator('.prompt')))
      .toBe('Hoeveel is 1 vijfde + 2 vijfde?');
    await expect(card.locator('input.input')).toBeVisible();
    await expect(card.getByRole('button', { name: 'Controleer', exact: true })).toBeVisible();
    await expect(card.locator('.solution-later')).toHaveText(
      'De uitwerking kun je zien als je het zelf geprobeerd hebt en alle hints hebt bekeken.',
    );
  });

  test('a number within the tolerance is right, with a comma, a point or a fraction', async ({
    page,
  }) => {
    await openExerciseLesson(page, { hash: anchor });
    // 0.76 is within the tolerance 0.01; 3/4 and 0.75 liter are the same number as 0,75.
    for (const typed of ['0,75', '0.75 liter', '3/4', '0,76', ' 0,74 Liter ']) {
      await page.reload();
      await waitForStepAnchor(page, anchor);
      await goToExercise(page, 'recept');
      const card = exerciseCard(page, 'recept');
      await expect(card.locator('.unit')).toHaveText('liter');
      await answerExercise(page, typed);
      await expect(card.getByRole('button', { name: 'Volgende opgave' }), typed).toBeVisible();
      expect(startsWithLine(await exerciseTedText(page), ted.correct), typed).toBe(true);
      await expect(card.locator('input.input')).toBeDisabled();
    }
    // 0,8 is 0.05 away: wrong, and the child can try again.
    await page.reload();
    await waitForStepAnchor(page, anchor);
    await goToExercise(page, 'recept');
    const card = exerciseCard(page, 'recept');
    await answerExercise(page, '0,8');
    expect(await exerciseTedText(page)).toContain('Probeer het nog eens, of vraag een hint.');
    expect(startsWithLine(await exerciseTedText(page), ted.incorrect)).toBe(true);
    await expect(card.locator('input.input')).toBeEnabled();
    await expect(card.getByRole('button', { name: 'Volgende opgave' })).toHaveCount(0);
    await answerExercise(page, '0,751');
    await expect(card.getByRole('button', { name: 'Volgende opgave' })).toBeVisible();
  });

  test('every accepted form is right', async ({ page }) => {
    await openExerciseLesson(page, { hash: anchor });
    for (const typed of ['3/5', 'Drie vijfde.', '3 / 5', '  DRIE   vijfde ']) {
      await page.reload();
      await waitForStepAnchor(page, anchor);
      const card = exerciseCard(page, 'gelijke-noemers');
      await answerExercise(page, typed);
      await expect(card.getByRole('button', { name: 'Volgende opgave' }), typed).toBeVisible();
      expect(startsWithLine(await exerciseTedText(page), ted.correct), typed).toBe(true);
    }
    // Something that is not accepted stays open (for a text exercise, 0,6 is just wrong).
    await page.reload();
    await waitForStepAnchor(page, anchor);
    await answerExercise(page, '0,6');
    await expect(exerciseCard(page, 'gelijke-noemers').locator('input.input')).toBeEnabled();
    expect(startsWithLine(await exerciseTedText(page), ted.incorrect)).toBe(true);
  });

  test('a common mistake gets its own feedback', async ({ page }) => {
    await openExerciseLesson(page, { hash: anchor });
    await answerExercise(page, '3/10');
    expect(await exerciseTedText(page)).toBe(
      spokenText(exercise('gelijke-noemers').commonMistakes[0].feedback),
    );
    await expect(exerciseBlock(page).locator('snf-ted-says snf-ted svg')).toHaveCSS(
      '--m-mond-denk',
      'inline',
    );
    // The input stays open: another try is right.
    await answerExercise(page, '3/5');
    await expect(
      exerciseBlock(page).getByRole('button', { name: 'Volgende opgave' }),
    ).toBeVisible();
    // A mistake of a choice exercise: the option closes, says Jouw antwoord and explains.
    await nextExercise(page);
    await solveExercise(page, 'ongelijke-noemers');
    await nextExercise(page);
    await solveExercise(page, 'recept');
    await nextExercise(page);
    const card = exerciseCard(page, 'kies-de-som');
    await card.locator('button.option[data-option="los-opgeteld"]').click();
    await expect(card.locator('button.option[data-option="los-opgeteld"]')).toBeDisabled();
    await expect(card.locator('button.option[data-option="los-opgeteld"]')).toContainText(
      'Jouw antwoord',
    );
    expect(await exerciseTedText(page)).toBe(
      spokenText(exercise('kies-de-som').commonMistakes[0].feedback),
    );
  });

  test('hints come one at a time and steps open on request', async ({ page }) => {
    await openExerciseLesson(page, { hash: anchor });
    await goToExercise(page, 'ongelijke-noemers');
    const card = exerciseCard(page, 'ongelijke-noemers');
    const hints = exercise('ongelijke-noemers').hints;
    await expect(card.locator('.hint')).toHaveCount(0);
    for (const [shown, hint] of hints.entries()) {
      await card
        .getByRole('button', { name: shown === 0 ? 'Hint' : 'Nog een hint', exact: true })
        .click();
      await expect(card.locator('.hint')).toHaveCount(shown + 1);
      await expect
        .poll(() => readableText(card.locator('.hint').nth(shown)))
        .toContain(spokenText(hint));
    }
    // After the last hint: no hint button, and the focus is on that hint.
    await expect(card.getByRole('button', { name: /hint/i })).toHaveCount(0);
    await expect(card.locator('.hint').last()).toBeFocused();

    // Steps: before any attempt, each on its own, open and closed again.
    const steps = exercise('ongelijke-noemers').steps;
    const toggle = (index: number) => card.locator('button.step-toggle').nth(index);
    await expect(card.locator('button.step-toggle')).toHaveCount(steps.length);
    for (const index of steps.keys()) {
      await expect(toggle(index)).toHaveAttribute('aria-expanded', 'false');
      await expect(card.locator('.step-text').nth(index)).toBeHidden();
    }
    await toggle(0).click();
    await expect(toggle(0)).toHaveAttribute('aria-expanded', 'true');
    await expect(card.locator('.step-text').nth(0)).toBeVisible();
    await expect
      .poll(() => readableText(card.locator('.step-text').nth(0)))
      .toContain(spokenText(steps[0].text));
    await expect(toggle(1)).toHaveAttribute('aria-expanded', 'false');
    await expect(card.locator('.step-text').nth(1)).toBeHidden();
    await toggle(1).click();
    await expect(card.locator('.step-text').nth(1)).toBeVisible();
    await toggle(0).click();
    await expect(toggle(0)).toHaveAttribute('aria-expanded', 'false');
    await expect(card.locator('.step-text').nth(0)).toBeHidden();
    await expect(card.locator('.step-text').nth(1)).toBeVisible();
  });

  test('the worked solution only comes after an own attempt and all hints', async ({ page }) => {
    await openExerciseLesson(page, { hash: anchor });
    await goToExercise(page, 'ongelijke-noemers');
    const card = exerciseCard(page, 'ongelijke-noemers');
    const button = card.getByRole('button', { name: 'Bekijk de uitwerking' });
    const later = card.locator('.solution-later');

    // Nothing yet: not even all hints are enough without an attempt.
    await expect(button).toHaveCount(0);
    await expect(later).toBeVisible();
    await askAllHints(page, 'ongelijke-noemers');
    await expect(button).toHaveCount(0);
    await expect(later).toBeVisible();
    await expect(card.locator('.solution')).toHaveCount(0);

    // An attempt and all hints: now.
    await answerExercise(page, '1/6');
    await expect(button).toBeVisible();
    await expect(later).toHaveCount(0);
    await button.click();
    const solution = card.locator('.solution');
    await expect(solution).toBeFocused();
    await expect(solution).toContainText('Uitwerking');
    await expect
      .poll(() => readableText(solution))
      .toContain(spokenText(exercise('ongelijke-noemers').workedSolution));
    // The exercise is finished with the solution.
    await expect(card.getByRole('button', { name: 'Volgende opgave' })).toBeVisible();
  });

  test('the worked solution waits for the hints that are left after an attempt', async ({
    page,
  }) => {
    await openExerciseLesson(page, { hash: anchor });
    await goToExercise(page, 'ongelijke-noemers');
    const card = exerciseCard(page, 'ongelijke-noemers');
    await answerExercise(page, '1/6');
    await expect(card.getByRole('button', { name: 'Bekijk de uitwerking' })).toHaveCount(0);
    await card.getByRole('button', { name: 'Hint', exact: true }).click();
    await card.getByRole('button', { name: 'Nog een hint', exact: true }).click();
    await expect(card.getByRole('button', { name: 'Bekijk de uitwerking' })).toHaveCount(0);
    await card.getByRole('button', { name: 'Nog een hint', exact: true }).click();
    await expect(card.getByRole('button', { name: 'Bekijk de uitwerking' })).toBeVisible();
  });

  test('without hints the solution comes after one attempt, and after a right answer', async ({
    page,
  }) => {
    await openExerciseLesson(page, { hash: anchor });
    // Exercise 1 has hints; a right answer opens the solution at once.
    await solveExercise(page, 'gelijke-noemers');
    await expect(
      exerciseCard(page, 'gelijke-noemers').getByRole('button', { name: 'Bekijk de uitwerking' }),
    ).toBeVisible();
    await nextExercise(page);
    await solveExercise(page, 'ongelijke-noemers');
    await nextExercise(page);
    await solveExercise(page, 'recept');
    await nextExercise(page);
    // The choice exercise has one hint: after one attempt and that hint.
    const card = exerciseCard(page, 'kies-de-som');
    await card.locator('button.option[data-option="twee-kwart"]').click();
    await expect(card.getByRole('button', { name: 'Bekijk de uitwerking' })).toHaveCount(0);
    await askAllHints(page, 'kies-de-som');
    await expect(card.getByRole('button', { name: 'Bekijk de uitwerking' })).toBeVisible();
  });

  test('an unreadable answer is no attempt', async ({ page }) => {
    await openExerciseLesson(page, { hash: anchor });
    await goToExercise(page, 'recept');
    const card = exerciseCard(page, 'recept');
    const input = card.locator('input.input');
    await askAllHints(page, 'recept');

    // Empty.
    await input.focus();
    await page.keyboard.press('Enter');
    await expect(card.locator('.notice')).toHaveText('Vul eerst een antwoord in.');
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await expect(input).toBeFocused();
    await card.getByRole('button', { name: 'Controleer', exact: true }).click();
    await expect(card.locator('.notice')).toHaveText('Vul eerst een antwoord in.');
    // A tap on Controleer also puts the focus in the input, so the message is read out.
    await expect(input).toBeFocused();
    // Unreadable.
    await answerExercise(page, 'abc');
    await expect(card.locator('.notice')).toHaveText(
      'Dat kan ik niet lezen als getal. Schrijf bijvoorbeeld 0,75 of 3/4.',
    );
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await expect(input).toBeFocused();
    const described = await input.getAttribute('aria-describedby');
    expect(described).toContain((await card.locator('.notice').getAttribute('id')) ?? 'x');
    // Other unit: unreadable too.
    await answerExercise(page, '0,75 meter');
    await expect(card.locator('.notice')).toBeVisible();
    // No reaction of Ted, no solution (all hints are shown, but there was no attempt),
    // and no result was stored.
    await expect(card.locator('.say')).toHaveCount(0);
    await expect(card.getByRole('button', { name: 'Bekijk de uitwerking' })).toHaveCount(0);
    await settle(page);
    expect((await storedRecords(page)).interaction_results).toEqual([]);
    // A readable wrong answer is an attempt: the solution comes, the notice is gone.
    await answerExercise(page, '0,8');
    await expect(card.locator('.notice')).toHaveCount(0);
    await expect(card.getByRole('button', { name: 'Bekijk de uitwerking' })).toBeVisible();
  });

  test('finishing the exercises fills the Oefenen circle and stores one result', async ({
    page,
  }) => {
    await openExerciseLesson(page, { hash: anchor });
    await expect(oefenenLink(page, false)).toBeVisible();

    // Exercise 1: one wrong answer, all hints, the solution; the others right on their own.
    await answerExercise(page, '1');
    await expect
      .poll(async () =>
        (await storedRecords(page)).lesson_progress.map((record) => record['status']),
      )
      .toEqual(['started']);
    await askAllHints(page, 'gelijke-noemers');
    await exerciseCard(page, 'gelijke-noemers')
      .getByRole('button', { name: 'Bekijk de uitwerking' })
      .click();
    await nextExercise(page);
    await solveExercise(page, 'ongelijke-noemers');
    await nextExercise(page);
    await solveExercise(page, 'recept');
    await nextExercise(page);
    await solveExercise(page, 'kies-de-som');
    // Begun, not done until Klaar.
    await expect(oefenenLink(page, 'started')).toBeVisible();
    expect((await storedRecords(page)).interaction_results).toEqual([]);
    await nextExercise(page);

    const block = exerciseBlock(page);
    await expect(block.getByRole('heading', { name: 'Klaar!' })).toBeVisible();
    expect(await exerciseTedText(page)).toContain('3 van 4 zelf goed.');
    expect(await exerciseTedText(page)).toContain(
      'Kijk de uitwerkingen nog eens rustig na. Morgen gaat het nog beter.',
    );
    await expect(oefenenLink(page, true)).toBeVisible();
    await settle(page);

    const { interaction_results: results, lesson_progress: progress } = await storedRecords(page);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      lesson_id: exerciseLesson.id,
      interaction_id: exerciseStep.interaction.id,
      kind: 'stepped-exercise',
      score: 3,
      total: 4,
      content_version: exerciseLesson.version,
    });
    const detail = (results[0]['detail'] as { exercises: Record<string, unknown>[] }).exercises;
    expect(detail).toHaveLength(4);
    expect(detail.map((item) => item['id'])).toEqual(exercises.map((item) => item.id));
    expect(detail[0]).toMatchObject({
      id: 'gelijke-noemers',
      correct: false,
      attempts: 1,
      hints: 2,
      solution: true,
    });
    expect(detail.slice(1).map((item) => item['correct'])).toEqual([true, true, true]);
    expect(progress.some((record) => record['status'] === 'completed')).toBe(true);
  });

  test('all exercises right on their own gives Ted cool and "Nog een keer" starts again', async ({
    page,
  }) => {
    await openExerciseLesson(page, { hash: anchor });
    await finishSeries(page);
    expect(await exerciseTedText(page)).toContain('4 van 4 zelf goed.');
    // Ted is cool, with a line of the lesson after the score.
    const said = await exerciseTedText(page);
    expect(ted.correct.map(spokenText).some((line) => said.endsWith(line))).toBe(true);
    await expect(exerciseBlock(page).locator('snf-ted-says snf-ted svg')).not.toHaveCSS(
      '--m-bril',
      'none',
    );
    await exerciseBlock(page).getByRole('button', { name: 'Nog een keer', exact: true }).click();
    await expect(exerciseBlock(page).locator('.heading')).toHaveText('Opgave 1 van 4');
    await expect(exerciseBlock(page).locator('input.input')).toHaveValue('');
    await expect(exerciseBlock(page).locator('.hint')).toHaveCount(0);
    await settle(page);
    // The second series is stored too, as its own record.
    await finishSeries(page);
    await settle(page);
    await expect.poll(async () => (await storedRecords(page)).interaction_results.length).toBe(2);
  });

  test('the circle and the previous result are still there after a reload', async ({ page }) => {
    await openExerciseLesson(page, { hash: anchor });
    await expect(previous(page)).toHaveCount(0);
    await finishSeries(page);
    await expect(oefenenLink(page, true)).toBeVisible();
    await settle(page);
    await page.reload();
    await waitForStepAnchor(page, anchor);
    await expect(oefenenLink(page, true)).toBeVisible();
    await expect(previous(page)).toHaveText('Vorige keer: 4 van 4 goed.');
    // A new series starts at the first exercise.
    await expect(exerciseBlock(page).locator('.heading')).toHaveText('Opgave 1 van 4');
  });

  test('a second child does not see the result of the first', async ({ page, browser }) => {
    await openExerciseLesson(page, { hash: anchor });
    await finishSeries(page);
    await expect.poll(async () => (await storedRecords(page)).interaction_results.length).toBe(1);
    const other = await browser.newPage({ baseURL: test.info().project.use.baseURL });
    try {
      await other.emulateMedia({ reducedMotion: 'reduce' });
      await openExerciseLesson(other, { hash: anchor });
      await expect(exerciseBlock(other).locator('.heading')).toHaveText('Opgave 1 van 4');
      await expect(previous(other)).toHaveCount(0);
      await expect(oefenenLink(other, false)).toBeVisible();
      expect((await storedRecords(other)).interaction_results).toEqual([]);
    } finally {
      await other.close();
    }
  });

  test('typing before the step anchor arrives keeps the focus in the input', async ({ page }) => {
    // Slow progress keeps the page unstable, so the anchor only arrives later.
    await page.route(resultsPattern, async (route) => {
      if (route.request().method() === 'GET') {
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
      await route.continue();
    });
    await openExerciseLesson(page, { hash: anchor });
    const card = exerciseCard(page, 'gelijke-noemers');
    const input = card.locator('input.input');
    await input.click();
    await page.keyboard.type('3/');
    await expect(input).toBeFocused();
    // Well after STEP_SCROLL_MAX_WAIT_MS and the slow progress: the focus is still there.
    await page.waitForTimeout(4000);
    await expect(input).toBeFocused();
    await expect(page.locator(`${anchor}-titel`)).not.toBeFocused();
    await page.keyboard.type('5');
    await expect(input).toHaveValue('3/5');
    await page.unroute(resultsPattern);
  });

  test('a result that cannot be saved shows a message', async ({ page }) => {
    await openExerciseLesson(page, { hash: anchor });
    await page.route(resultsPattern, (route) =>
      route.request().method() === 'POST'
        ? route.fulfill({ status: 503, contentType: 'application/json', body: '{}' })
        : route.continue(),
    );
    await finishSeries(page);
    await expect(section(page, exerciseStep.id).getByRole('alert')).toHaveText(
      'Je score is niet bewaard.',
    );
    // The score stays on the page and the step is not done.
    expect(await exerciseTedText(page)).toContain('4 van 4 zelf goed.');
    await expect(oefenenLink(page, false)).toBeVisible();
    await page.unroute(resultsPattern);
    expect((await storedRecords(page)).interaction_results).toEqual([]);
  });

  test('the stepped exercise is loaded as a separate file when the lesson opens', async ({
    page,
  }) => {
    const scripts: { url: string; body: Promise<string> }[] = [];
    page.on('response', (response) => {
      if (response.url().endsWith('.js')) {
        scripts.push({ url: response.url(), body: response.text().catch(() => '') });
      }
    });
    await openExerciseLesson(page, { hash: anchor });
    await expect(exerciseBlock(page).locator('input.input')).toBeVisible();
    const bodies = await Promise.all(
      scripts.map(async (script) => ({ url: script.url, body: await script.body })),
    );
    const withExercise = bodies.filter((script) => script.body.includes('snf-stepped-exercise'));
    expect(withExercise.map((script) => script.url)).toHaveLength(1);
    expect(withExercise[0].body).not.toContain('snf-lesson-step');
    expect(withExercise[0].url).not.toMatch(/\/main[-.]/);
  });

  test('the exercise can be done with the keyboard', async ({ page }) => {
    await openExerciseLesson(page, { hash: anchor });
    const block = exerciseBlock(page);
    const expectRing = async (label: string) => {
      const outline = await page.evaluate(() => {
        const style = getComputedStyle(document.activeElement as Element);
        return { style: style.outlineStyle, width: style.outlineWidth };
      });
      expect(outline.style, label).not.toBe('none');
      expect(outline.width, label).toBe('3px');
    };
    const tabTo = async (target: ReturnType<typeof block.locator>, label: string) => {
      for (let step = 0; step < 8; step += 1) {
        await page.keyboard.press('Tab');
        if (await target.evaluate((element) => element === document.activeElement)) break;
      }
      await expect(target, label).toBeFocused();
      await expectRing(label);
    };
    const card = exerciseCard(page, 'gelijke-noemers');
    await card.locator('.heading').focus();
    await tabTo(card.locator('input.input'), 'input');
    await page.keyboard.type('3/10');
    // Enter checks; the focus goes to Ted's reaction.
    await page.keyboard.press('Enter');
    await expect(card.locator('.say')).toBeFocused();
    expect(await exerciseTedText(page)).toBe(
      spokenText(exercise('gelijke-noemers').commonMistakes[0].feedback),
    );
    // A hint with Space, a step with Enter.
    await tabTo(card.getByRole('button', { name: 'Hint', exact: true }), 'Hint');
    await page.keyboard.press('Space');
    await expect(card.locator('.hint')).toHaveCount(1);
    // The same button stays focused and now says Nog een hint.
    await expect(card.getByRole('button', { name: 'Nog een hint', exact: true })).toBeFocused();
    await tabTo(card.locator('button.step-toggle'), 'step');
    await page.keyboard.press('Enter');
    await expect(card.locator('button.step-toggle')).toHaveAttribute('aria-expanded', 'true');
    // The right answer by keyboard, then Volgende opgave.
    await card.locator('input.input').focus();
    await page.keyboard.press('Control+A');
    await page.keyboard.type('3/5');
    await page.keyboard.press('Enter');
    const next = card.getByRole('button', { name: 'Volgende opgave', exact: true });
    await expect(next).toBeVisible();
    await tabTo(next, 'Volgende opgave');
    await page.keyboard.press('Enter');
    await expect(exerciseCard(page, 'ongelijke-noemers').locator('.heading')).toBeFocused();
    await expect(block.locator('.heading')).toHaveText('Opgave 2 van 4');
  });

  test('a choice exercise is answered with a tap on an option, with the keyboard too', async ({
    page,
  }) => {
    await openExerciseLesson(page, { hash: anchor });
    await goToExercise(page, 'kies-de-som');
    const card = exerciseCard(page, 'kies-de-som');
    await expect(card.locator('button.option')).toHaveCount(3);
    await expect(card.getByRole('button', { name: 'Controleer' })).toHaveCount(0);
    const right = card.locator('button.option[data-option="half-en-kwart"]');
    await right.focus();
    await page.keyboard.press('Enter');
    await expect(card.getByRole('button', { name: 'Klaar', exact: true })).toBeVisible();
    expect(startsWithLine(await exerciseTedText(page), ted.correct)).toBe(true);
  });
});

test.describe('the stepped exercise: accessibility', () => {
  async function expectNoViolations(page: Page, label: string): Promise<void> {
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations, label).toEqual([]);
  }

  /** Every button and input in the exercise that is smaller than 44 × 44 px. */
  async function smallTargets(page: Page) {
    return exerciseBlock(page)
      .locator('button, input, a')
      .evaluateAll((elements) =>
        elements
          .filter((element) => element.getClientRects().length > 0)
          .map((element) => {
            const box = element.getBoundingClientRect();
            return {
              name: (element.textContent ?? '').replace(/\s+/g, ' ').trim() || element.tagName,
              width: box.width,
              height: box.height,
            };
          })
          .filter((size) => size.width < 44 || size.height < 44),
      );
  }

  for (const scheme of ['light', 'dark'] as const) {
    test(`the exercise has no axe violations in every state (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      await openExerciseLesson(page, { hash: anchor });
      await expectNoViolations(page, `open exercise, ${scheme}`);
      expect(await smallTargets(page), 'open').toEqual([]);

      // A wrong answer, a known mistake, an unreadable answer (on the number exercise).
      await answerExercise(page, '3/10');
      await expectNoViolations(page, `mistake, ${scheme}`);
      await answerExercise(page, 'kat');
      await askAllHints(page, 'gelijke-noemers');
      await exerciseCard(page, 'gelijke-noemers').locator('button.step-toggle').click();
      await expectNoViolations(page, `hints and step, ${scheme}`);
      expect(await smallTargets(page), 'hints').toEqual([]);

      // The worked solution.
      await exerciseCard(page, 'gelijke-noemers')
        .getByRole('button', { name: 'Bekijk de uitwerking' })
        .click();
      await expectNoViolations(page, `solution, ${scheme}`);
      expect(await smallTargets(page), 'solution').toEqual([]);

      // The number exercise with a notice, the choice exercise with a wrong option, the end.
      await nextExercise(page);
      await solveExercise(page, 'ongelijke-noemers');
      await nextExercise(page);
      await answerExercise(page, 'abc');
      await expectNoViolations(page, `notice, ${scheme}`);
      expect(await smallTargets(page), 'notice').toEqual([]);
      await solveExercise(page, 'recept');
      await nextExercise(page);
      await exerciseCard(page, 'kies-de-som')
        .locator('button.option[data-option="los-opgeteld"]')
        .click();
      await expectNoViolations(page, `wrong option, ${scheme}`);
      expect(await smallTargets(page), 'wrong option').toEqual([]);
      await solveExercise(page, 'kies-de-som');
      await nextExercise(page);
      await expect(exerciseBlock(page).getByRole('heading', { name: 'Klaar!' })).toBeVisible();
      await settle(page);
      await expectNoViolations(page, `end screen, ${scheme}`);
      expect(await smallTargets(page), 'end').toEqual([]);
    });
  }

  test('no animation longer than 1 ms with prefers-reduced-motion: reduce', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openExerciseLesson(page, { hash: anchor });
    await answerExercise(page, '3/10');
    await askAllHints(page, 'gelijke-noemers');
    await exerciseCard(page, 'gelijke-noemers').locator('button.step-toggle').click();
    await answerExercise(page, '3/5');
    await expect(
      exerciseBlock(page).getByRole('button', { name: 'Volgende opgave' }),
    ).toBeVisible();
    const long = await page.evaluate(() =>
      document
        .getAnimations()
        .filter((animation) => {
          const timing = animation.effect?.getComputedTiming();
          return Number(timing?.duration ?? 0) * Number(timing?.iterations ?? 1) > 1;
        })
        .map((animation) => animation.id || animation.constructor.name),
    );
    expect(long).toEqual([]);
  });
});
