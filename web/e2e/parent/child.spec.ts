import { expect, test } from '../fixtures';
import { exerciseLesson } from '../lesson/fixture';
import {
  answer,
  checkbox,
  gameBlock,
  navLink,
  practice,
  quiz,
  rightOption,
  section,
  settle,
  wrongOption,
} from '../lesson/actions';
import { lessonPath } from '../lesson/fixture';
import { createChild, currentBaseURL, uniqueName } from '../support/accounts';
import { loginAs } from '../support/login';
import {
  storeChecklist,
  storeInteractionResult,
  storeQuizAttempts,
  countLessonRecords,
} from '../support/progress';
import {
  childWithProgress,
  laterTitle,
  startedBreuken,
  startedProefles,
  wholeProefles,
} from '../overview/pages';
import {
  askToClear,
  breukenTitle,
  childLesson,
  clearButton,
  detailText,
  logout,
  openAsParent,
  openChildPage,
  proeflesTitle,
  storeWholeLesson,
} from './pages';

const baseURL = () => currentBaseURL();

test.describe('the page of a child (/ouder/<id>)', () => {
  test('the overview matches what the child did in the app', async ({ page }) => {
    const account = await createChild(baseURL(), { name: uniqueName() });
    await loginAs(page, account.username, lessonPath);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(proeflesTitle);

    // Two of the four items ticked, and a quiz with one wrong answer.
    await section(page, practice.id).scrollIntoViewIfNeeded();
    await checkbox(page, practice.items[0].id).check();
    await checkbox(page, practice.items[1].id).check();
    await expect(checkbox(page, practice.items[1].id)).toBeChecked();
    await section(page, quiz.id).scrollIntoViewIfNeeded();
    for (const [index, question] of quiz.questions.entries()) {
      await answer(page, question, index === 0 ? wrongOption(question) : rightOption(question));
    }
    await settle(page);

    // What the lesson page itself says is done.
    const doneSteps = await page
      .getByRole('navigation', { name: 'Stappen van deze les' })
      .getByRole('link', { name: /\(klaar\)/ })
      .count();

    await logout(page);
    await openChildPage(page, account);
    await expect(page.locator('main > .last-activity')).toHaveText(
      /Laatst actief: (vandaag|gisteren) om \d{1,2}:\d{2}/,
    );
    // The moment of the last activity; the day may turn between the two pages.
    const lastTime = (await page.locator('main > .last-activity').innerText()).split(' om ')[1];
    expect(lastTime).toMatch(/^\d{1,2}:\d{2}$/);
    const row = childLesson(page, proeflesTitle);
    await expect(row.locator('snf-lesson-status')).toContainText(
      `Bezig: ${doneSteps} van 4 stappen klaar`,
    );
    expect(await detailText(row, 'Quiz')).toContain('Quiz: 3 van 4 goed');
    expect(await detailText(row, 'Quiz')).toContain('4 antwoorden, 0 hints');
    expect(await detailText(row, 'Aan het water')).toBe('Aan het water: 2 van 4 afgevinkt');
    expect(await detailText(row, 'Voel de lijn')).toBe('Voel de lijn: nog niet gespeeld');
    await expect(clearButton(row)).toBeVisible();
    // The list on /ouder counts the same lessons as completed, with the same last activity.
    await page.locator('a.back').click();
    const card = page.locator(`snf-child-card:has(a[href="/ouder/${account.id}"])`);
    await expect(card).toBeVisible();
    await expect(card.locator('.lessons-completed')).toHaveText(
      doneSteps === 4 ? '1 les klaar' : '0 lessen klaar',
    );
    await expect(card.locator('.last-activity')).toHaveText(
      new RegExp(`^Laatst actief: (vandaag|gisteren) om ${lastTime}$`),
    );
  });

  test('the parent sees the status, quiz score, checklist and latest game result of a child', async ({
    page,
  }) => {
    const child = await childWithProgress(startedProefles);
    const url = baseURL();
    await storeQuizAttempts(url, child, [
      { lessonId: 'proefles', questionId: 'schokken-terug', optionId: 'aanslaan', correct: true },
      { lessonId: 'proefles', questionId: 'dood-gewicht', optionId: 'snoek', correct: false },
      {
        lessonId: 'proefles',
        questionId: 'dood-gewicht',
        optionId: 'vast',
        correct: true,
        hintsUsed: 1,
      },
      { lessonId: 'proefles', questionId: 'te-vroeg-slap', optionId: 'dieper', correct: false },
    ]);
    await storeChecklist(url, child, 'proefles', 'zelf-doen', ['vispas', 'tik-roepen']);
    for (const score of [3, 6]) {
      await storeInteractionResult(url, child, {
        lessonId: 'proefles',
        interactionId: 'voel-spel',
        kind: 'trace-game',
        score,
        total: 8,
      });
    }

    await openAsParent(page, `/ouder/${child.id}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Testkind');
    const sections = page.locator('section.section');
    await expect(sections.nth(0).getByRole('heading', { level: 2 })).toHaveText('Leertrajecten');
    await expect(sections.nth(1).getByRole('heading', { level: 2 })).toHaveText('Huiswerk oefenen');
    await expect(sections.nth(0).getByRole('heading', { level: 3 })).toHaveText(/Proefcursus/);
    await expect(sections.nth(0).getByRole('progressbar')).toBeVisible();
    await expect(sections.nth(0)).toContainText('0 van 2 lessen klaar');

    const row = childLesson(page, proeflesTitle);
    await expect(row.locator('snf-lesson-status')).toContainText('Bezig: 1 van 4 stappen klaar');
    await expect(row.locator('.last-activity')).toHaveText(/Laatst actief: /);
    expect(await detailText(row, 'Quiz')).toBe(
      'Quiz: 3 van 4 beantwoord, 2 goed 4 antwoorden, 1 hint',
    );
    expect(await detailText(row, 'Aan het water')).toBe('Aan het water: 2 van 4 afgevinkt');
    expect(await detailText(row, 'Voel de lijn')).toBe(
      'Voel de lijn: 6 van 8 goed 2 keer gespeeld',
    );

    // Lessons are listed in course order, a planned lesson says Komt nog.
    const lessons = sections.nth(0).locator('snf-child-lesson h4');
    await expect(lessons).toHaveText([proeflesTitle, laterTitle]);
    await expect(childLesson(page, laterTitle).locator('snf-lesson-status')).toContainText(
      'Komt nog',
    );
    // The other course has nothing yet.
    await expect(childLesson(page, breukenTitle).locator('snf-lesson-status')).toContainText(
      'Nieuw',
    );
  });

  test('the parent sees the help a child used in a stepped exercise', async ({ page }) => {
    const child = await childWithProgress(startedBreuken);
    const ids = (
      exerciseLesson.steps.find((step) => step.type === 'interaction')!.interaction.config as {
        exercises: { id: string }[];
      }
    ).exercises.map((exercise) => exercise.id);
    expect(ids).toHaveLength(4);
    await storeInteractionResult(baseURL(), child, {
      lessonId: 'proefles-breuken',
      interactionId: 'breuken',
      kind: 'stepped-exercise',
      score: 3,
      total: 4,
      detail: {
        exercises: ids.map((id, index) => ({
          id,
          correct: index !== 0,
          attempts: 1,
          hints: index === 0 ? 2 : index === 1 ? 1 : 0,
          steps: 0,
          solution: index === 0,
        })),
      },
    });

    await openAsParent(page, `/ouder/${child.id}`);
    const row = childLesson(page, breukenTitle);
    await expect(row.locator('snf-lesson-status')).toContainText('Bezig: 0 van 4 stappen klaar');
    expect(await detailText(row, 'Oefenen')).toBe(
      'Oefenen: 3 van 4 zelf goed 1 keer gemaakt 3 hints, uitwerking bekeken bij 1 van 4 opgaven',
    );
    expect(await detailText(row, 'Quiz')).toBe('Quiz: nog niet gemaakt');
  });

  test('a lesson without progress says Nieuw and has no clear button', async ({ page }) => {
    const child = await childWithProgress(startedProefles);
    await openAsParent(page, `/ouder/${child.id}`);
    const fresh = childLesson(page, breukenTitle);
    await expect(fresh.locator('snf-lesson-status')).toContainText('Nieuw');
    await expect(fresh.locator('.details')).toHaveCount(0);
    await expect(fresh.getByRole('button')).toHaveCount(0);
    await expect(clearButton(childLesson(page, proeflesTitle))).toBeVisible();
    await expect(clearButton(childLesson(page, laterTitle))).toHaveCount(0);
  });

  test('clearing a lesson removes only that lesson of that child', async ({ page }) => {
    const a = await createChild(baseURL(), { name: uniqueName('A') });
    const b = await createChild(baseURL(), { name: uniqueName('B') });
    await storeWholeLesson(a, 'proefles');
    await storeWholeLesson(a, 'proefles-breuken');
    await storeWholeLesson(b, 'proefles');
    const url = baseURL();
    const before = {
      aBreuken: await countLessonRecords(url, a.id, 'proefles-breuken'),
      bProefles: await countLessonRecords(url, b.id, 'proefles'),
    };
    const aProefles = await countLessonRecords(url, a.id, 'proefles');
    expect(aProefles).toEqual({
      lesson_progress: 4,
      quiz_attempts: 4,
      checklist_states: 1,
      interaction_results: 1,
    });

    await openChildPage(page, a);
    const row = childLesson(page, proeflesTitle);
    await expect(row.locator('snf-lesson-status')).toContainText('Klaar');
    const question = await askToClear(row);
    await expect(question).toContainText(
      `Alles van ${proeflesTitle} voor ${a.name} wissen? Stappen, quizantwoorden, vinkjes en scores gaan weg. Dit kan niet terug.`,
    );
    await question.getByRole('button', { name: 'Ja, wissen' }).click();

    const cleared = page.locator('p.cleared');
    await expect(cleared).toHaveText(`De voortgang van ${proeflesTitle} is gewist.`);
    await expect(cleared).toBeFocused();
    await expect(childLesson(page, proeflesTitle).locator('snf-lesson-status')).toContainText(
      'Nieuw',
    );
    await expect(clearButton(childLesson(page, proeflesTitle))).toHaveCount(0);

    expect(await countLessonRecords(url, a.id, 'proefles')).toEqual({
      lesson_progress: 0,
      quiz_attempts: 0,
      checklist_states: 0,
      interaction_results: 0,
    });
    expect(await countLessonRecords(url, a.id, 'proefles-breuken')).toEqual(before.aBreuken);
    expect(await countLessonRecords(url, b.id, 'proefles')).toEqual(before.bProefles);
    // The other lesson of A is still there on the page.
    await expect(childLesson(page, breukenTitle).locator('snf-lesson-status')).toContainText(
      'Klaar',
    );
  });

  test('Annuleren keeps the progress', async ({ page }) => {
    const child = await childWithProgress(wholeProefles);
    await storeQuizAttempts(baseURL(), child, [
      { lessonId: 'proefles', questionId: 'schokken-terug', optionId: 'aanslaan', correct: true },
    ]);
    const before = await countLessonRecords(baseURL(), child.id, 'proefles');
    await openAsParent(page, `/ouder/${child.id}`);
    const row = childLesson(page, proeflesTitle);
    const question = await askToClear(row);
    await question.getByRole('button', { name: 'Annuleren' }).click();
    await expect(row.getByRole('group')).toHaveCount(0);
    await expect(clearButton(row)).toBeFocused();
    await expect(row.locator('snf-lesson-status')).toContainText('Klaar');
    expect(await countLessonRecords(baseURL(), child.id, 'proefles')).toEqual(before);

    // Escape cancels as well.
    await askToClear(row);
    await page.keyboard.press('Escape');
    await expect(row.getByRole('group')).toHaveCount(0);
    await expect(clearButton(row)).toBeFocused();
    expect(await countLessonRecords(baseURL(), child.id, 'proefles')).toEqual(before);
  });

  test('after clearing the child starts the lesson afresh', async ({ page }) => {
    const child = await childWithProgress([]);
    await storeWholeLesson(child, 'proefles');
    await storeQuizAttempts(baseURL(), child, [
      { lessonId: 'proefles', questionId: 'schokken-terug', optionId: 'aanslaan', correct: true },
    ]);

    await openChildPage(page, child);
    const row = childLesson(page, proeflesTitle);
    await (await askToClear(row)).getByRole('button', { name: 'Ja, wissen' }).click();
    await expect(page.locator('p.cleared')).toContainText('is gewist');
    await logout(page);

    await loginAs(page, child.username, lessonPath);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(proeflesTitle);
    await expect(checkbox(page, practice.items[0].id)).toBeVisible();
    for (const item of practice.items) await expect(checkbox(page, item.id)).not.toBeChecked();
    await expect(section(page, quiz.id).locator('.feedback')).toHaveCount(0);
    await expect(gameBlock(page).locator('.previous')).toHaveCount(0);
    await settle(page);
    await expect(navLink(page, 3, 'Quiz', false)).toBeVisible();
    await expect(
      page
        .getByRole('navigation', { name: 'Stappen van deze les' })
        .getByRole('link', { name: /\(klaar\)/ }),
    ).toHaveCount(0);
  });

  test('a clear that fails says so and Opnieuw clears the rest', async ({ page }) => {
    const child = await createChild(baseURL(), { name: uniqueName() });
    await storeWholeLesson(child, 'proefles');
    let failed = 0;
    await page.route('**/api/collections/quiz_attempts/records/**', (route) => {
      if (route.request().method() === 'DELETE' && failed === 0) {
        failed += 1;
        return route.fulfill({ status: 503, body: '{}' });
      }
      return route.continue();
    });

    await openChildPage(page, child);
    const row = childLesson(page, proeflesTitle);
    const question = await askToClear(row);
    await question.getByRole('button', { name: 'Ja, wissen' }).click();
    await expect(row.getByText('Niet alles is gewist. Probeer het nog eens.')).toBeVisible();
    await expect(row.getByRole('button', { name: 'Ja, wissen' })).toHaveCount(0);
    const retry = row.getByRole('button', { name: 'Opnieuw', exact: true });
    await expect(retry).toBeVisible();
    await expect(page.locator('p.cleared')).toHaveText('');
    expect(
      (await countLessonRecords(baseURL(), child.id, 'proefles')).quiz_attempts,
    ).toBeGreaterThan(0);

    await retry.click();
    await expect(page.locator('p.cleared')).toHaveText(
      `De voortgang van ${proeflesTitle} is gewist.`,
    );
    expect(failed).toBe(1);
    expect(await countLessonRecords(baseURL(), child.id, 'proefles')).toEqual({
      lesson_progress: 0,
      quiz_attempts: 0,
      checklist_states: 0,
      interaction_results: 0,
    });
  });

  test('an unknown child or the id of a parent shows Kind niet gevonden', async ({ page }) => {
    await openAsParent(page, '/ouder/doesnotexist000');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Kind niet gevonden');
    await expect(page.locator('.state-ted')).toContainText('Dit kind kan ik niet vinden.');
    await expect(page).toHaveTitle('Kind niet gevonden · Ouderoverzicht · Snuffel');

    const parentId = await page.evaluate(
      () =>
        (JSON.parse(localStorage.getItem('pocketbase_auth') ?? '{}') as { record?: { id: string } })
          .record?.id,
    );
    expect(parentId).toBeTruthy();
    await page.goto(`/ouder/${parentId}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Kind niet gevonden');
    await page.getByRole('link', { name: 'Naar het ouderoverzicht' }).last().click();
    await expect(page).toHaveURL(/\/ouder$/);
  });

  test('progress that cannot be loaded shows a retry', async ({ page }) => {
    const child = await childWithProgress(startedProefles);
    const pattern = '**/api/collections/lesson_progress/records**';
    await page.route(pattern, (route) => route.fulfill({ status: 503, body: '{}' }));
    await openAsParent(page, `/ouder/${child.id}`);
    const error = page.locator('.progress-error');
    await expect(error).toContainText('De voortgang van dit kind kan ik nu niet ophalen.');
    // The lessons are there, without status numbers or details.
    await expect(childLesson(page, proeflesTitle)).toBeVisible();
    await expect(page.locator('snf-progress-bar')).toHaveCount(0);
    await expect(page.locator('.details')).toHaveCount(0);

    await page.unroute(pattern);
    await error.getByRole('button', { name: 'Opnieuw' }).click();
    await expect(error).toHaveCount(0);
    await expect(childLesson(page, proeflesTitle).locator('snf-lesson-status')).toContainText(
      'Bezig: 1 van 4 stappen klaar',
    );
    await expect(page.locator('snf-progress-bar').first()).toBeVisible();
  });
});
