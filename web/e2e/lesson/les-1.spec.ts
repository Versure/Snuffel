import AxeBuilder from '@axe-core/playwright';
import type { Locator, Page } from '@playwright/test';
import { plainText } from '../../src/app/shared/inline-text/inline-markup';
import { expect, test } from '../fixtures';
import { createChild, currentBaseURL, loginAsNewChild } from '../support/accounts';
import { loginAs } from '../support/login';
import { card, lessonRow, logout } from '../overview/pages';
import { detailText, openAsParent } from '../parent/pages';
import {
  answer,
  answerAll,
  checkbox,
  choiceButton,
  currentPattern,
  feedbackText,
  gameBlock,
  gameConfig,
  navLink,
  optionButton,
  playWholeGame,
  questionBlock,
  readExplanation,
  section,
  settle,
  wrongOption,
} from './actions';
import { normalize } from './fixture';
import {
  les1,
  les1Course,
  les1Courses,
  les1Explain,
  les1GameStep,
  les1Path,
  les1Quiz,
  les1Sources,
  les1VisibleTexts,
  les1Water,
} from './les-1';

const courseTitle = les1Course.title;
const lessonTitle = plainText(les1.title).trim();
const game = gameConfig(les1GameStep);
// The one wrong answer of the quiz and the one wrong round of the game (0-based) of every test.
const wrongQuestion = les1Quiz.questions[1];
const wrongRound = 3;
const rightGameScore = game.rounds - 1;
const rightQuizScore = les1Quiz.questions.length - 1;

