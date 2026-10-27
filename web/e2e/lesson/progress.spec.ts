import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures';
import { loginAsNewChild } from '../support/accounts';
import { loginAs } from '../support/login';
import {
  answer,
  answerAll,
  checkbox,
  navLink,
  optionButton,
  practice,
  questionBlock,
  quiz,
  readExplanation,
  rightOption,
  section,
  settle,
  storedRecords,
  wrongOption,
} from './actions';
import { fixtureLesson, lessonPath, openLesson } from './fixture';

const collections = ['lesson_progress', 'quiz_attempts', 'checklist_states'];
const [first, second] = quiz.questions;

function doneCircles(page: Page) {
  return page.getByRole('navigation', { name: 'Stappen van deze les' }).locator('li.done');
}

/** Ticks two items, answers every question (the first one wrong) and reads the explanation. */
async function doSomeWork(page: Page): Promise<void> {
  await readExplanation(page);
  await answerAll(page, [first.id]);
  await checkbox(page, practice.items[0].id).check();
  await checkbox(page, practice.items[2].id).check();
  await settle(page);
}

async function expectWorkIsThere(page: Page): Promise<void> {
  await expect(navLink(page, 1, 'Uitleg', true)).toBeVisible();
  await expect(navLink(page, 3, 'Quiz', true)).toBeVisible();
  await expect(navLink(page, 4, 'Zelf doen', 'started')).toBeVisible();
  await expect(checkbox(page, practice.items[0].id)).toBeChecked();
  await expect(checkbox(page, practice.items[1].id)).not.toBeChecked();
  await expect(checkbox(page, practice.items[2].id)).toBeChecked();
  await expect(optionButton(page, first, wrongOption(first))).toContainText('Jouw antwoord');
  await expect(optionButton(page, second, rightOption(second))).toContainText('Jouw antwoord');
  const total = quiz.questions.length;
  await expect(section(page, quiz.id).locator('.score')).toContainText(
    `${total - 1} van ${total} goed.`,
  );
}

async function logout(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Uitloggen' }).click();
  await expect(page).toHaveURL(/\/login/);
}

