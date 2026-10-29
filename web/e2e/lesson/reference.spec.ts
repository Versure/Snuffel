import type { Page } from '@playwright/test';
import { plainText } from '../../src/app/shared/inline-text/inline-markup';
import { expect, test } from '../fixtures';
import { loginAsNewChild } from '../support/accounts';
import {
  fontsLoaded,
  measureStyles,
  openReference,
  type Measured,
  parts,
  referenceHtml,
  referencePath,
  seedRandom,
  styleChecks,
  type Side,
} from '../support/reference';
import {
  reportDir,
  toRows,
  writeImage,
  writeIndex,
  type Report,
  type Scheme,
  type Shot,
  type StyleRow,
} from '../support/reference-report';
import { answer, checkbox, gameBlock, optionButton, settle, wrongOption } from './actions';
import { normalize } from './fixture';
import { les1, les1Courses, les1GameStep, les1Path, les1Quiz, les1Water } from './les-1';

// Les 1 next to the reference lesson (docs/start/reference/les-01-roofvissen.html). Lesson 1
// deliberately differs from the reference (plan M13, open question 10 and deviation 9): the
// tests follow the lesson file where they differ, and the differences are listed in index.html.

const schemes: readonly Scheme[] = ['light', 'dark'];
const referenceTitles = ['Wachten kost je de vis', 'Voel de lijn', 'Quiz', 'Aan het water'];
const referenceChoices = ['Vis!', 'Vast', 'Plant', 'Bodem'];

