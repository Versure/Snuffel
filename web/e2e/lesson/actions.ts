import type { Locator, Page } from '@playwright/test';
import type {
  InteractionStep,
  PracticeStep,
  QuizQuestion,
  QuizStep,
  TraceGameConfig,
} from '../../src/app/core/content/content.types';
import { plainText } from '../../src/app/shared/inline-text/inline-markup';
import { expect } from '../fixtures';
import { fixtureLesson, normalize } from './fixture';

// Shared steps of the progress, quiz and checklist tests.

export const quiz = fixtureLesson.steps.find((step): step is QuizStep => step.type === 'quiz')!;
export const practice = fixtureLesson.steps.find(
  (step): step is PracticeStep => step.type === 'practice',
)!;

export const gameStep = fixtureLesson.steps.find(
  (step): step is InteractionStep =>
    step.type === 'interaction' && step.interaction.kind === 'trace-game',
)!;
export const game = gameStep.interaction.config as TraceGameConfig;

export function section(page: Page, stepId: string): Locator {
  return page.locator(`section#stap-${stepId}`);
}

/** The question block (`snf-quiz-question`) of a question of the fixture quiz. */
export function questionBlock(page: Page, question: QuizQuestion): Locator {
  return section(page, quiz.id)
    .locator('snf-quiz-question')
    .filter({ has: page.getByRole('group', { name: plainText(question.prompt) }) });
}

/** The button of an option of a question. */
export function optionButton(page: Page, question: QuizQuestion, optionId: string): Locator {
  const option = question.options.find((candidate) => candidate.id === optionId)!;
  return questionBlock(page, question)
    .locator('button.option')
    .filter({ has: page.locator('.option-text', { hasText: plainText(option.text) }) });
}

export function rightOption(question: QuizQuestion): string {
  return question.correctOptionId;
}

export function wrongOption(question: QuizQuestion): string {
  return question.options.find((option) => option.id !== question.correctOptionId)!.id;
}

/** Answers a question and waits until its feedback is shown. */
export async function answer(page: Page, question: QuizQuestion, optionId: string): Promise<void> {
  await optionButton(page, question, optionId).click();
  await expect(questionBlock(page, question).locator('.feedback')).toBeVisible();
}

/** Answers every question: right ones by default, or wrong where `wrong` says so. */
export async function answerAll(page: Page, wrong: readonly string[] = []): Promise<void> {
  for (const question of quiz.questions) {
    await answer(
      page,
      question,
      wrong.includes(question.id) ? wrongOption(question) : rightOption(question),
    );
  }
}

/** The checkbox of an item of the fixture checklist. */
export function checkbox(page: Page, itemId: string): Locator {
  const item = practice.items.find((candidate) => candidate.id === itemId)!;
  return section(page, practice.id).getByRole('checkbox', { name: plainText(item.text) });
}

/** The link of a step in the step navigation, with or without " (klaar)". */
export function navLink(page: Page, number: number, label: string, done: boolean): Locator {
  return page
    .getByRole('navigation', { name: 'Stappen van deze les' })
    .getByRole('link', { name: `Stap ${number}: ${label}${done ? ' (klaar)' : ''}`, exact: true });
}

/**
 * Scrolls the end of the explanation into the middle of the screen, the way a reader gets there,
 * and stays until its circle fills. Scrolls again when the end moved away (the figure above it
 * can still be loading and push it down).
 */
export async function readExplanation(page: Page): Promise<void> {
  const marker = section(page, 'uitleg').locator('.end-marker');
  await expect(async () => {
    await marker.evaluate((element) =>
      element.scrollIntoView({ block: 'center', behavior: 'instant' }),
    );
    await expect(navLink(page, 1, 'Uitleg', true)).toBeVisible({ timeout: 2500 });
  }).toPass({ timeout: 15_000 });
}

/** Waits until every write of the page to PocketBase is done. */
export async function settle(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
}

export interface StoredRecords {
  lesson_progress: Record<string, unknown>[];
  quiz_attempts: Record<string, unknown>[];
  checklist_states: Record<string, unknown>[];
  interaction_results: Record<string, unknown>[];
}

/**
 * Reads the progress records of the logged-in child through the REST API, with the token of its
 * session (from localStorage), the way the app does: only on the app's own host.
 */