test.describe('progress in a lesson', () => {
  test('opening a lesson stores nothing', async ({ page }) => {
    const writes: string[] = [];
    page.on('request', (request) => {
      if (request.method() !== 'GET' && request.url().includes('/api/collections/')) {
        if (!request.url().includes('auth-')) writes.push(`${request.method()} ${request.url()}`);
      }
    });
    await openLesson(page);
    // The progress was read (three lists), nothing was written.
    await settle(page);
    const records = await storedRecords(page);
    expect(writes).toEqual([]);
    for (const collection of collections) {
      expect(records[collection as keyof typeof records], collection).toEqual([]);
    }
    await expect(doneCircles(page)).toHaveCount(0);
  });

  test('ticks and step status are still there after a reload', async ({ page }) => {
    await openLesson(page);
    await readExplanation(page);
    await checkbox(page, practice.items[1].id).check();
    await settle(page);
    await page.reload();
    await expect(navLink(page, 1, 'Uitleg', true)).toBeVisible();
    await expect(checkbox(page, practice.items[1].id)).toBeChecked();
    await expect(checkbox(page, practice.items[0].id)).not.toBeChecked();
  });

  test('quiz answers and the score are still there after a reload', async ({ page }) => {
    await openLesson(page, { hash: '#stap-quiz' });
    await questionBlock(page, first).getByRole('button', { name: 'Hint', exact: true }).click();
    await answerAll(page, [first.id]);
    await settle(page);
    await page.reload();
    const block = questionBlock(page, first);
    await expect(optionButton(page, first, wrongOption(first))).toHaveClass(/\bwrong\b/);
    await expect(optionButton(page, first, rightOption(first))).toHaveClass(/\bright\b/);
    await expect(block.locator('.feedback .explanation')).toBeVisible();
    await expect(block.locator('.hint')).toHaveCount(1);
    for (const button of await section(page, quiz.id).locator('button.option').all()) {
      await expect(button).toBeDisabled();
    }
    const total = quiz.questions.length;
    await expect(section(page, quiz.id).locator('.score snf-speech-bubble')).toHaveText(
      `${total - 1} van ${total} goed. Lees de uitleg bij de rode vragen nog eens.`,
    );
  });

  test('progress is still there after logging out and in again', async ({ page }) => {
    const account = await openLesson(page);
    await doSomeWork(page);
    await logout(page);
    await loginAs(page, account!.username, lessonPath);
    await expectWorkIsThere(page);
  });

  test('a second child does not see the ticks, answers or step status of the first', async ({
    page,
  }) => {
    await openLesson(page);
    await doSomeWork(page);
    await logout(page);

    await loginAsNewChild(page, lessonPath);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(fixtureLesson.title);
    await settle(page);
    await expect(doneCircles(page)).toHaveCount(0);
    await expect(section(page, practice.id).getByRole('checkbox', { checked: true })).toHaveCount(
      0,
    );
    await expect(section(page, quiz.id).locator('.feedback, .score')).toHaveCount(0);
    for (const button of await section(page, quiz.id).locator('button.option').all()) {
      await expect(button).toBeEnabled();
    }
    // Through the API as well: the second child gets none of the records of the first.
    const records = await storedRecords(page);
    for (const collection of collections) {
      expect(records[collection as keyof typeof records], collection).toEqual([]);
    }
  });

  test('reading to the end of the explanation fills its circle', async ({ page }) => {
    await openLesson(page);
    await expect(navLink(page, 1, 'Uitleg', false)).toBeVisible();
    await readExplanation(page);
    await expect
      .poll(async () =>
        (await storedRecords(page)).lesson_progress.map((record) => [
          record['step_id'],
          record['status'],
          record['content_version'],
        ]),
      )
      .toEqual([['uitleg', 'completed', fixtureLesson.version]]);
  });

  test('jumping past the explanation leaves its circle empty', async ({ page }) => {
    await openLesson(page);
    await page.getByRole('link', { name: 'Stap 4: Zelf doen' }).click();
    await expect(section(page, practice.id).getByRole('heading', { level: 2 })).toBeFocused();
    // Longer than the time the end of the explanation has to stay in view.
    await page.waitForTimeout(1500);
    await settle(page);
    await expect(navLink(page, 1, 'Uitleg', false)).toBeVisible();
    expect((await storedRecords(page)).lesson_progress).toEqual([]);
  });

  test('every answer is stored as an attempt', async ({ page }) => {
    await openLesson(page, { hash: '#stap-quiz' });
    await questionBlock(page, second).getByRole('button', { name: 'Hint', exact: true }).click();
    await answer(page, first, wrongOption(first));
    await answer(page, second, rightOption(second));
    await expect.poll(async () => (await storedRecords(page)).quiz_attempts.length).toBe(2);
    const attempts = (await storedRecords(page)).quiz_attempts;
    expect(attempts).toEqual([
      expect.objectContaining({
        lesson_id: fixtureLesson.id,
        question_id: first.id,
        option_id: wrongOption(first),
        correct: false,
        hints_used: 0,
        content_version: fixtureLesson.version,
      }),
      expect.objectContaining({
        lesson_id: fixtureLesson.id,
        question_id: second.id,
        option_id: rightOption(second),
        correct: true,
        hints_used: 1,
        content_version: fixtureLesson.version,
      }),
    ]);
  });

  test('a tick that cannot be saved is undone with a message', async ({ page }) => {
    await openLesson(page, { hash: `#stap-${practice.id}` });
    await page.route('**/api/collections/checklist_states/records**', (route) =>
      route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }),
    );
    // click, not check: check() would fail because the app undoes the tick.
    await checkbox(page, practice.items[0].id).click();
    const alert = section(page, practice.id).getByRole('alert');
    await expect(alert).toHaveText('Dat vinkje is niet bewaard. Probeer het zo nog eens.');
    await expect(checkbox(page, practice.items[0].id)).not.toBeChecked();

    // When the server is back, the next tick is saved and the message goes away.
    await page.unroute('**/api/collections/checklist_states/records**');
    await checkbox(page, practice.items[0].id).check();
    await expect(alert).toHaveCount(0);
    await expect
      .poll(async () =>
        (await storedRecords(page)).checklist_states.map((state) => state['checked']),
      )
      .toEqual([[practice.items[0].id]]);
  });

  test('when progress cannot be loaded the quiz and checklist are read-only with a retry', async ({
    page,
  }) => {
    const pattern = /\/api\/collections\/(lesson_progress|quiz_attempts|checklist_states)\/records/;
    await page.route(pattern, (route) =>
      route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }),
    );
    await openLesson(page);
    // The lesson itself is readable.
    await expect(section(page, 'uitleg').locator('snf-block').first()).toBeVisible();
    for (const stepId of [quiz.id, practice.id]) {
      await expect(section(page, stepId).locator('.unavailable')).toContainText(
        'Je voortgang kan ik nu niet ophalen.',
      );
    }
    for (const button of await section(page, quiz.id).locator('button.option').all()) {
      await expect(button).toBeDisabled();
    }
    await expect(section(page, quiz.id).getByRole('button', { name: 'Hint' })).toHaveCount(0);
    for (const box of await section(page, practice.id).getByRole('checkbox').all()) {
      await expect(box).toBeDisabled();
    }

    await page.unroute(pattern);
    await section(page, quiz.id).getByRole('button', { name: 'Opnieuw' }).click();
    await expect(page.locator('.unavailable')).toHaveCount(0);
    await expect(checkbox(page, practice.items[0].id)).toBeEnabled();
    await checkbox(page, practice.items[0].id).check();
    await expect(checkbox(page, practice.items[0].id)).toBeChecked();
    await answer(page, first, rightOption(first));
    await expect.poll(async () => (await storedRecords(page)).quiz_attempts.length).toBe(1);
  });
});