test.beforeEach(async ({ page }) => {
  // The same everywhere: lines drawn at once, no wiggling Ted.
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

/** Logs in as a new child and fixes `Math.random` for every load after this. */
async function start(page: Page): Promise<void> {
  await loginAsNewChild(page, les1Path, { courses: les1Courses });
  await seedRandom(page);
}

async function openApp(page: Page): Promise<void> {
  await page.goto(les1Path);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(plainText(les1.title).trim());
  await expect(
    gameBlock(page, les1GameStep).getByRole('button', { name: 'Start', exact: true }),
  ).toBeVisible();
  await expect(page.locator('main').getByText('Even laden…')).toHaveCount(0);
  await fontsLoaded(page);
}

async function open(page: Page, side: Side): Promise<void> {
  if (side === 'reference') await openReference(page);
  else await openApp(page);
}

interface Structure {
  sticker: string;
  h1: string;
  band: string;
  ballon: string;
  goal: string;
  navLabels: string[];
  stepTitles: string[];
  signalTitles: string[];
  rule: string;
  choices: string[];
  questions: number;
  optionCounts: number[];
  note: number;
  checkboxes: number;
}

const selectors = {
  reference: {
    sticker: '.les-sticker',
    h1: 'h1',
    band: 'h1 .band',
    ballon: '.hero-rij .ballon',
    goal: '.doel',
    navLabel: 'ol.stappen li a',
    stepNumber: '.nr',
    stepTitle: (id: string) => `section#${id} h2`,
    stepTitleNumber: '.stapnr',
    signal: '.signaal h3',
    rule: '.regel strong',
    choices: 'button.keuze',
    question: '.vraag',
    option: '.vraag .optie',
    note: '.briefje',
    checkbox: '.briefje input[type="checkbox"]',
  },
  app: {
    sticker: 'snf-sticker',
    h1: 'h1',
    band: 'h1 snf-band',
    ballon: 'snf-ted-says.intro snf-speech-bubble',
    goal: 'header.hero .objective',
    navLabel: 'snf-step-nav li a',
    stepNumber: '.number',
    stepTitle: (id: string) => `section#stap-${id} h2`,
    stepTitleNumber: '.number',
    signal: 'snf-signal-cards-block li.card h3',
    rule: 'snf-rule-block .rule .title',
    choices: 'snf-trace-game button.choice',
    question: 'snf-quiz-question',
    option: 'snf-quiz-question button.option',
    note: 'snf-sticky-note',
    checkbox: 'snf-sticky-note input[type="checkbox"]',
  },
} as const;

async function structure(page: Page, side: Side): Promise<Structure> {
  const sel = selectors[side];
  const stepIds = ['uitleg', 'spel', 'quiz', 'water'];
  return page.evaluate(
    ({ sel, stepIds, side }) => {
      const clean = (text: string | null | undefined): string =>
        (text ?? '').replace(/\s+/g, ' ').trim();
      const one = (selector: string): string =>
        clean((document.querySelector(selector) as HTMLElement | null)?.innerText);
      const all = (selector: string): string[] =>
        [...document.querySelectorAll<HTMLElement>(selector)].map((element) =>
          clean(element.innerText),
        );
      // The text of an element without the number in front of it.
      const without = (element: Element, numberSelector: string): string => {
        const copy = element.cloneNode(true) as HTMLElement;
        copy.querySelectorAll(numberSelector).forEach((number) => number.remove());
        return clean(copy.textContent);
      };
      const navLabels = [...document.querySelectorAll(sel.navLabel)].map((link) =>
        side === 'app'
          ? clean(link.querySelector('.label')?.textContent)
          : without(link, sel.stepNumber),
      );
      const stepTitles = stepIds.map((id) => {
        const heading = document.querySelector(
          side === 'app' ? `section#stap-${id} h2` : `section#${id} h2`,
        );
        return heading ? without(heading, sel.stepTitleNumber) : '(niet gevonden)';
      });
      const questions = [...document.querySelectorAll(sel.question)];
      return {
        sticker: one(sel.sticker),
        h1: one(sel.h1),
        band: one(sel.band),
        ballon: one(sel.ballon),
        goal: one(sel.goal),
        navLabels,
        stepTitles,
        signalTitles: all(sel.signal),
        rule: one(sel.rule),
        choices: all(sel.choices),
        questions: questions.length,
        optionCounts: questions.map(
          (question) =>
            question.querySelectorAll(side === 'app' ? 'button.option' : '.optie').length,
        ),
        note: document.querySelectorAll(sel.note).length,
        checkboxes: document.querySelectorAll(sel.checkbox).length,
      };
    },
    { sel: { ...sel, stepTitle: undefined }, stepIds, side },
  );
}

test.describe('the reference lesson and les 1', () => {
  test('the reference makes no request to another host', async ({ page, baseURL }) => {
    const origin = new URL(baseURL!).origin;
    const requests: string[] = [];
    page.on('request', (request) => requests.push(request.url()));
    await start(page);
    requests.length = 0;
    await openReference(page);

    // Nothing but our own server, and the reference itself came through our route.
    expect(requests.length).toBeGreaterThan(0);
    for (const url of requests) expect(new URL(url).origin, url).toBe(origin);
    expect(requests.some((url) => url.endsWith(referencePath))).toBe(true);
    // The Google Fonts links are gone, our fonts are in their place.
    const html = referenceHtml();
    expect(html).not.toMatch(/<link\b[^>]*(googleapis|gstatic)/);
    expect(html).not.toContain('fonts.googleapis.com');
    expect(html).toContain("font-family: 'Bangers'");
    // The fonts of the reference are the fonts of our own server, really loaded.
    const loaded = await page.evaluate(() =>
      [...document.fonts]
        .filter((face) => face.status === 'loaded')
        .map((face) => `${face.family.replace(/["']/g, '')} ${face.weight}`),
    );
    expect(loaded).toEqual(
      expect.arrayContaining([
        'Bangers 400',
        'Atkinson Hyperlegible 400',
        'Atkinson Hyperlegible 700',
      ]),
    );
    expect(await page.evaluate(() => document.fonts.check('1em Bangers'))).toBe(true);
    expect(
      await page.evaluate(() => getComputedStyle(document.querySelector('h1')!).fontFamily),
    ).toMatch(/^"?Bangers/);
  });

  test('les 1 has the structure of the reference', async ({ page }) => {
    await start(page);
    await openReference(page);
    const reference = await structure(page, 'reference');
    await openApp(page);
    const app = await structure(page, 'app');

    // Equal.
    expect(app.sticker).toBe(reference.sticker);
    expect(app.sticker).toBe(plainText(les1.sticker));
    expect(app.h1).toBe(reference.h1);
    expect(app.band).toBe(reference.band);
    expect(reference.band).toBe('vastzitten?');
    expect(app.navLabels).toHaveLength(4);
    expect(reference.navLabels).toHaveLength(4);
    expect(app.stepTitles.slice(1)).toEqual(reference.stepTitles.slice(1));
    expect(app.signalTitles).toHaveLength(3);
    expect(app.signalTitles).toEqual(reference.signalTitles);
    expect(app.rule).toBe('Twijfel? Sla aan!');
    expect(app.rule).toBe(reference.rule);
    expect(app.questions).toBe(4);
    expect(app.questions).toBe(reference.questions);
    expect(app.optionCounts).toEqual([4, 4, 4, 4]);
    expect(app.optionCounts).toEqual(reference.optionCounts);
    expect(app.note).toBe(1);
    expect(reference.note).toBe(1);

    // Known differences: les 1 follows its own file (plan M13, deviation 9).
    expect(reference.stepTitles[0]).toBe(referenceTitles[0]);
    expect(app.stepTitles[0]).toBe(plainText(les1.steps[0].title));
    expect(app.stepTitles[0]).toBe('Leer je lijn kennen');
    // The step navigation says "Spel" for every trace game (M7), the reference "Voel-spel".
    expect(reference.navLabels).toEqual(['Uitleg', 'Voel-spel', 'Quiz', 'Aan het water']);
    expect(app.navLabels).toEqual(['Uitleg', 'Spel', 'Quiz', 'Aan het water']);
    // Three choices: Vis!, Vast, Bodem, no Plant.
    expect(reference.choices).toEqual(referenceChoices);
    expect(app.choices).toEqual(
      les1GameStep.interaction.kind === 'trace-game'
        ? les1GameStep.interaction.config.choices.map((choice) => plainText(choice.label))
        : [],
    );
    expect(app.choices).toEqual(['Vis!', 'Vast', 'Bodem']);
    expect(app.choices).toEqual(referenceChoices.filter((choice) => choice !== 'Plant'));
    // Five checklist items in both, but not the same five: the reference has "Gelukt als …" as
    // its fifth checkbox, les 1 shows it below the note without a tick.
    expect(app.checkboxes).toBe(les1Water.items.length);
    expect(app.checkboxes).toBe(5);
    expect(reference.checkboxes).toBe(5);
    // Texts that were rewritten after the review (known differences, listed in index.html).
    expect(app.ballon).toBe(normalize(plainText(les1.ted.intro.text)));
    expect(app.goal).toBe(normalize(plainText(les1.objective)));
  });

  for (const scheme of schemes) {
    test(`les 1 has the fonts and colours of the reference in ${scheme} mode`, async ({ page }) => {
      await start(page);
      await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: scheme });
      await openReference(page);
      const reference = await measureStyles(page, 'reference');
      await openApp(page);
      const app = await measureStyles(page, 'app');
      expect(app).toHaveLength(styleChecks.length);
      for (const [index, check] of styleChecks.entries()) {
        const where = `${check.name} (${reference[index].property}, ${scheme})`;
        // Never "not found" on one side: a changed page would pass by being empty on both.
        expect(reference[index].value, `reference: ${where}`).not.toContain('niet gevonden');
        expect(app[index].value, `app: ${where}`).not.toContain('niet gevonden');
        if (check.asserted === false) continue;
        expect.soft(app[index].value, where).toBe(reference[index].value);
        if (check.kind === 'font') {
          const expected = check.name === 'lopende tekst' ? 'Atkinson Hyperlegible' : 'Bangers';
          expect.soft(app[index].value, `${where}: the font itself`).toBe(expected);
        }
        if (check.kind === 'border') {
          expect.soft(app[index].value.startsWith('3px solid'), `${where}: 3px`).toBe(true);
        }
        if (check.kind === 'shadow') {
          // Hard: an offset and no blur ("rgb(…) 4px 4px 0px 0px").
          const match = /^(rgba?\([^)]*\)) (-?\d+px) (-?\d+px) (\d+px)/.exec(app[index].value);
          expect.soft(match, `${where}: ${app[index].value}`).not.toBeNull();
          expect.soft(match?.[4], `${where}: no blur`).toBe('0px');
          expect.soft(match?.[2] !== '0px' && match?.[3] !== '0px', `${where}: offset`).toBe(true);
        }
      }
    });
  }

  test('writes the side-by-side comparison of the reference and les 1', async ({
    page,
  }, testInfo) => {
    const project = testInfo.project.name;
    const dir = reportDir(project);
    await start(page);
    const styles: StyleRow[] = [];
    const files = new Map<string, Record<Side, string>>();
    const sides = ['reference', 'app'] as const;

    // One screenshot of a part, written to the folder and attached to the Playwright report.
    const shoot = async (scheme: Scheme, key: string, side: Side, selector: string) => {
      const body = await page
        .locator(selector)
        .first()
        .screenshot({ scale: 'css', animations: 'disabled' });
      const name = writeImage(dir, `${scheme}-${key}-${side}.png`, body);
      await testInfo.attach(`${project} ${scheme} ${key} ${side}`, {
        body,
        contentType: 'image/png',
      });
      const id = `${scheme}/${key}`;
      files.set(id, { ...(files.get(id) ?? { reference: '', app: '' }), [side]: name });
    };

    // First the parts as a child finds them (and the measured styles), then, once the app has
    // stored answers and ticks (it shows them again after a reload), the parts with some work done.
    for (const scheme of schemes) {
      await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: scheme });
      const measured = { reference: [] as Measured[], app: [] as Measured[] };
      for (const side of sides) {
        await open(page, side);
        measured[side] = await measureStyles(page, side);
        for (const part of parts) await shoot(scheme, part.key, side, part[side]);
      }
      styles.push(
        ...toRows(
          scheme,
          measured.reference,
          measured.app,
          styleChecks.map((check) => check.asserted !== false),
        ),
      );
    }
    const [first, second] = les1Quiz.questions;
    for (const scheme of schemes) {
      await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: scheme });
      for (const side of sides) {
        await open(page, side);
        if (side === 'reference') {
          await page.locator('.vraag').nth(0).locator('.optie[data-goed="1"]').click();
          await page.locator('.vraag').nth(1).locator('.optie:not([data-goed])').first().click();
          await page.locator('#c1').check();
          await page.locator('#c2').check();
        } else if (await optionButton(page, first, first.correctOptionId, les1Quiz).isEnabled()) {
          await answer(page, first, first.correctOptionId, les1Quiz);
          await answer(page, second, wrongOption(second), les1Quiz);
          await checkbox(page, les1Water.items[0].id, les1Water).check();
          await checkbox(page, les1Water.items[1].id, les1Water).check();
          await settle(page);
        }
        await shoot(
          scheme,
          'quiz-antwoorden',
          side,
          side === 'app' ? 'section#stap-quiz' : 'section#quiz',
        );
        await shoot(
          scheme,
          'water-vinkjes',
          side,
          side === 'app' ? 'section#stap-water' : 'section#water',
        );
      }
    }

    const extra = [
      { key: 'quiz-antwoorden', title: 'Quiz, twee vragen beantwoord (eerste goed, tweede fout)' },
      { key: 'water-vinkjes', title: 'Aan het water, twee punten afgevinkt' },
    ].map((item) => ({ ...item, reference: '', app: '' }));
    const shots: Shot[] = [];
    for (const scheme of schemes) {
      for (const part of [...parts, ...extra]) {
        const pair = files.get(`${scheme}/${part.key}`)!;
        shots.push({ scheme, part, reference: pair.reference, app: pair.app });
      }
    }
    const viewport = page.viewportSize();
    const report: Report = {
      project,
      viewport: viewport ? `${viewport.width} × ${viewport.height}` : '',
      shots,
      styles,
      known: knownDifferences(),
    };
    const index = writeIndex(dir, report);
    await testInfo.attach(`${project} index.html`, { path: index, contentType: 'text/html' });
    expect(shots.length).toBe(schemes.length * (parts.length + 2));
    for (const shot of shots) {
      expect(shot.reference, `${shot.scheme} ${shot.part.key}`).not.toBe('');
      expect(shot.app, `${shot.scheme} ${shot.part.key}`).not.toBe('');
    }
  });
});

