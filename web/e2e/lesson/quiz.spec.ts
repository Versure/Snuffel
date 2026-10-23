import type { Page } from '@playwright/test';
import { plainText } from '../../src/app/shared/inline-text/inline-markup';
import { expect, test } from '../fixtures';
import {
  answer,
  answerAll,
  feedbackText,
  navLink,
  optionButton,
  questionBlock,
  quiz,
  rightOption,
  section,
  storedRecords,
  wrongOption,
} from './actions';
import { fixtureLesson, normalize, openLesson } from './fixture';

const ted = fixtureLesson.ted;
const [first, second] = quiz.questions;

/** The option texts of every question, in the order they are shown. */
async function shownOrder(page: Page): Promise<string[][]> {
  const orders: string[][] = [];
  for (const question of quiz.questions) {
    const texts = await questionBlock(page, question)
      .locator('button.option .option-text')
      .allInnerTexts();
    orders.push(texts.map(normalize));
  }
  return orders;
}

const contentOrder = quiz.questions.map((question) =>
  question.options.map((option) => plainText(option.text)),
);

test.describe('the quiz', () => {
  test.beforeEach(async ({ page }) => {
    await openLesson(page, { hash: '#stap-quiz' });
  });

  test('every option is there in a shuffled order', async ({ page }) => {
    const orders = await shownOrder(page);
    for (const [index, order] of orders.entries()) {
      expect([...order].sort()).toEqual([...contentOrder[index]].sort());
    }
    // With four questions of four options, all in content order has a chance of 1 in 331 776.
    expect(orders).not.toEqual(contentOrder);
  });

  test('a right answer shows its feedback and Ted is happy', async ({ page }) => {
    await answer(page, first, rightOption(first));
    const chosen = optionButton(page, first, rightOption(first));
    await expect(chosen).toHaveClass(/\bright\b/);
    await expect(chosen).toContainText('Jouw antwoord');
    await expect(chosen).toContainText('Goed antwoord');
    const block = questionBlock(page, first);
    await expect(block.locator('.option.wrong')).toHaveCount(0);
    const option = first.options.find((candidate) => candidate.id === rightOption(first))!;
    await expect(block.locator('.feedback .explanation')).toHaveText(plainText(option.feedback));
    await expect(block.locator('.feedback snf-ted svg')).toHaveCSS('--m-ogen-blij', 'inline');
    const line = normalize(await block.locator('.feedback snf-speech-bubble').innerText());
    expect(ted.correct.map(plainText)).toContain(line);
  });

  test('a wrong answer shows its feedback, marks the right option and Ted says oops', async ({
    page,
  }) => {
    const wrong = wrongOption(first);
    await answer(page, first, wrong);
    const chosen = optionButton(page, first, wrong);
    await expect(chosen).toHaveClass(/\bwrong\b/);
    await expect(chosen).toContainText('Jouw antwoord');
    await expect(chosen).not.toContainText('Goed antwoord');
    const right = optionButton(page, first, rightOption(first));
    await expect(right).toHaveClass(/\bright\b/);
    await expect(right).toContainText('Goed antwoord');
    const block = questionBlock(page, first);
    const option = first.options.find((candidate) => candidate.id === wrong)!;
    await expect(block.locator('.feedback .explanation')).toHaveText(plainText(option.feedback));
    await expect(block.locator('.feedback snf-ted svg')).toHaveCSS('--m-mond-oeps', 'inline');
    const line = normalize(await block.locator('.feedback snf-speech-bubble').innerText());
    expect(ted.incorrect.map(plainText)).toContain(line);
    // Only the feedback of the chosen option.
    const text = await feedbackText(page, first);
    for (const other of first.options.filter((candidate) => candidate.id !== wrong)) {
      expect(text).not.toContain(plainText(other.feedback));
    }
  });

  test('a question can be answered only once per round', async ({ page }) => {
    await answer(page, first, wrongOption(first));
    const buttons = questionBlock(page, first).locator('button.option');
    for (const button of await buttons.all()) await expect(button).toBeDisabled();
    await optionButton(page, first, rightOption(first)).click({ force: true });
    await expect(optionButton(page, first, rightOption(first))).not.toContainText('Jouw antwoord');
    // The other questions are still open.
    for (const button of await questionBlock(page, second).locator('button.option').all()) {
      await expect(button).toBeEnabled();
    }
    await expect.poll(async () => (await storedRecords(page)).quiz_attempts.length).toBe(1);
  });

  test('hints appear one by one on request and are stored with the answer', async ({ page }) => {
    const block = questionBlock(page, first);
    await expect(block.locator('.hint')).toHaveCount(0);
    await block.getByRole('button', { name: 'Hint', exact: true }).click();
    await expect(block.locator('.hint')).toHaveCount(1);
    await expect(block.locator('.hint').first()).toContainText(plainText(first.hints[0]));
    // The fixture has one hint per question: after it, no more hint button.
    await expect(block.getByRole('button', { name: /hint/i })).toHaveCount(0);
    await answer(page, first, rightOption(first));
    await expect(block.locator('.hint')).toHaveCount(1);

    await answer(page, second, rightOption(second));
    await expect
      .poll(async () =>
        (await storedRecords(page)).quiz_attempts.map((attempt) => [
          attempt['question_id'],
          attempt['hints_used'],
        ]),
      )
      .toEqual([
        [first.id, 1],
        [second.id, 0],
      ]);
  });

  test('after the last question Ted shows the score', async ({ page }) => {
    const score = section(page, quiz.id).locator('.score');
    await answer(page, first, wrongOption(first));
    await expect(score).toHaveCount(0);
    for (const question of quiz.questions.slice(1)) {
      await answer(page, question, rightOption(question));
    }
    const total = quiz.questions.length;
    await expect(score.locator('snf-speech-bubble')).toHaveText(
      `${total - 1} van ${total} goed. Lees de uitleg bij de rode vragen nog eens.`,
    );
    await expect(score.locator('snf-ted svg')).toHaveCSS('--m-ogen-blij', 'inline');
    await expect(score.getByRole('button', { name: 'Opnieuw' })).toBeVisible();
  });

  test('all right makes Ted cool', async ({ page }) => {
    await answerAll(page);
    const score = section(page, quiz.id).locator('.score');
    const text = normalize(await score.locator('snf-speech-bubble').innerText());
    const total = quiz.questions.length;
    expect(ted.correct.map((line) => `${total} van ${total} goed. ${plainText(line)}`)).toContain(
      text,
    );
    // Cool Ted wears his sunglasses: no other eyes.
    await expect(score.locator('snf-ted svg')).not.toHaveCSS('--m-ogen-blij', 'inline');
    await expect(score.locator('snf-ted svg')).not.toHaveCSS('--m-bril', 'none');
  });

  test('Opnieuw starts a new round and keeps the stored attempts', async ({ page }) => {
    await answerAll(page, [first.id]);
    await expect
      .poll(async () => (await storedRecords(page)).quiz_attempts.length)
      .toBe(quiz.questions.length);
    const before = await shownOrder(page);

    await section(page, quiz.id).locator('.score').getByRole('button', { name: 'Opnieuw' }).click();
    const block = section(page, quiz.id);
    await expect(block.locator('.score')).toHaveCount(0);
    await expect(block.locator('.feedback')).toHaveCount(0);
    await expect(block.locator('.option.right, .option.wrong')).toHaveCount(0);
    for (const button of await block.locator('button.option').all()) {
      await expect(button).toBeEnabled();
    }
    await expect(questionBlock(page, first).locator('.prompt')).toBeFocused();
    // Shuffled again: every option is still there.
    const after = await shownOrder(page);
    for (const [index, order] of after.entries()) {
      expect([...order].sort()).toEqual([...before[index]].sort());
    }

    // A new answer is a new attempt; the old ones stay.
    await answer(page, first, rightOption(first));
    await expect
      .poll(async () => (await storedRecords(page)).quiz_attempts.length)
      .toBe(quiz.questions.length + 1);
  });

  test('answering every question fills the quiz circle', async ({ page }) => {
    await answer(page, first, rightOption(first));
    await expect(navLink(page, 3, 'Quiz', false), 'started is not done yet').toBeVisible();
    for (const question of quiz.questions.slice(1)) {
      await answer(page, question, wrongOption(question));
    }
    await expect(navLink(page, 3, 'Quiz', true)).toBeVisible();
    await expect(
      page.getByRole('navigation', { name: 'Stappen van deze les' }).locator('li.done'),
    ).toHaveCount(1);
  });
});
