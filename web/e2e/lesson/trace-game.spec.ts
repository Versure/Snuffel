import type { Page } from '@playwright/test';
import { plainText } from '../../src/app/shared/inline-text/inline-markup';
import { expect, test } from '../fixtures';
import {
  chooseRight,
  chooseWrong,
  choiceButton,
  currentPattern,
  game,
  gameBlock,
  gameScreen,
  gameStep,
  gameTedText,
  navLink,
  playWholeGame,
  section,
  settle,
  startGame,
  storedRecords,
} from './actions';
import { fixtureLesson, normalize, openLesson } from './fixture';

const ted = fixtureLesson.ted;
const resultsPattern = '**/api/collections/interaction_results/records**';

function previous(page: Page) {
  return section(page, gameStep.id).locator('.previous');
}

function points(page: Page) {
  return gameScreen(page).locator('polyline').getAttribute('points');
}

test.describe('the trace game', () => {
  test('the choices come from the lesson with their labels', async ({ page }) => {
    await openLesson(page, { hash: '#stap-spel' });
    const buttons = gameBlock(page).locator('button.choice');
    await expect(buttons).toHaveCount(game.choices.length);
    for (const [index, choice] of game.choices.entries()) {
      await expect(buttons.nth(index)).toHaveText(plainText(choice.label));
      await expect(buttons.nth(index)).toHaveAttribute('data-color', choice.color);
      await expect(buttons.nth(index)).toBeDisabled();
    }
    await expect(gameBlock(page).locator('.rounds')).toHaveText(`${game.rounds} rondes`);
  });

  test('the line is drawn over time and the choices open when it is done', async ({ page }) => {
    await openLesson(page, { hash: '#stap-spel' });
    const before = await points(page);
    const started = Date.now();
    await gameBlock(page).getByRole('button', { name: 'Start', exact: true }).click();
    await expect(gameScreen(page)).toHaveAttribute('data-drawing', 'true');
    await expect(choiceButton(page, game.choices[0].id)).toBeDisabled();
    expect(await gameTedText(page)).toBe('Voel mee… wat gebeurt er aan je lijn?');
    // Halfway the line is still growing: its last point is left of the end of the screen.
    await expect.poll(async () => (await points(page)) !== before).toBe(true);
    const lastX = async () => Number((await points(page))?.split(' ').at(-1)?.split(',')[0]);
    expect(await lastX()).toBeLessThan(200);

    await expect(choiceButton(page, game.choices[0].id)).toBeEnabled({
      timeout: game.durationMs + 5000,
    });
    // Not before durationMs (a little margin for the first frame).
    expect(Date.now() - started).toBeGreaterThanOrEqual(game.durationMs - 100);
    expect(await lastX()).toBe(200);
    await expect(gameScreen(page)).toHaveAttribute('data-drawing', 'false');
    expect(await gameTedText(page)).toBe('Wat was het?');
  });

  test('with reduced motion the line is drawn at once', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openLesson(page, { hash: '#stap-spel' });
    await gameBlock(page).getByRole('button', { name: 'Start', exact: true }).click();
    // At once: no drawing state, the whole line and open choices.
    await expect(choiceButton(page, game.choices[0].id)).toBeEnabled({ timeout: 1000 });
    await expect(gameScreen(page)).toHaveAttribute('data-drawing', 'false');
    const last = (await points(page))?.split(' ').at(-1)?.split(',')[0];
    expect(Number(last)).toBe(200);
    expect(await gameTedText(page)).toBe('Wat was het?');
  });

  test.describe('with reduced motion', () => {
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await openLesson(page, { hash: '#stap-spel' });
    });

    test('a right choice makes Ted happy with the explanation', async ({ page }) => {
      await startGame(page);
      const pattern = await currentPattern(page);
      await chooseRight(page);
      const said = await gameTedText(page);
      const line = ted.correct.map(plainText).find((candidate) => said.startsWith(candidate));
      expect(line, said).toBeDefined();
      expect(said).toBe(normalize(`${line} ${plainText(pattern.explanation)}`));
      await expect(gameBlock(page).locator('snf-ted-says snf-ted svg')).toHaveCSS(
        '--m-ogen-blij',
        'inline',
      );
      await expect(gameBlock(page).locator('.catch svg.fish')).toHaveCount(1);
    });

    test('a wrong choice makes Ted say oops and names the right answer', async ({ page }) => {
      await startGame(page);
      const pattern = await currentPattern(page);
      await chooseWrong(page);
      const right = game.choices.find((choice) => choice.id === pattern.answer)!;
      const said = await gameTedText(page);
      const line = ted.incorrect.map(plainText).find((candidate) => said.startsWith(candidate));
      expect(line, said).toBeDefined();
      expect(said).toBe(
        normalize(`${line} Het was: ${plainText(right.label)}. ${plainText(pattern.explanation)}`),
      );
      await expect(gameBlock(page).locator('snf-ted-says snf-ted svg')).toHaveCSS(
        '--m-mond-oeps',
        'inline',
      );
      await expect(gameBlock(page).locator('.catch svg.fish')).toHaveCount(0);
    });

    test('Bekijk nog eens draws the line again', async ({ page }) => {
      await startGame(page);
      const pattern = await currentPattern(page);
      const drawn = await points(page);
      // Without reduced motion the line starts over and grows again.
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await gameBlock(page).getByRole('button', { name: 'Bekijk nog eens' }).click();
      await expect(gameScreen(page)).toHaveAttribute('data-drawing', 'true');
      await expect(choiceButton(page, pattern.answer)).toBeDisabled();
      await expect(choiceButton(page, pattern.answer)).toBeEnabled({
        timeout: game.durationMs + 5000,
      });
      expect((await currentPattern(page)).id).toBe(pattern.id);
      expect(await points(page)).toBe(drawn);
    });

    test('a whole game has as many rounds as the lesson says', async ({ page }) => {
      const seen = new Set<string>();
      await gameBlock(page).getByRole('button', { name: 'Start', exact: true }).click();
      for (let round = 0; round < game.rounds; round += 1) {
        if (round > 0) {
          await gameBlock(page).getByRole('button', { name: 'Volgende', exact: true }).click();
        }
        await expect(gameBlock(page).locator('.rounds')).toHaveText(
          `Ronde ${round + 1} van ${game.rounds}`,
        );
        await expect(choiceButton(page, game.choices[0].id)).toBeEnabled();
        seen.add((await currentPattern(page)).id);
        await chooseRight(page);
      }
      await expect(gameBlock(page).locator('.rounds')).toHaveText(
        `${game.rounds} van ${game.rounds} goed`,
      );
      // Every pattern came at least once (there are more rounds than patterns).
      expect([...seen].sort()).toEqual(game.patterns.map((pattern) => pattern.id).sort());
    });

    test('after the last round Ted shows the score', async ({ page }) => {
      await playWholeGame(page, [0]);
      const total = game.rounds;
      await expect(gameBlock(page).locator('.rounds')).toHaveText(`${total - 1} van ${total} goed`);
      expect(await gameTedText(page)).toContain(
        `${total - 1} van ${total} goed. Jij voelt het verschil al!`,
      );
      // Ted is cool: his sunglasses are on.
      const face = gameBlock(page).locator('snf-ted-says snf-ted svg');
      await expect(face).not.toHaveCSS('--m-bril', 'none');
      await expect(face).not.toHaveCSS('--m-ogen-blij', 'inline');
      await expect(gameBlock(page).locator('.catch svg.fish')).toHaveCount(total - 1);
      await expect(gameBlock(page).getByRole('button', { name: 'Volgende' })).toHaveCount(0);
    });

    test('Nog een potje starts a new game', async ({ page }) => {
      await playWholeGame(page, [0, 1, 2]);
      expect(await gameTedText(page)).toContain(
        'Speel nog een keer, dan voel je het verschil steeds beter.',
      );
      await gameBlock(page).getByRole('button', { name: 'Nog een potje', exact: true }).click();
      await expect(gameBlock(page).locator('.rounds')).toHaveText(`Ronde 1 van ${game.rounds}`);
      await expect(gameBlock(page).locator('.catch svg.fish')).toHaveCount(0);
      await expect(gameBlock(page)).not.toContainText('Jouw keuze');
      await expect(choiceButton(page, game.choices[0].id)).toBeEnabled();
    });

    test('a finished game is stored as one result', async ({ page }) => {
      await playWholeGame(page, [1, 4]);
      await expect.poll(async () => (await storedRecords(page)).interaction_results.length).toBe(1);
      const [result] = (await storedRecords(page)).interaction_results;
      expect(result).toMatchObject({
        lesson_id: fixtureLesson.id,
        interaction_id: gameStep.interaction.id,
        kind: 'trace-game',
        score: game.rounds - 2,
        total: game.rounds,
        content_version: fixtureLesson.version,
      });
      const rounds = (result['detail'] as { rounds: Record<string, unknown>[] }).rounds;
      expect(rounds).toHaveLength(game.rounds);
      expect(rounds.map((round) => round['correct'])).toEqual(
        Array.from({ length: game.rounds }, (_, index) => index !== 1 && index !== 4),
      );
    });

    test('finishing a game fills the Spel circle', async ({ page }) => {
      await expect(navLink(page, 2, 'Spel', false)).toBeVisible();
      await startGame(page);
      await chooseRight(page);
      // Started after the first answer, not yet done.
      await expect
        .poll(async () =>
          (await storedRecords(page)).lesson_progress.map((record) => record['status']),
        )
        .toEqual(['started']);
      await expect(navLink(page, 2, 'Spel', 'started')).toBeVisible();
      await gameBlock(page).getByRole('button', { name: 'Volgende', exact: true }).click();
      for (let round = 1; round < game.rounds; round += 1) {
        await expect(choiceButton(page, game.choices[0].id)).toBeEnabled();
        await chooseRight(page);
        if (round < game.rounds - 1) {
          await gameBlock(page).getByRole('button', { name: 'Volgende', exact: true }).click();
        }
      }
      await expect(navLink(page, 2, 'Spel', true)).toBeVisible();
    });

    test('the circle and the previous result are still there after a reload', async ({ page }) => {
      await expect(previous(page)).toHaveCount(0);
      await playWholeGame(page, [3, 5]);
      await expect(navLink(page, 2, 'Spel', true)).toBeVisible();
      await settle(page);
      await page.reload();
      await expect(navLink(page, 2, 'Spel', true)).toBeVisible();
      await expect(previous(page)).toHaveText(
        `Vorige keer: ${game.rounds - 2} van ${game.rounds} goed.`,
      );
      // A new game starts at Start.
      await expect(gameBlock(page).getByRole('button', { name: 'Start' })).toBeVisible();
    });

    test('a result that cannot be saved shows a message', async ({ page }) => {
      await page.route(resultsPattern, (route) =>
        route.request().method() === 'POST'
          ? route.fulfill({ status: 503, contentType: 'application/json', body: '{}' })
          : route.continue(),
      );
      await playWholeGame(page);
      await expect(section(page, gameStep.id).getByRole('alert')).toHaveText(
        'Je score is niet bewaard.',
      );
      // The score stays on the page and the step is begun, not done.
      await expect(gameBlock(page).locator('.rounds')).toHaveText(
        `${game.rounds} van ${game.rounds} goed`,
      );
      await expect(navLink(page, 2, 'Spel', 'started')).toBeVisible();
      await page.unroute(resultsPattern);
      expect((await storedRecords(page)).interaction_results).toEqual([]);
    });

    test('when progress cannot be loaded the game stays playable and nothing is stored', async ({
      page,
    }) => {
      const pattern =
        /\/api\/collections\/(lesson_progress|quiz_attempts|checklist_states|interaction_results)\/records/;
      await page.route(pattern, (route) =>
        route.request().method() === 'GET'
          ? route.fulfill({ status: 503, contentType: 'application/json', body: '{}' })
          : route.continue(),
      );
      await page.reload();
      const stepSection = section(page, gameStep.id);
      await expect(stepSection.locator('.unavailable')).toContainText(
        'Je voortgang kan ik nu niet ophalen.',
      );
      await expect(stepSection.getByRole('button', { name: 'Opnieuw' })).toBeVisible();
      // Still playable.
      await playWholeGame(page, [2]);
      await expect(gameBlock(page).locator('.rounds')).toHaveText(
        `${game.rounds - 1} van ${game.rounds} goed`,
      );
      await page.unroute(pattern);
      expect((await storedRecords(page)).interaction_results).toEqual([]);
    });

    test('a second child does not see the result of the first', async ({ page, browser }) => {
      await playWholeGame(page);
      await expect.poll(async () => (await storedRecords(page)).interaction_results.length).toBe(1);
      const other = await browser.newPage({ baseURL: test.info().project.use.baseURL });
      try {
        await other.emulateMedia({ reducedMotion: 'reduce' });
        await openLesson(other, { hash: '#stap-spel' });
        await expect(gameBlock(other).getByRole('button', { name: 'Start' })).toBeVisible();
        await expect(previous(other)).toHaveCount(0);
        await expect(navLink(other, 2, 'Spel', false)).toBeVisible();
        expect((await storedRecords(other)).interaction_results).toEqual([]);
      } finally {
        await other.close();
      }
    });
  });

  test('the trace game is loaded as a separate file when the lesson opens', async ({ page }) => {
    const scripts: { url: string; body: Promise<string> }[] = [];
    page.on('response', (response) => {
      if (response.url().endsWith('.js')) {
        scripts.push({ url: response.url(), body: response.text().catch(() => '') });
      }
    });
    await openLesson(page, { hash: '#stap-spel' });
    await expect(gameBlock(page).locator('button.choice').first()).toBeVisible();
    const bodies = await Promise.all(
      scripts.map(async (script) => ({ url: script.url, body: await script.body })),
    );
    const withGame = bodies.filter((script) => script.body.includes('snf-trace-game'));
    expect(withGame.map((script) => script.url)).toHaveLength(1);
    // Its own file: not the main bundle and not the file of the lesson page.
    expect(withGame[0].body).not.toContain('snf-lesson-step');
    expect(withGame[0].url).not.toMatch(/\/main[-.]/);
  });
});
