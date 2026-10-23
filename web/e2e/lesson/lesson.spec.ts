import type { Locator, Page } from '@playwright/test';
import type {
  ContentManifest,
  ExplainStep,
  PracticeStep,
  QuizStep,
} from '../../src/app/core/content/content.types';
import { plainText } from '../../src/app/shared/inline-text/inline-markup';
import { expect, test } from '../fixtures';
import { fixtureCourse, fixtureLesson, normalize, openLesson } from './fixture';

const lesson = fixtureLesson;
const explain = lesson.steps.find((step): step is ExplainStep => step.type === 'explain')!;
const quiz = lesson.steps.find((step): step is QuizStep => step.type === 'quiz')!;
const practice = lesson.steps.find((step): step is PracticeStep => step.type === 'practice')!;
const sourceById = new Map(fixtureCourse.sources.map((source) => [source.id, source]));

/** Every text of the lesson a reader should see, as plain text. */
function visibleTexts(): string[] {
  const texts: string[] = [
    lesson.title,
    lesson.sticker,
    lesson.objective,
    lesson.ted.intro.text,
    lesson.ted.finished,
    `Ongeveer ${lesson.estimatedMinutes} minuten`,
  ];
  for (const step of lesson.steps) {
    texts.push(step.title);
    switch (step.type) {
      case 'explain':
        for (const block of step.blocks) {
          switch (block.type) {
            case 'signal-cards':
              for (const card of block.cards) texts.push(card.title, card.text);
              break;
            case 'rule':
              texts.push(block.title, block.text);
              break;
            case 'tip':
              texts.push(block.title ?? 'Tip', block.text);
              break;
            case 'figure':
              if (block.caption) texts.push(block.caption);
              break;
            default:
              texts.push(block.text);
          }
        }
        break;
      case 'interaction':
        texts.push(step.intro);
        break;
      case 'quiz':
        if (step.intro) texts.push(step.intro);
        for (const question of step.questions) {
          texts.push(question.prompt, ...question.options.map((option) => option.text));
        }
        break;
      case 'practice':
        texts.push(step.intro, step.successCriterion);
        for (const item of step.items) {
          texts.push(item.text, ...(item.links ?? []).map((link) => link.label));
        }
        break;
    }
  }
  for (const entry of lesson.glossary) texts.push(entry.term, entry.definition);
  for (const reading of lesson.furtherReading) {
    const source = sourceById.get(reading.sourceRef)!;
    texts.push(source.title, source.publisher, reading.why);
  }
  for (const entry of lesson.faq) texts.push(entry.q, entry.a);
  return texts.map((text) => normalize(plainText(text)));
}

function step(page: Page, id: string): Locator {
  return page.locator(`section#stap-${id}`);
}