export async function storedRecords(page: Page): Promise<StoredRecords> {
  return page.evaluate(async () => {
    const auth = JSON.parse(localStorage.getItem('pocketbase_auth') ?? '{}') as { token?: string };
    const read = async (collection: string) => {
      const response = await fetch(
        `/api/collections/${collection}/records?perPage=200&sort=created`,
        { headers: { Authorization: auth.token ?? '' } },
      );
      if (!response.ok) throw new Error(`${collection}: ${response.status}`);
      return ((await response.json()) as { items: Record<string, unknown>[] }).items;
    };
    return {
      lesson_progress: await read('lesson_progress'),
      quiz_attempts: await read('quiz_attempts'),
      checklist_states: await read('checklist_states'),
      interaction_results: await read('interaction_results'),
    };
  });
}

/** The visible text of the feedback of a question. */
export async function feedbackText(page: Page, question: QuizQuestion): Promise<string> {
  return normalize(await questionBlock(page, question).locator('.feedback').innerText());
}

// The trace game (voel-spel) of the fixture.

/** The game in the lesson (`snf-trace-game`). */
export function gameBlock(page: Page): Locator {
  return section(page, gameStep.id).locator('snf-trace-game');
}

/** The screen of the game; `data-pattern` is the pattern on it (plan M9, question 7). */
export function gameScreen(page: Page): Locator {
  return gameBlock(page).getByRole('img', {
    name: 'Hengel en een lijn die laat zien hoe hard er getrokken wordt',
  });
}

/** The button of a choice of the game. */
export function choiceButton(page: Page, choiceId: string): Locator {
  return gameBlock(page).locator(`button.choice[data-choice="${choiceId}"]`);
}

/** What Ted says in the game, whitespace collapsed. */
export async function gameTedText(page: Page): Promise<string> {
  return normalize(await gameBlock(page).locator('.say').innerText());
}

/** Taps Start and waits until the choices are open. */
export async function startGame(page: Page): Promise<void> {
  await gameBlock(page).getByRole('button', { name: 'Start', exact: true }).click();
  await expect(choiceButton(page, game.choices[0].id)).toBeEnabled();
}

/** The pattern on the screen and the id of its right choice. */
export async function currentPattern(page: Page) {
  const id = await gameScreen(page).getAttribute('data-pattern');
  const pattern = game.patterns.find((candidate) => candidate.id === id);
  if (!pattern) throw new Error(`unknown pattern "${id}"`);
  return pattern;
}

/** Chooses the right answer for the pattern on the screen. */
export async function chooseRight(page: Page): Promise<void> {
  const pattern = await currentPattern(page);
  await choiceButton(page, pattern.answer).click();
  await expect(choiceButton(page, pattern.answer)).toContainText('Jouw keuze');
}

/** Chooses a wrong answer for the pattern on the screen; returns its id. */
export async function chooseWrong(page: Page): Promise<string> {
  const pattern = await currentPattern(page);
  const wrong = game.choices.find((choice) => choice.id !== pattern.answer)!.id;
  await choiceButton(page, wrong).click();
  await expect(choiceButton(page, wrong)).toContainText('Jouw keuze');
  return wrong;
}

/**
 * Plays a whole game from Start (or Nog een potje): right answers, except the rounds (0-based)
 * in `wrong`. Fast with reduced motion; also works without, by waiting for each line.
 */
export async function playWholeGame(page: Page, wrong: readonly number[] = []): Promise<void> {
  const block = gameBlock(page);
  const again = block.getByRole('button', { name: 'Nog een potje', exact: true });
  if (await again.isVisible()) await again.click();
  else await block.getByRole('button', { name: 'Start', exact: true }).click();
  for (let round = 0; round < game.rounds; round += 1) {
    if (round > 0) await block.getByRole('button', { name: 'Volgende', exact: true }).click();
    await expect(block.locator('.rounds')).toHaveText(`Ronde ${round + 1} van ${game.rounds}`);
    await expect(choiceButton(page, game.choices[0].id)).toBeEnabled();
    if (wrong.includes(round)) await chooseWrong(page);
    else await chooseRight(page);
  }
  await expect(block.getByRole('button', { name: 'Nog een potje', exact: true })).toBeVisible();
}
