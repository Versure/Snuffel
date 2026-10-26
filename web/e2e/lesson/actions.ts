import type { Locator, Page } from '@playwright/test';
import type {
  InteractionStep,
  PracticeStep,
  QuizQuestion,
  QuizStep,
  SteppedExerciseConfig,
  TraceGameConfig,
  TypingDrillConfig,
} from '../../src/app/core/content/content.types';
import { expect } from '../fixtures';
import { readableText, spokenText } from '../support/readable-text';
import { exerciseLesson, fixtureLesson, normalize, typingLesson } from './fixture';

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

/** The trace game (config) of a game step; the helpers below use it for any lesson. */
export function gameConfig(step: InteractionStep): TraceGameConfig {
  if (step.interaction.kind !== 'trace-game') throw new Error(`${step.id} is not a trace game`);
  return step.interaction.config;
}

export function section(page: Page, stepId: string): Locator {
  return page.locator(`section#stap-${stepId}`);
}

// Every helper below takes the step it works on as its last parameter (the quiz, checklist or
// game step of any lesson) and works on the proefles by default.

/** The question block (`snf-quiz-question`) of a question of the quiz (default: the proefles). */
export function questionBlock(page: Page, question: QuizQuestion, step: QuizStep = quiz): Locator {
  return section(page, step.id)
    .locator('snf-quiz-question')
    .filter({ has: page.getByRole('group', { name: spokenText(question.prompt) }) });
}

/** The button of an option of a question. */
export function optionButton(
  page: Page,
  question: QuizQuestion,
  optionId: string,
  step: QuizStep = quiz,
): Locator {
  const option = question.options.find((candidate) => candidate.id === optionId)!;
  return questionBlock(page, question, step)
    .locator('button.option')
    .filter({ has: page.locator('.option-text', { hasText: spokenText(option.text) }) });
}

export function rightOption(question: QuizQuestion): string {
  return question.correctOptionId;
}

export function wrongOption(question: QuizQuestion): string {
  return question.options.find((option) => option.id !== question.correctOptionId)!.id;
}

/** Answers a question and waits until its feedback is shown. */
export async function answer(
  page: Page,
  question: QuizQuestion,
  optionId: string,
  step: QuizStep = quiz,
): Promise<void> {
  await optionButton(page, question, optionId, step).click();
  await expect(questionBlock(page, question, step).locator('.feedback')).toBeVisible();
}

/** Answers every question: right ones by default, or wrong where `wrong` says so. */
export async function answerAll(
  page: Page,
  wrong: readonly string[] = [],
  step: QuizStep = quiz,
): Promise<void> {
  for (const question of step.questions) {
    await answer(
      page,
      question,
      wrong.includes(question.id) ? wrongOption(question) : rightOption(question),
      step,
    );
  }
}

/** The checkbox of an item of a checklist (default: the proefles). */
export function checkbox(page: Page, itemId: string, step: PracticeStep = practice): Locator {
  const item = step.items.find((candidate) => candidate.id === itemId)!;
  return section(page, step.id).getByRole('checkbox', { name: spokenText(item.text) });
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
 * can still be loading and push it down). `stepId` is the explanation step (default `uitleg`).
 */