test.describe('the fixture lesson', () => {
  test.beforeEach(async ({ page }) => {
    await openLesson(page);
  });

  test('renders every text of the fixture lesson', async ({ page }) => {
    const shown = normalize(await page.locator('main').innerText());
    for (const text of visibleTexts()) {
      expect(shown, text).toContain(text);
    }
  });

  test('renders every block type of the fixture lesson', async ({ page }) => {
    const uitleg = step(page, 'uitleg');
    for (const selector of [
      'snf-text-block',
      'snf-example-block',
      'snf-signal-cards-block',
      'snf-rule-block',
      'snf-tip-block',
      'snf-figure-block',
      'snf-ted-says-block',
    ]) {
      await expect(uitleg.locator(selector).first(), selector).toBeVisible();
    }
    expect(await uitleg.locator('snf-block').count()).toBe(explain.blocks.length);
    await expect(uitleg.locator('snf-rule-block')).toContainText('Twijfel? Sla aan!');
    await expect(uitleg.locator('snf-tip-block')).toContainText('Tip');
    await expect(uitleg.locator('snf-ted-says-block snf-ted')).toBeVisible();
  });

  test('renders all four steps with their number and title', async ({ page }) => {
    const headings = page.locator('snf-lesson-step h2');
    await expect(headings).toHaveCount(4);
    for (const [index, data] of lesson.steps.entries()) {
      const heading = step(page, data.id).getByRole('heading', { level: 2 });
      await expect(heading).toHaveText(`${index + 1} ${plainText(data.title)}`);
      await expect(step(page, data.id)).toHaveAttribute(
        'aria-labelledby',
        (await heading.getAttribute('id'))!,
      );
    }
  });

  test('the step navigation lists the four steps with their labels', async ({ page }) => {
    const nav = page.getByRole('navigation', { name: 'Stappen van deze les' });
    const links = nav.getByRole('link');
    await expect(links).toHaveCount(4);
    for (const [index, name] of ['Uitleg', 'Spel', 'Quiz', 'Zelf doen'].entries()) {
      const link = nav.getByRole('link', { name: `Stap ${index + 1}: ${name}`, exact: true });
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute(
        'href',
        `/leren/proefcursus/proefles#stap-${lesson.steps[index].id}`,
      );
    }
  });

  test('a step in the navigation scrolls to that step and focuses its heading', async ({
    page,
  }) => {
    await page.getByRole('link', { name: 'Stap 3: Quiz' }).click();
    await expect(page).toHaveURL(/\/leren\/proefcursus\/proefles#stap-quiz$/);
    const heading = step(page, 'quiz').getByRole('heading', { level: 2 });
    await expect(heading).toBeFocused();
    await expect(heading).toBeInViewport();
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
  });

  test('renders bold and italic from the markup', async ({ page }) => {
    const uitleg = step(page, 'uitleg');
    await expect(uitleg.locator('snf-text-block strong').first()).toHaveText('En vastzitten?');
    await expect(uitleg.locator('snf-rule-block em')).toHaveText('vast');
    // Markup characters never show.
    const text = await uitleg.innerText();
    expect(text).not.toContain('**');
    expect(text).not.toContain('[[');
  });

  test('tapping a term shows its definition and Escape closes it', async ({ page }) => {
    const example = step(page, 'uitleg').locator('snf-example-block');
    const term = example.getByRole('button', { name: 'shad', exact: true });
    await expect(term).toHaveAttribute('aria-expanded', 'false');
    const definitionId = (await term.getAttribute('aria-controls'))!;
    const definition = page.locator(`[id="${definitionId}"]`);
    await expect(definition).toBeHidden();

    await term.click();
    await expect(term).toHaveAttribute('aria-expanded', 'true');
    await expect(definition).toBeVisible();
    await expect(definition).toContainText(
      lesson.glossary.find((entry) => entry.term === 'shad')!.definition,
    );

    await page.keyboard.press('Escape');
    await expect(definition).toBeHidden();
    await expect(term).toHaveAttribute('aria-expanded', 'false');
    await expect(term).toBeFocused();

    await term.click();
    await expect(definition).toBeVisible();
    await term.click();
    await expect(definition).toBeHidden();
  });

  test('the glossary lists every term alphabetically', async ({ page }) => {
    const section = page.locator('section#woordenlijst');
    await expect(section.getByRole('heading', { level: 2 })).toHaveText('Woordenlijst');
    const expected = lesson.glossary
      .map((entry) => entry.term)
      .sort((a, b) => a.localeCompare(b, 'nl', { sensitivity: 'base' }));
    await expect(section.locator('dt')).toHaveText(expected);
    for (const entry of lesson.glossary) {
      await expect(section).toContainText(plainText(entry.definition));
    }
  });

  test('shows further reading with the source title, publisher and why', async ({ page }) => {
    const section = page.locator('section#verder-lezen');
    await expect(section.getByRole('heading', { level: 2 })).toHaveText('Verder lezen');
    const items = section.locator('li');
    await expect(items).toHaveCount(lesson.furtherReading.length);
    for (const [index, reading] of lesson.furtherReading.entries()) {
      const source = sourceById.get(reading.sourceRef)!;
      const link = items.nth(index).getByRole('link', { name: source.title });
      await expect(link).toHaveAttribute('href', source.url);
      await expect(items.nth(index)).toContainText(source.publisher);
      await expect(items.nth(index)).toContainText(plainText(reading.why));
    }
  });

  test('shows every FAQ question and answer', async ({ page }) => {
    const section = page.locator('section#vragen');
    await expect(section.getByRole('heading', { level: 2 })).toHaveText('Vragen');
    await expect(section.getByRole('heading', { level: 3 })).toHaveText(
      lesson.faq.map((entry) => plainText(entry.q)),
    );
    for (const entry of lesson.faq) await expect(section).toContainText(plainText(entry.a));
  });

  test('blocks with sources show their sources, blocks without do not', async ({ page }) => {
    const blocks = step(page, 'uitleg').locator('snf-block');
    for (const [index, block] of explain.blocks.entries()) {
      const element = blocks.nth(index);
      if (block.type === 'signal-cards') {
        const cards = element.locator('li.card');
        for (const [cardIndex, card] of block.cards.entries()) {
          await expectSources(cards.nth(cardIndex), card.sourceRefs, `card ${cardIndex}`);
        }
      } else {
        await expectSources(element, block.sourceRefs, `block ${index} (${block.type})`);
      }
    }
  });

  async function expectSources(element: Locator, refs: string[], label: string): Promise<void> {
    const sources = element.locator('.sources');
    if (refs.length === 0) {
      await expect(sources, label).toHaveCount(0);
      return;
    }
    await expect(sources, label).toHaveCount(1);
    await expect(sources, label).toContainText('Bron:');
    const links = sources.getByRole('link');
    await expect(links, label).toHaveCount(refs.length);
    for (const [index, ref] of refs.entries()) {
      const source = sourceById.get(ref)!;
      await expect(links.nth(index), label).toHaveAttribute('href', source.url);
      await expect(links.nth(index), label).toContainText(source.publisher);
      await expect(links.nth(index), label).toHaveAccessibleName(
        `Bron: ${source.title} (${source.publisher}) (opent in een nieuw tabblad)`,
      );
    }
  }

  test('every external link opens in a new tab with rel noopener noreferrer', async ({ page }) => {
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
    // Sources, the link in a practice item and further reading.
    expect(external.length).toBeGreaterThan(5);
    for (const link of external) {
      expect(link.href, link.text).toMatch(/^https:\/\//);
      expect(link.target, link.href).toBe('_blank');
      expect(link.rel, link.href).toBe('noopener noreferrer');
      expect(link.text, link.href).toContain('(opent in een nieuw tabblad)');
    }
    // Links inside the app stay in the app.
    for (const link of links.filter((candidate) => !external.includes(candidate))) {
      expect(link.href).toMatch(/^\//);
      expect(link.target).toBeNull();
    }
  });

  test('each signal card has a decorative icon', async ({ page }) => {
    const block = explain.blocks.find((candidate) => candidate.type === 'signal-cards')!;
    if (block.type !== 'signal-cards') throw new Error('no signal cards');
    const cards = step(page, 'uitleg').locator('snf-signal-cards-block li.card');
    await expect(cards).toHaveCount(block.cards.length);
    for (const [index, card] of block.cards.entries()) {
      const icon = cards.nth(index).locator('svg');
      await expect(icon).toBeVisible();
      await expect(icon).toHaveAttribute('aria-hidden', 'true');
      await expect(icon).toHaveAttribute('data-icon', card.icon);
      const box = await icon.boundingBox();
      expect(box!.width).toBeGreaterThan(40);
    }
  });

  test('the figure loads with the hash from the manifest and has its alt text', async ({
    page,
    request,
  }) => {
    const manifest = (await (
      await request.get('/content/manifest.json')
    ).json()) as ContentManifest;
    const course = manifest.courses.find((candidate) => candidate.id === 'proefcursus')!;
    const figure = explain.blocks.find((block) => block.type === 'figure')!;
    if (figure.type !== 'figure') throw new Error('no figure');
    const asset = course.assets.find((candidate) => candidate.path === figure.src)!;

    const img = step(page, 'uitleg').locator('snf-figure-block figure img');
    await img.scrollIntoViewIfNeeded();
    await expect(img).toHaveAttribute('src', `/content/proefcursus/${figure.src}?v=${asset.hash}`);
    await expect(img).toHaveAttribute('alt', figure.alt);
    await expect(page.getByRole('img', { name: figure.alt })).toBeVisible();
    await expect
      .poll(() =>
        img.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth),
      )
      .toBeGreaterThan(0);
    await expect(step(page, 'uitleg').locator('snf-figure-block figcaption')).toHaveText(
      plainText(figure.caption!),
    );
  });

  test('the quiz shows every question and option but no answers', async ({ page }) => {
    const section = step(page, 'quiz');
    await expect(section).toContainText('Deze quiz kun je binnenkort echt maken.');
    const questions = section.locator('ol.questions > li');
    await expect(questions).toHaveCount(quiz.questions.length);
    for (const [index, question] of quiz.questions.entries()) {
      await expect(questions.nth(index).locator('.prompt')).toHaveText(plainText(question.prompt));
      await expect(questions.nth(index).locator('li.option .option-text')).toHaveText(
        question.options.map((option) => plainText(option.text)),
      );
      await expect(questions.nth(index).locator('li.option .letter')).toHaveText(
        question.options.map((_, optionIndex) => `${String.fromCharCode(65 + optionIndex)}.`),
      );
    }
    await expect(section.locator('button, input, [role="button"], [role="radio"]')).toHaveCount(0);
    // No feedback and no hints anywhere on the page, not even hidden.
    const all = normalize((await page.locator('main').textContent()) ?? '');
    for (const question of quiz.questions) {
      for (const option of question.options) expect(all).not.toContain(plainText(option.feedback));
      for (const hint of question.hints) expect(all).not.toContain(plainText(hint));
    }
  });

  test('the game shows a placeholder', async ({ page }) => {
    const section = step(page, 'spel');
    const placeholder = section.locator('snf-interaction-placeholder');
    await expect(placeholder).toBeVisible();
    await expect(placeholder).toHaveText('Dit spel komt binnenkort.');
    await expect(placeholder.locator('snf-ted svg')).toHaveAttribute('aria-hidden', 'true');
    // The configuration of the game is not shown.
    const text = await section.innerText();
    for (const label of ['Vis!', 'Plant', 'Bodem']) expect(text).not.toContain(label);
    await expect(section.locator('button')).toHaveCount(0);
  });

  test('the practice step shows its items, links and success criterion without checkboxes', async ({
    page,
  }) => {
    const section = step(page, 'zelf-doen');
    await expect(section.locator('snf-sticky-note')).toBeVisible();
    const items = section.locator('ul.items > li');
    await expect(items).toHaveCount(practice.items.length);
    for (const [index, item] of practice.items.entries()) {
      await expect(items.nth(index)).toContainText(plainText(item.text));
      for (const link of item.links ?? []) {
        await expect(items.nth(index).getByRole('link', { name: link.label })).toHaveAttribute(
          'href',
          link.url,
        );
      }
    }
    await expect(section.locator('.success strong')).toHaveText(
      plainText(practice.successCriterion),
    );
    await expect(section.locator('input, [role="checkbox"]')).toHaveCount(0);
  });
});

test('a link with #stap-quiz opens the lesson at the quiz', async ({ page }) => {
  await openLesson(page, { hash: '#stap-quiz' });
  await expect(page).toHaveURL(/#stap-quiz$/);
  const heading = step(page, 'quiz').getByRole('heading', { level: 2 });
  await expect(heading).toBeFocused();
  await expect(heading).toBeInViewport();
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(100);

  // Also when the lesson is opened directly, with a session.
  await page.goto('/');
  await page.goto('/leren/proefcursus/proefles#stap-zelf-doen');
  const practiceHeading = step(page, 'zelf-doen').getByRole('heading', { level: 2 });
  await expect(practiceHeading).toBeFocused();
  await expect(practiceHeading).toBeInViewport();
});