test.beforeEach(async ({ page }) => {
  // Reduced motion: the game draws its line at once, so eight rounds are quick.
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

const label = (index: number): string =>
  ({ explain: 'Uitleg', interaction: 'Spel', quiz: 'Quiz', practice: 'Aan het water' })[
    les1.steps[index].type
  ]!;

/** Does the four steps of les 1 with one wrong quiz answer and one wrong game round. */
async function doWholeLes1(page: Page): Promise<void> {
  await readExplanation(page, les1Explain.id);
  await expect(navLink(page, 1, label(0), true)).toBeVisible();
  await playWholeGame(page, [wrongRound], les1GameStep);
  await expect(navLink(page, 2, label(1), true)).toBeVisible();
  await answerAll(page, [wrongQuestion.id], les1Quiz);
  await expect(navLink(page, 3, label(2), true)).toBeVisible();
  for (const item of les1Water.items) await checkbox(page, item.id, les1Water).check();
  await expect(navLink(page, 4, label(3), true)).toBeVisible();
  await settle(page);
}

async function openLes1(page: Page) {
  const account = await loginAsNewChild(page, les1Path, { courses: les1Courses });
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(lessonTitle);
  return account;
}

test.describe('les 1', () => {
  test('les 1 has the ids and the shape the tests follow', async () => {
    // Guards the assumptions of this file against an accidental rewrite of the lesson file.
    expect(les1.steps.map((step) => step.id)).toEqual(['uitleg', 'spel', 'quiz', 'water']);
    expect(les1Quiz.questions.map((question) => question.id)).toEqual([
      'schokken-terug',
      'dood-gewicht',
      'lijn-springt',
      'veel-planten',
    ]);
    expect(game.choices.map((choice) => choice.id)).toEqual(['vis', 'vast', 'bodem']);
    expect(les1Water.items).toHaveLength(5);
    expect(game.rounds).toBe(8);
  });

  test('a child goes through the whole of les 1', async ({ page }) => {
    await loginAsNewChild(page, '/', { courses: les1Courses });
    const start = card(page, courseTitle);
    await expect(start).toContainText('0 van 1 lessen klaar');
    await start.click();

    // The course overview with Ted, the goal and the next lesson.
    await expect(page).toHaveURL(/\/leren\/roofvissen$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(courseTitle);
    await expect(page.locator('.greeting')).toContainText(les1Course.ted!.greeting);
    await expect(page.locator('.goal')).toContainText(`Doel: ${les1Course.goal}`);
    await expect(page.locator('.goal')).toContainText(`Gelukt als: ${les1Course.successCriterion}`);
    await expect(lessonRow(page, lessonTitle).locator('.label')).toHaveText('Nieuw');
    await page.getByRole('link', { name: `Begin met: ${lessonTitle}` }).click();

    // The lesson: sticker, title, Ted's intro and the goal.
    await expect(page).toHaveURL(new RegExp(`${les1Path}$`));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(lessonTitle);
    const main = normalize(await page.locator('main').innerText());
    for (const text of [les1.sticker, les1.ted.intro.text, les1.objective]) {
      expect(main).toContain(normalize(plainText(text)));
    }
    await expect(page.locator('snf-lesson-step h2')).toHaveCount(4);

    // 1. The explanation, to its end.
    await readExplanation(page, les1Explain.id);
    await expect(navLink(page, 1, label(0), true)).toBeVisible();

    // 2. The game: eight rounds, one wrong.
    await expect(navLink(page, 2, label(1), false)).toBeVisible();
    await playWholeGame(page, [wrongRound], les1GameStep);
    await expect(gameBlock(page, les1GameStep)).toContainText(
      `${rightGameScore} van ${game.rounds} goed.`,
    );
    await expect(navLink(page, 2, label(1), true)).toBeVisible();

    // 3. The quiz: feedback of the chosen option, one wrong answer.
    await expect(navLink(page, 3, label(2), false)).toBeVisible();
    for (const question of les1Quiz.questions) {
      const wrong = question.id === wrongQuestion.id;
      const optionId = wrong ? wrongOption(question) : question.correctOptionId;
      await answer(page, question, optionId, les1Quiz);
      const chosen = question.options.find((option) => option.id === optionId)!;
      const feedback = await feedbackText(page, question, les1Quiz);
      expect(feedback, question.id).toContain(normalize(plainText(chosen.feedback)));
      expect(
        [...les1.ted[wrong ? 'incorrect' : 'correct']].some((line) =>
          feedback.includes(normalize(plainText(line))),
        ),
        `${question.id}: Ted's line in "${feedback}"`,
      ).toBe(true);
    }
    await expect(section(page, les1Quiz.id).locator('.score')).toContainText(
      `${rightQuizScore} van ${les1Quiz.questions.length} goed.`,
    );
    await expect(navLink(page, 3, label(2), true)).toBeVisible();

    // 4. At the water: every item, and the success criterion below.
    await expect(navLink(page, 4, label(3), false)).toBeVisible();
    for (const item of les1Water.items) await checkbox(page, item.id, les1Water).check();
    await expect(section(page, les1Water.id).locator('.success strong')).toHaveText(
      plainText(les1Water.successCriterion),
    );
    await expect(navLink(page, 4, label(3), true)).toBeVisible();

    // Ted at the end, no open steps, four filled circles.
    await expect(page.locator('.finished .not-yet')).toHaveCount(0);
    await expect(page.locator('.finished snf-ted-says')).toContainText(
      normalize(plainText(les1.ted.finished)),
    );
    await expect(
      page.getByRole('navigation', { name: 'Stappen van deze les' }).locator('li.done'),
    ).toHaveCount(4);
    await settle(page);

    // Back to the lessons: Klaar, and nothing left to do.
    await page.getByRole('link', { name: 'Naar de lessen' }).first().click();
    await expect(page).toHaveURL(/\/leren\/roofvissen$/);
    await expect(lessonRow(page, lessonTitle).locator('.label')).toHaveText('Klaar ✓');
    await expect(page.locator('.all-done')).toContainText('Alles klaar! Goed gesnuffeld.');
    await expect(page.locator('.next')).toHaveCount(0);
    const bar = page.getByRole('progressbar');
    await expect(bar).toHaveAttribute('aria-valuenow', '1');
    await expect(bar).toHaveAttribute('aria-valuetext', 'Alle lessen klaar!');

    // The start page.
    await page.getByRole('link', { name: 'Naar de start' }).click();
    await expect(card(page, courseTitle)).toContainText('Alle lessen klaar!');
  });

  test('after reloading les 1 the progress is still there', async ({ page }) => {
    await openLes1(page);
    await doWholeLes1(page);
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(lessonTitle);

    for (const [index, step] of les1.steps.entries()) {
      await expect(navLink(page, index + 1, label(index), true), step.id).toBeVisible();
    }
    for (const item of les1Water.items) {
      await expect(checkbox(page, item.id, les1Water), item.id).toBeChecked();
    }
    for (const question of les1Quiz.questions) {
      const wrong = question.id === wrongQuestion.id;
      await expect(
        optionButton(
          page,
          question,
          wrong ? wrongOption(question) : question.correctOptionId,
          les1Quiz,
        ),
        question.id,
      ).toContainText('Jouw antwoord');
    }
    await expect(section(page, les1Quiz.id).locator('.score')).toContainText(
      `${rightQuizScore} van ${les1Quiz.questions.length} goed.`,
    );
    await expect(section(page, les1GameStep.id).locator('.previous')).toHaveText(
      `Vorige keer: ${rightGameScore} van ${game.rounds} goed.`,
    );
    await expect(
      page.getByRole('navigation', { name: 'Stappen van deze les' }).locator('li.done'),
    ).toHaveCount(4);
  });

  test('the parent sees les 1 of the child', async ({ page }) => {
    const account = await createChild(currentBaseURL(), { courses: les1Courses });
    await loginAs(page, account.username, les1Path);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(lessonTitle);
    await doWholeLes1(page);
    await logout(page);

    await openAsParent(page, `/ouder/${account.id}`);
    const row = page
      .locator('snf-child-lesson')
      .filter({ has: page.getByRole('heading', { name: lessonTitle, exact: true }) });
    await expect(row.locator('snf-lesson-status')).toContainText('Klaar ✓');
    expect(await detailText(row, 'Quiz')).toContain(
      `Quiz: ${rightQuizScore} van ${les1Quiz.questions.length} goed`,
    );
    expect(await detailText(row, 'Aan het water')).toBe(
      `Aan het water: ${les1Water.items.length} van ${les1Water.items.length} afgevinkt`,
    );
    expect(await detailText(row, plainText(les1GameStep.title))).toContain(
      `${plainText(les1GameStep.title)}: ${rightGameScore} van ${game.rounds} goed`,
    );
  });

  test('every text of les 1 is shown', async ({ page }) => {
    await openLes1(page);
    // The game loads lazily and shows "Even laden…" until then.
    await expect(
      gameBlock(page, les1GameStep).getByRole('button', { name: 'Start', exact: true }),
    ).toBeVisible();
    await expect(page.locator('main').getByText('Even laden…')).toHaveCount(0);
    const shown = normalize(await page.locator('main').innerText());
    for (const text of les1VisibleTexts()) expect(shown, text).toContain(text);
    // The game offers exactly the choices of the lesson file.
    await expect(gameBlock(page, les1GameStep).locator('button.choice')).toHaveText(
      game.choices.map((choice) => choice.label),
    );
  });

  test('every claim in les 1 shows its sources', async ({ page }) => {
    await openLes1(page);
    const check = async (element: Locator, refs: string[], name: string): Promise<void> => {
      const sources = element.locator('.sources');
      if (refs.length === 0) {
        await expect(sources, name).toHaveCount(0);
        return;
      }
      await expect(sources, name).toHaveCount(1);
      await expect(sources, name).toContainText('Bron:');
      const links = sources.getByRole('link');
      await expect(links, name).toHaveCount(refs.length);
      for (const [index, ref] of refs.entries()) {
        const source = les1Sources.get(ref)!;
        await expect(links.nth(index), `${name} ${ref}`).toHaveAttribute('href', source.url);
        await expect(links.nth(index), `${name} ${ref}`).toContainText(source.publisher);
      }
    };
    const blocks = section(page, les1Explain.id).locator('snf-block');
    await expect(blocks).toHaveCount(les1Explain.blocks.length);
    for (const [index, block] of les1Explain.blocks.entries()) {
      if (block.type === 'signal-cards') {
        const cards = blocks.nth(index).locator('li.card');
        await expect(cards).toHaveCount(block.cards.length);
        for (const [cardIndex, signal] of block.cards.entries()) {
          await check(cards.nth(cardIndex), signal.sourceRefs, `card ${signal.title}`);
        }
      } else {
        await check(blocks.nth(index), block.sourceRefs, `block ${index} (${block.type})`);
      }
    }
    // Every source of the lesson file is in the course file (content:check), and further reading
    // links to its source.
    for (const reading of les1.furtherReading) {
      const source = les1Sources.get(reading.sourceRef)!;
      await expect(
        page.locator('#verder-lezen').getByRole('link', { name: new RegExp(source.title) }),
      ).toHaveAttribute('href', source.url);
    }
  });

  test('every external link in les 1 is https and opens safely', async ({ page }) => {
    await openLes1(page);
    const links = await page.locator('a[href]').evaluateAll((elements) =>
      elements.map((element) => ({
        href: element.getAttribute('href') ?? '',
        target: element.getAttribute('target'),
        rel: element.getAttribute('rel'),
        text: element.textContent ?? '',
      })),
    );
    const external = links.filter(
      (link) => /^[a-z]+:/i.test(link.href) || link.href.startsWith('//'),
    );
    expect(external.length).toBeGreaterThan(5);
    for (const link of external) {
      expect(link.href, link.text).toMatch(/^https:\/\//);
      expect(link.target, link.href).toBe('_blank');
      expect(link.rel, link.href).toBe('noopener noreferrer');
    }
    // The link of the checklist item (the VISpas-check) is among them.
    for (const item of les1Water.items) {
      for (const link of item.links ?? []) {
        expect(external.map((candidate) => candidate.href)).toContain(link.url);
      }
    }
    for (const link of links.filter((candidate) => !external.includes(candidate))) {
      expect(link.href).toMatch(/^\//);
      expect(link.target).toBeNull();
    }
  });

  test('les 1 works with the keyboard', async ({ page }) => {
    await openLes1(page);
    const expectRing = async (target: Locator, name: string): Promise<void> => {
      await expect(target, name).toBeFocused();
      const outline = await target.evaluate((element) => {
        const style = getComputedStyle(element);
        return { style: style.outlineStyle, width: style.outlineWidth };
      });
      expect(outline.style, name).not.toBe('none');
      expect(outline.width, name).toBe('3px');
    };

    // Tab from the link to the lessons through the four links of the step navigation.
    await page.getByRole('link', { name: 'Naar de lessen' }).first().focus();
    for (const [index] of les1.steps.entries()) {
      await page.keyboard.press('Tab');
      await expectRing(
        page
          .getByRole('navigation', { name: 'Stappen van deze les' })
          .getByRole('link', { name: new RegExp(`^Stap ${index + 1}: ${label(index)}`) }),
        `step ${index + 1}`,
      );
    }

    // The game: Enter on Start, Tab to the right choice, Enter chooses it.
    const start = gameBlock(page, les1GameStep).getByRole('button', {
      name: 'Start',
      exact: true,
    });
    await start.focus();
    await page.keyboard.press('Enter');
    await expect(gameBlock(page, les1GameStep).locator('.say')).toBeFocused();
    await expect(choiceButton(page, game.choices[0].id, les1GameStep)).toBeEnabled();
    await page.keyboard.press('Tab');
    await expectRing(choiceButton(page, game.choices[0].id, les1GameStep), 'first choice');
    const pattern = await currentPattern(page, les1GameStep);
    const index = game.choices.findIndex((choice) => choice.id === pattern.answer);
    for (let press = 0; press < index; press += 1) await page.keyboard.press('Tab');
    await expectRing(choiceButton(page, pattern.answer, les1GameStep), 'right choice');
    await page.keyboard.press('Enter');
    await expect(choiceButton(page, pattern.answer, les1GameStep)).toContainText('Jouw keuze');

    // The quiz: Tab from the prompt to the first option, Enter answers.
    const block = questionBlock(page, les1Quiz.questions[0], les1Quiz);
    await block.locator('.prompt').focus();
    await page.keyboard.press('Tab');
    await expectRing(block.locator('button.option').first(), 'quiz option');
    await page.keyboard.press('Enter');
    await expect(block.locator('.feedback')).toBeVisible();

    // The checklist: Tab from the heading to the first item, Space ticks it.
    await section(page, les1Water.id).getByRole('heading', { level: 2 }).focus();
    await page.keyboard.press('Tab');
    await expectRing(checkbox(page, les1Water.items[0].id, les1Water), 'checkbox');
    await page.keyboard.press('Space');
    await expect(checkbox(page, les1Water.items[0].id, les1Water)).toBeChecked();
  });

  test('les 1 has no axe violations in dark mode', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
    await openLes1(page);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations, 'dark, opened').toEqual([]);
    // And once more with the work done: answered questions, ticks and a finished game.
    await doWholeLes1(page);
    const done = await new AxeBuilder({ page }).analyze();
    expect(done.violations, 'dark, finished').toEqual([]);
  });

  test('les 1 has no axe violations in light mode when finished', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
    await openLes1(page);
    await doWholeLes1(page);
    const done = await new AxeBuilder({ page }).analyze();
    expect(done.violations, 'light, finished').toEqual([]);
  });
});
