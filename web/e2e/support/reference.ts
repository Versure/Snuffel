import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Page } from '@playwright/test';
import { expect } from '../fixtures';

// The reference lesson (docs/start/reference/les-01-roofvissen.html) next to les 1 in the app.
// The file is read from disk and served on the test server itself, so it makes no request to
// another host (privacy), and docs/start/ stays unchanged.

const root = resolve(__dirname, '..', '..', '..');
const referenceFile = resolve(root, 'docs', 'start', 'reference', 'les-01-roofvissen.html');
const fontsFile = resolve(root, 'web', 'src', 'styles', 'fonts.css');

export const referencePath = '/__reference/les-01-roofvissen.html';

/** The reference without the Google Fonts links, with our own `@font-face` rules in their place. */
export function referenceHtml(): string {
  const html = readFileSync(referenceFile, 'utf8');
  const withoutLinks = html.replace(
    /<link\b[^>]*(?:fonts\.googleapis\.com|fonts\.gstatic\.com)[^>]*>\s*/g,
    '',
  );
  const fonts = readFileSync(fontsFile, 'utf8');
  return withoutLinks.replace('</head>', `<style>\n${fonts}\n</style>\n</head>`);
}

/** Serves the reference on `referencePath` of the test server and opens it, fonts loaded. */
export async function openReference(page: Page): Promise<void> {
  await page.route(`**${referencePath}`, (route) =>
    route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: referenceHtml() }),
  );
  await page.goto(referencePath);
  await expect(page.locator('#oefenen .vraag')).toHaveCount(4);
  await fontsLoaded(page);
}

/** Waits until Bangers and Atkinson Hyperlegible (our own copies) are loaded. */
export async function fontsLoaded(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await Promise.all([
      document.fonts.load('1em Bangers'),
      document.fonts.load('1em "Atkinson Hyperlegible"'),
      document.fonts.load('bold 1em "Atkinson Hyperlegible"'),
    ]);
    await document.fonts.ready;
  });
}

/**
 * A fixed `Math.random` (mulberry32) for every page load after this call, so the reference and
 * the app shuffle the same way at every run. Call it before the navigation it should apply to.
 */
