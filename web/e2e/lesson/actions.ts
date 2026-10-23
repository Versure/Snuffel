import type { Locator, Page } from '@playwright/test';
import type {
  PracticeStep,
  QuizQuestion,
  QuizStep,
} from '../../src/app/core/content/content.types';
import { plainText } from '../../src/app/shared/inline-text/inline-markup';
import { expect } from '../fixtures';
import { fixtureLesson, normalize } from './fixture';

// Shared steps of the progress, quiz and checklist tests.

export const quiz = fixtureLesson.steps.find((step): step is QuizStep => step.type === 'quiz')!;
export const practice = fixtureLesson.steps.find(
  (step): step is PracticeStep => step.type === 'practice',
)!;

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
    };
  });
}

/** The visible text of the feedback of a question. */
export async function feedbackText(page: Page, question: QuizQuestion): Promise<string> {
  return normalize(await questionBlock(page, question).locator('.feedback').innerText());
}
