import type { Locator, Page } from '@playwright/test';
import { expect } from '../fixtures';
import { currentBaseURL, type TestAccount } from '../support/accounts';
import {
  storeChecklist,
  storeInteractionResult,
  storeQuizAttempts,
  storeStepStatuses,
} from '../support/progress';
import { logout, openAs, proeflesTitle, wholeBreuken, wholeProefles } from '../overview/pages';

export { logout, openAs, proeflesTitle };

/** The seeded parent account (pocketbase/seed/dev-accounts.json). */
export const parentUsername = 'ouder';

export const breukenTitle = 'Proefles: breuken optellen';

/** Logs in as the parent and lands on `path`, loaded. */
export async function openAsParent(page: Page, path: string): Promise<void> {
  await openAs(page, parentUsername, path);
}

/** Opens the page of a child as the parent and waits for its name as the heading. */
export async function openChildPage(page: Page, account: TestAccount): Promise<void> {
  await openAsParent(page, `/ouder/${account.id}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(account.name);
}

/** The card of a child on /ouder, found by its (unique) name. */
export function childCard(page: Page, name: string): Locator {
  return page.locator('snf-child-card').filter({ has: page.getByRole('heading', { name }) });
}

/** The row of a lesson on the page of a child. */
export function childLesson(page: Page, title: string): Locator {
  return page
    .locator('snf-child-lesson')
    .filter({ has: page.getByRole('heading', { name: title }) });
}

/** The detail (`dt` with its `dd` lines) of a step in a lesson row, whitespace collapsed. */
export async function detailText(row: Locator, stepTitle: string): Promise<string> {
  const text = await row
    .locator('.detail')
    .filter({ has: row.page().locator('dt', { hasText: `${stepTitle}:` }) })
    .innerText();
  return text.replace(/\s+/g, ' ').trim();
}

export function clearButton(row: Locator): Locator {
  return row.getByRole('button', { name: 'Voortgang wissen', exact: true });
}

/** Clicks "Voortgang wissen" and waits for the question, which has the focus. */
export async function askToClear(row: Locator): Promise<Locator> {
  await clearButton(row).click();
  const question = row.getByRole('group');
  await expect(question).toBeFocused();
  return question;
}

export const quizIds = {
  proefles: ['schokken-terug', 'dood-gewicht', 'te-vroeg-slap', 'groen-sliertje'],
  breuken: ['welke-noemer', 'eerst-doen', 'half-als-kommagetal'],
} as const;

/**
 * Stores progress of one lesson in all four collections, as the child: every step completed, an
 * answer per quiz question, a ticked checklist item and a game or exercise result.
 */
export async function storeWholeLesson(
  account: TestAccount,
  lesson: 'proefles' | 'proefles-breuken',
): Promise<void> {
  const baseURL = currentBaseURL();
  const isProefles = lesson === 'proefles';
  await storeStepStatuses(baseURL, account, isProefles ? wholeProefles : wholeBreuken);
  await storeQuizAttempts(
    baseURL,
    account,
    (isProefles ? quizIds.proefles : quizIds.breuken).map((questionId) => ({
      lessonId: lesson,
      questionId,
      optionId: 'x',
      correct: false,
    })),
  );
  await storeChecklist(
    baseURL,
    account,
    lesson,
    'zelf-doen',
    isProefles ? ['vispas'] : ['maatbeker'],
  );
  await storeInteractionResult(
    baseURL,
    account,
    isProefles
      ? { lessonId: lesson, interactionId: 'voel-spel', kind: 'trace-game', score: 5, total: 8 }
      : {
          lessonId: lesson,
          interactionId: 'breuken',
          kind: 'stepped-exercise',
          score: 2,
          total: 4,
          detail: { exercises: [] },
        },
  );
}