export async function seedRandom(page: Page, seed = 20261024): Promise<void> {
  await page.addInitScript((initial: number) => {
    let state = initial;
    Math.random = () => {
      state = (state + 0x6d2b79f5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }, seed);
}

export type Side = 'reference' | 'app';

/** A part of the lesson, as the selector of each side. */
export interface Part {
  readonly key: string;
  readonly title: string;
  readonly reference: string;
  readonly app: string;
}

/** The parts of the lesson that are shown side by side (step ids: uitleg, spel, quiz, water). */
export const parts: readonly Part[] = [
  { key: 'kop', title: 'Kop', reference: 'header.hero', app: 'header.hero' },
  { key: 'uitleg', title: 'Uitleg', reference: 'section#uitleg', app: 'section#stap-uitleg' },
  { key: 'spel', title: 'Voel-spel', reference: 'section#spel', app: 'section#stap-spel' },
  { key: 'quiz', title: 'Quiz', reference: 'section#quiz', app: 'section#stap-quiz' },
  { key: 'water', title: 'Aan het water', reference: 'section#water', app: 'section#stap-water' },
];

/** What is measured of an element. */
export type Kind = 'font' | 'color' | 'background' | 'border' | 'shadow' | 'size';

/** One comparison of the house style: the same part in the reference and in the app. */
export interface StyleCheck {
  readonly name: string;
  readonly kind: Kind;
  readonly reference: string;
  readonly app: string;
  /** `false`: shown in the comparison, not asserted (a known difference, see the plan). */
  readonly asserted?: boolean;
}

const explainText = {
  reference: 'section#uitleg > p',
  app: 'section#stap-uitleg snf-text-block p',
};

/**
 * The house style, exactly the list of plan M13 (open question 6): page background; fonts of h1,
 * h2, the bubble, the buttons (Bangers) and running text (Atkinson Hyperlegible); colour of h1;
 * background of the sticker, the band, the rule, the goal frame, the game panel and the signal
 * cards; the ink border of 3 px and the hard shadow of the signal cards.
 */
export const styleChecks: readonly StyleCheck[] = [
  { name: 'pagina', kind: 'background', reference: 'body', app: 'body' },
  { name: 'h1', kind: 'font', reference: 'h1', app: 'h1' },
  { name: 'h2', kind: 'font', reference: 'section#uitleg h2', app: 'section#stap-uitleg h2' },
  {
    name: 'ballon',
    kind: 'font',
    reference: '.hero-rij .ballon',
    app: 'snf-ted-says.intro snf-speech-bubble',
  },
  { name: 'knop Start', kind: 'font', reference: '#start', app: 'snf-trace-game button.start' },
  { name: 'keuzeknop', kind: 'font', reference: '.keuze', app: 'snf-trace-game button.choice' },
  { name: 'lopende tekst', kind: 'font', ...explainText },
  { name: 'h1', kind: 'color', reference: 'h1', app: 'h1' },
  { name: 'sticker', kind: 'background', reference: '.les-sticker', app: 'snf-sticker' },
  { name: 'band', kind: 'background', reference: 'h1 .band', app: 'h1 snf-band' },
  {
    name: 'regel',
    kind: 'background',
    reference: 'section#uitleg .regel',
    app: 'snf-rule-block .rule',
  },
  { name: 'doel-kader', kind: 'background', reference: '.doel', app: 'header.hero .objective' },
  { name: 'voel-spel-paneel', kind: 'background', reference: '.spel', app: 'snf-trace-game .game' },
  {
    name: 'signaalkaart',
    kind: 'background',
    reference: '.signaal',
    app: 'snf-signal-cards-block li.card',
  },
  {
    name: 'signaalkaart',
    kind: 'border',
    reference: '.signaal',
    app: 'snf-signal-cards-block li.card',
  },
  {
    name: 'signaalkaart',
    kind: 'shadow',
    reference: '.signaal',
    app: 'snf-signal-cards-block li.card',
  },
  // Shown, not asserted: the rule is ink on pink in the app (WCAG AA, decision M2 of the plan).
  {
    name: 'regel (tekstkleur)',
    kind: 'color',
    reference: 'section#uitleg .regel',
    app: 'snf-rule-block .rule',
    asserted: false,
  },
  { name: 'lopende tekst', kind: 'size', ...explainText, asserted: false },
  { name: 'h1', kind: 'size', reference: 'h1', app: 'h1', asserted: false },
  {
    name: 'h2',
    kind: 'size',
    reference: 'section#uitleg h2',
    app: 'section#stap-uitleg h2',
    asserted: false,
  },
  {
    name: 'stap in de navigatie',
    kind: 'background',
    reference: '.stappen li',
    app: 'snf-step-nav li',
    asserted: false,
  },
  {
    name: 'rondje in de navigatie',
    kind: 'background',
    reference: '.stappen .nr',
    app: 'snf-step-nav .number',
    asserted: false,
  },
  {
    name: 'plakbriefje',
    kind: 'background',
    reference: '.briefje',
    app: 'snf-sticky-note',
    asserted: false,
  },
];

/** One measured value of one side. */
export interface Measured {
  readonly name: string;
  readonly kind: Kind;
  readonly property: string;
  readonly value: string;
}

/** Measures every check of `styleChecks` on the page that is open (the reference or the app). */
export async function measureStyles(page: Page, side: Side): Promise<Measured[]> {
  const items = styleChecks.map((check) => ({
    name: check.name,
    kind: check.kind,
    selector: check[side],
  }));
  return page.evaluate((list) => {
    // The first element with a background of its own, from the element up to the page.
    const background = (element: Element | null): string => {
      for (let node = element; node; node = node.parentElement) {
        const value = getComputedStyle(node).backgroundColor;
        if (value !== 'rgba(0, 0, 0, 0)' && value !== 'transparent') return value;
      }
      return 'transparent';
    };
    return list.map(({ name, kind, selector }) => {
      const element = document.querySelector(selector);
      if (!element) return { name, kind, property: kind, value: `(niet gevonden: ${selector})` };
      const style = getComputedStyle(element);
      switch (kind) {
        case 'font':
          return {
            name,
            kind,
            property: 'font-family',
            value: style.fontFamily
              .split(',')[0]
              .trim()
              .replace(/^["']|["']$/g, ''),
          };
        case 'color':
          return { name, kind, property: 'color', value: style.color };
        case 'background':
          return { name, kind, property: 'background-color', value: background(element) };
        case 'border':
          return {
            name,
            kind,
            property: 'border',
            value: `${style.borderTopWidth} ${style.borderTopStyle} ${style.borderTopColor}`,
          };
        case 'shadow':
          return { name, kind, property: 'box-shadow', value: style.boxShadow };
        case 'size':
          return { name, kind, property: 'font-size', value: style.fontSize };
      }
    });
  }, items);
}