/** The known, deliberate differences with the reference (plan M13: open questions 7 and 10). */
function knownDifferences(): [string, string, string][] {
  const game =
    les1GameStep.interaction.kind === 'trace-game' ? les1GameStep.interaction.config : null;
  return [
    ['Titel van stap 1', referenceTitles[0], plainText(les1.steps[0].title)],
    [
      'Keuzes in het voel-spel',
      referenceChoices.join(', '),
      (game?.choices ?? []).map((choice) => plainText(choice.label)).join(', ') +
        ' (geen Plant: niets in de bronnen dekt dat patroon)',
    ],
    [
      'Checklist',
      '5 vinkjes; het vijfde is "Gelukt als …" (met vinkje)',
      `${les1Water.items.length} vinkjes (${les1Water.items.map((item) => item.id).join(', ')}); "Gelukt als …" staat eronder, zonder vinkje`,
    ],
    [
      'Quizvragen 3 en 4',
      'Tellen tijdens het zakken; groen sliertje',
      `${les1Quiz.questions[2].id}; ${les1Quiz.questions[3].id} (nieuwe vragen, nieuwe id’s)`,
    ],
    [
      'Quiz: uitleg',
      'Een uitleg per vraag, met "Klopt." of "Niet helemaal."',
      'Feedback per gekozen optie, met een regel van Ted',
    ],
    [
      'Tekst van Teds ballon',
      'Yo! Ik ben Ted. Bij kunstaas is je hand de beetmelder.',
      plainText(les1.ted.intro.text),
    ],
    [
      'Doel-kader',
      'Na deze les weet je hoe een aanbeet van een roofvis voelt …',
      plainText(les1.objective),
    ],
    [
      'Stappen-navigatie, uiterlijk',
      'Losse rondjes (vlak) zonder kader',
      'Elke stap een kaartje met rand en een roze rondje (gemeten, niet getoetst)',
    ],
    [
      'Voorbeeld en tip',
      'Gewone alinea\u2019s',
      'Voorbeeld en tip als kaart (bloktypen example en tip)',
    ],
    ['Krabbel (bliksem) in de kop', 'Ja', 'Nee'],
    ['Stappen-navigatie, stap 2', 'Voel-spel', 'Spel (elke trace-game heet zo, M7)'],
    [
      'Bronnen',
      '"bron"-link achter drie zinnen',
      '"Bron:" met de uitgever onder elk blok en elke kaart',
    ],
    [
      'Aan het eind',
      'Verder lezen (Visblad), "Vragen? Vraag het in de chat", footer met Leerdossier',
      `Woordenlijst, Verder lezen met uitgever, Vragen (${les1.faq.length} vragen); geen chat, geen footer`,
    ],
    [
      'Kop',
      'Geen tijd, geen terugknop',
      `"Ongeveer ${les1.estimatedMinutes} minuten" en "Naar de lessen"`,
    ],
    ['Kleur van de tekst in de regel', 'Wit op roze', 'Inkt op roze (WCAG AA, beslissing M2)'],
  ];
}