export async function readExplanation(page: Page, stepId = 'uitleg'): Promise<void> {
  const marker = section(page, stepId).locator('.end-marker');
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
export async function feedbackText(
  page: Page,
  question: QuizQuestion,
  step: QuizStep = quiz,
): Promise<string> {
  return normalize(await questionBlock(page, question, step).locator('.feedback').innerText());
}

// The trace game (voel-spel) of the fixture.

/** The game in the lesson (`snf-trace-game`). */
export function gameBlock(page: Page, step: InteractionStep = gameStep): Locator {
  return section(page, step.id).locator('snf-trace-game');
}

/** The screen of the game; `data-pattern` is the pattern on it (plan M9, question 7). */
export function gameScreen(page: Page, step: InteractionStep = gameStep): Locator {
  return gameBlock(page, step).getByRole('img', {
    name: 'Hengel en een lijn die laat zien hoe hard er getrokken wordt',
  });
}

/** The button of a choice of the game. */
export function choiceButton(
  page: Page,
  choiceId: string,
  step: InteractionStep = gameStep,
): Locator {
  return gameBlock(page, step).locator(`button.choice[data-choice="${choiceId}"]`);
}

/** What Ted says in the game, whitespace collapsed. */
export async function gameTedText(page: Page, step: InteractionStep = gameStep): Promise<string> {
  return normalize(await gameBlock(page, step).locator('.say').innerText());
}

/** Taps Start and waits until the choices are open. */
export async function startGame(page: Page, step: InteractionStep = gameStep): Promise<void> {
  await gameBlock(page, step).getByRole('button', { name: 'Start', exact: true }).click();
  await expect(choiceButton(page, gameConfig(step).choices[0].id, step)).toBeEnabled();
}

/** The pattern on the screen and the id of its right choice. */
export async function currentPattern(page: Page, step: InteractionStep = gameStep) {
  const id = await gameScreen(page, step).getAttribute('data-pattern');
  const pattern = gameConfig(step).patterns.find((candidate) => candidate.id === id);
  if (!pattern) throw new Error(`unknown pattern "${id}"`);
  return pattern;
}

/** Chooses the right answer for the pattern on the screen. */
export async function chooseRight(page: Page, step: InteractionStep = gameStep): Promise<void> {
  const pattern = await currentPattern(page, step);
  await choiceButton(page, pattern.answer, step).click();
  await expect(choiceButton(page, pattern.answer, step)).toContainText('Jouw keuze');
}

/** Chooses a wrong answer for the pattern on the screen; returns its id. */
export async function chooseWrong(page: Page, step: InteractionStep = gameStep): Promise<string> {
  const pattern = await currentPattern(page, step);
  const wrong = gameConfig(step).choices.find((choice) => choice.id !== pattern.answer)!.id;
  await choiceButton(page, wrong, step).click();
  await expect(choiceButton(page, wrong, step)).toContainText('Jouw keuze');
  return wrong;
}

/**
 * Plays a whole game from Start (or Nog een potje): right answers, except the rounds (0-based)
 * in `wrong`. Fast with reduced motion; also works without, by waiting for each line.
 */
export async function playWholeGame(
  page: Page,
  wrong: readonly number[] = [],
  step: InteractionStep = gameStep,
): Promise<void> {
  const config = gameConfig(step);
  const block = gameBlock(page, step);
  const again = block.getByRole('button', { name: 'Nog een potje', exact: true });
  if (await again.isVisible()) await again.click();
  else await block.getByRole('button', { name: 'Start', exact: true }).click();
  for (let round = 0; round < config.rounds; round += 1) {
    if (round > 0) await block.getByRole('button', { name: 'Volgende', exact: true }).click();
    await expect(block.locator('.rounds')).toHaveText(`Ronde ${round + 1} van ${config.rounds}`);
    await expect(choiceButton(page, config.choices[0].id, step)).toBeEnabled();
    if (wrong.includes(round)) await chooseWrong(page, step);
    else await chooseRight(page, step);
  }
  await expect(block.getByRole('button', { name: 'Nog een potje', exact: true })).toBeVisible();
}

// The stepped exercise (breuken optellen) of the practice fixture.

export const exerciseStep = exerciseLesson.steps.find(
  (step): step is InteractionStep =>
    step.type === 'interaction' && step.interaction.kind === 'stepped-exercise',
)!;
export const exercises = (exerciseStep.interaction.config as SteppedExerciseConfig).exercises;

/** The right answer of every exercise of the fixture, as a child types it or the option id. */
export const rightAnswers: Record<string, string> = {
  'gelijke-noemers': '3/5',
  'ongelijke-noemers': '5/6',
  recept: '0,75',
  'kies-de-som': 'half-en-kwart',
};

/** The exercise block (`snf-stepped-exercise`) in the lesson. */
export function exerciseBlock(page: Page): Locator {
  return section(page, exerciseStep.id).locator('snf-stepped-exercise');
}

/** The card of one exercise, by its id. */
export function exerciseCard(page: Page, id: string): Locator {
  return exerciseBlock(page).locator(`[data-exercise="${id}"]`);
}

/** What Ted says in the exercise, whitespace collapsed. */
export async function exerciseTedText(page: Page): Promise<string> {
  return readableText(exerciseBlock(page).locator('.say'));
}

/** Types an answer in the input and taps Controleer. */
export async function answerExercise(page: Page, text: string): Promise<void> {
  const block = exerciseBlock(page);
  await block.locator('input.input').fill(text);
  await block.getByRole('button', { name: 'Controleer', exact: true }).click();
}

/** Taps "Hint" / "Nog een hint" until every hint of the exercise is shown. */
export async function askAllHints(page: Page, id: string): Promise<void> {
  const exercise = exercises.find((candidate) => candidate.id === id)!;
  const card = exerciseCard(page, id);
  for (let shown = 0; shown < exercise.hints.length; shown += 1) {
    await card
      .getByRole('button', { name: shown === 0 ? 'Hint' : 'Nog een hint', exact: true })
      .click();
    await expect(card.locator('.hint')).toHaveCount(shown + 1);
  }
}

/** Answers the exercise on screen right (typed, or the right option) and waits for it to close. */
export async function solveExercise(page: Page, id: string): Promise<void> {
  const card = exerciseCard(page, id);
  if (exercises.find((candidate) => candidate.id === id)!.answer.type === 'choice') {
    await card.locator(`button.option[data-option="${rightAnswers[id]}"]`).click();
  } else {
    await answerExercise(page, rightAnswers[id]);
  }
  await expect(card.getByRole('button', { name: /^(Volgende opgave|Klaar)$/ })).toBeVisible();
}

/** Taps Volgende opgave (or Klaar) and waits until the next card (or the end screen) is shown. */
export async function nextExercise(page: Page): Promise<void> {
  const block = exerciseBlock(page);
  const heading = block.locator('.heading');
  const before = await heading.innerText();
  await block.getByRole('button', { name: /^(Volgende opgave|Klaar)$/ }).click();
  await expect(heading).not.toHaveText(before);
}

/** Solves the exercises before `id` (right, on their own) so that `id` is on screen. */
export async function goToExercise(page: Page, id: string): Promise<void> {
  for (const exercise of exercises) {
    if (exercise.id === id) break;
    await solveExercise(page, exercise.id);
    await nextExercise(page);
  }
  await expect(exerciseCard(page, id)).toBeVisible();
}

/** Solves every exercise from the current one on and taps Klaar: the end screen. */
export async function finishSeries(page: Page): Promise<void> {
  const block = exerciseBlock(page);
  // The exercise loads lazily, and the page can be done with its anchor before it is there:
  // wait for the first card, then start at the exercise it shows.
  const heading = block.locator('.heading');
  await expect(heading).toHaveText(/^\s*Opgave \d+ van \d+\s*$/);
  const start = Number(/Opgave (\d+)/.exec(await heading.innerText())![1]) - 1;
  for (const exercise of exercises.slice(start)) {
    await solveExercise(page, exercise.id);
    await nextExercise(page);
  }
  await expect(block.getByRole('heading', { name: 'Klaar!' })).toBeVisible();
}

// The typing drill (blind typen) of the typing fixture.

export const typingStep = typingLesson.steps.find(
  (step): step is InteractionStep =>
    step.type === 'interaction' && step.interaction.kind === 'typing-drill',
)!;
export const typing = typingStep.interaction.config as TypingDrillConfig;
/** Every char of every line: what a whole drill counts as total. */
export const typingTotal = typing.lines.join('').length;

/** The typing drill (`snf-typing-drill`) in the lesson. */
export function drillBlock(page: Page): Locator {
  return section(page, typingStep.id).locator('snf-typing-drill');
}

/** The chars of the line on screen. */
export function drillChars(page: Page): Locator {
  return drillBlock(page).locator('.line .char');
}

/** Taps Start and waits until the first line is there with the focus in the typing field. */
export async function startDrill(page: Page): Promise<void> {
  await drillBlock(page).getByRole('button', { name: 'Start', exact: true }).click();
  await expect(drillBlock(page).locator('.counter')).toHaveText(
    `Regel 1 van ${typing.lines.length}`,
  );
  await expect(drillBlock(page).getByLabel('Typvak')).toBeFocused();
}

/**
 * Types text char by char. With `gap` the (fake) clock of `page.clock` advances that many
 * milliseconds after every key, so the speed of a drill is exact; without it, at full speed.
 */
export async function typeLine(page: Page, text: string, gap?: number): Promise<void> {
  if (gap === undefined) {
    await page.keyboard.type(text);
    return;
  }
  for (const char of text) {
    await page.keyboard.type(char);
    await page.clock.runFor(gap);
  }
}

/** Types every line of the drill, right; `gap` as in `typeLine`. */
export async function typeAll(page: Page, gap?: number): Promise<void> {
  for (const line of typing.lines) await typeLine(page, line, gap);
  await expect(drillBlock(page).getByRole('heading', { name: 'Klaar!' })).toBeVisible();
}

/** A char that is not the char of `char`, on the same row of the keyboard (still a key). */
export function otherChar(char: string): string {
  return char === 'x' ? 'z' : 'x';
}
