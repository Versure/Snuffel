// `npm run content:figures -- <course-id|path> …`: renders every svg of a course (or the svgs in
// a file or directory, such as content/illustrations/templates) to png in tmp/figures/<name>/,
// on the light card of the figure block, in the light and the dark theme, at phone and laptop
// width. The snuffel-leren skill and content-reviewer look at these pngs before a lesson is
// reviewed (M16): a drawing written as code is easy to get wrong.
//
// Each svg gives four files: <svg>-telefoon-licht.png, -telefoon-donker, -laptop-licht and
// -laptop-donker. Under the card the png shows the alt and the caption from the lesson, so the
// picture and its text can be compared. The page is built locally; nothing is loaded from
// elsewhere. Chromium comes from Playwright; PLAYWRIGHT_CHROMIUM_PATH picks another build (as
// in web/playwright.config.ts).
//
// Usage: node tools/content/render-figures.mjs <course-id|path> … [--out <dir>] [--root <dir>]
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { basename, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { chromium } from '@playwright/test';
import { repoRoot } from './check.mjs';
import { loadContent } from './load.mjs';
import { courseSvgs } from './rules/assets.mjs';

export const defaultOutDir = join(repoRoot, 'tmp', 'figures');

/** Widths of the figure card in CSS pixels: a phone, and the lesson column on a laptop. */
export const variants = [
  { device: 'telefoon', pageWidth: 360, scale: 2 },
  { device: 'laptop', pageWidth: 672, scale: 1 },
];

/** The page colours of the app (web/src/styles/tokens.css); the card is cream in both. */
export const themes = {
  licht: { background: '#ffd83d', ink: '#141414', text: '#141414' },
  donker: { background: '#1d1036', ink: '#0b0614', text: '#fff6dc' },
};

const escapeHtml = (text) =>
  text.replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
  );

/** `assets/vissen/snoek.svg` becomes `vissen-snoek`. */
export function outputStem(rel) {
  return rel
    .replace(/^assets\//, '')
    .replace(/\.svg$/, '')
    .split(/[/\\]/)
    .join('-');
}

/**
 * The figures of a target: a course id (from content/courses or content/fixtures/courses) or a
 * path to an svg file or a directory with svgs. Returns `{ name, figures }` with figures
 * `[{ file, stem, uses: [{ lesson, alt, caption }] }]`; throws when the target is unknown.
 */
export function findFigures(target, { root = repoRoot } = {}) {
  const course = loadContent(root, { fixtures: true }).courses.find(
    (candidate) => candidate.name === target || candidate.data?.id === target,
  );
  if (course) {
    const uses = new Map();
    for (const lessonFile of course.lessonFiles) {
      if (!lessonFile.data?.steps) continue;
      lessonFile.data.steps.forEach((step) => {
        if (step.type !== 'explain') return;
        for (const block of step.blocks) {
          if (block.type !== 'figure') continue;
          const list = uses.get(block.src) ?? [];
          list.push({ lesson: lessonFile.data.id, alt: block.alt, caption: block.caption });
          uses.set(block.src, list);
        }
      });
    }
    // An svg that no lesson uses is rendered too (content:check warns about it).
    const sources = new Set([...courseSvgs(course.dir), ...uses.keys()]);
    const figures = [...sources]
      .sort()
      .filter((src) => existsSync(join(course.dir, ...src.split('/'))))
      .map((src) => ({
        file: join(course.dir, ...src.split('/')),
        stem: outputStem(src),
        uses: uses.get(src) ?? [],
      }));
    return { name: course.name, figures };
  }

  const path = resolve(root, target);
  if (existsSync(path) && statSync(path).isFile() && path.endsWith('.svg')) {
    return {
      name: basename(path, '.svg'),
      figures: [{ file: path, stem: basename(path, '.svg'), uses: [] }],
    };
  }
  if (existsSync(path) && statSync(path).isDirectory()) {
    const files = readdirSync(path, { recursive: true })
      .map(String)
      .filter((name) => name.endsWith('.svg'))
      .sort();
    return {
      name: basename(path),
      figures: files.map((name) => ({
        file: join(path, name),
        stem: name
          .replace(/\.svg$/, '')
          .split(sep)
          .join('-'),
        uses: [],
      })),
    };
  }
  throw new Error(`"${target}" is geen cursus-id, svg-bestand of map`);
}

/** The html page of one figure: the card of the figure block, with alt and caption below it. */
export function figurePage(svg, { uses = [], theme, pageWidth }) {
  const colors = themes[theme];
  const notes = uses
    .map(
      ({ lesson, alt, caption }) =>
        `<p><b>${escapeHtml(lesson)}</b>, alt: ${escapeHtml(alt)}${
          caption ? `<br>onderschrift: ${escapeHtml(caption)}` : ''
        }</p>`,
    )
    .join('');
  const src = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  return `<!doctype html>
<html lang="nl"><head><meta charset="utf-8"><style>
  body { margin: 0; background: ${colors.background}; color: ${colors.text};
    font: 14px/1.4 Verdana, sans-serif; }
  .page { box-sizing: border-box; width: ${pageWidth}px; padding: 16px; }
  .frame { padding: 0.6rem; background: #fff6dc; border: 3px solid ${colors.ink};
    border-radius: 16px; box-shadow: 4px 4px 0 ${colors.ink}; }
  img { display: block; width: 100%; height: auto; }
  p { margin: 10px 0 0; }
</style></head><body><div class="page"><div class="frame"><img alt="" src="${src}"></div>${notes}</div></body></html>`;
}

/**
 * Renders the figures of every target to `<outDir>/<name>/`, replacing what was there.
 * Returns `[{ name, files: [png path] }]`. Throws when an svg does not load as an image.
 */
export async function renderFigures(
  targets,
  {
    root = repoRoot,
    outDir = defaultOutDir,
    executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
  } = {},
) {
  const found = targets.map((target) => findFigures(target, { root }));
  const browser = await chromium.launch({ executablePath });
  const results = [];
  try {
    for (const { name, figures } of found) {
      const dir = join(outDir, name);
      rmSync(dir, { recursive: true, force: true });
      mkdirSync(dir, { recursive: true });
      const files = [];
      for (const variant of variants) {
        const context = await browser.newContext({
          viewport: { width: variant.pageWidth, height: 800 },
          deviceScaleFactor: variant.scale,
          // Nothing leaves the machine: every request other than the page itself is refused.
          offline: true,
        });
        const page = await context.newPage();
        for (const figure of figures) {
          const svg = readFileSync(figure.file, 'utf8');
          for (const theme of Object.keys(themes)) {
            await page.setContent(
              figurePage(svg, { uses: figure.uses, theme, pageWidth: variant.pageWidth }),
            );
            const loaded = await page.locator('img').evaluate(async (img) => {
              await img.decode().catch(() => undefined);
              return img.naturalWidth > 0;
            });
            if (!loaded) {
              throw new Error(`${relative(root, figure.file)} laadt niet als afbeelding`);
            }
            const file = join(dir, `${figure.stem}-${variant.device}-${theme}.png`);
            await page.locator('.page').screenshot({ path: file });
            files.push(file);
          }
        }
        await context.close();
      }
      results.push({ name, files: files.sort() });
    }
  } finally {
    await browser.close();
  }
  return results;
}

export function parseRenderArgs(argv) {
  const { values, positionals } = parseArgs({
    args: argv,
    options: { out: { type: 'string' }, root: { type: 'string' } },
    allowPositionals: true,
  });
  if (positionals.length === 0) {
    throw new Error('geef een cursus-id of een pad, bijv. npm run content:figures -- blind-typen');
  }
  return {
    targets: positionals,
    root: values.root ? resolve(values.root) : repoRoot,
    outDir: values.out ? resolve(values.out) : defaultOutDir,
  };
}

async function main() {
  let options;
  try {
    options = parseRenderArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`content:figures: ${error.message}`);
    process.exit(2);
  }
  try {
    const results = await renderFigures(options.targets, options);
    for (const { name, files } of results) {
      console.log(`content:figures: ${name}: ${files.length} png's`);
      for (const file of files) console.log(`  ${relative(process.cwd(), file)}`);
    }
  } catch (error) {
    console.error(`content:figures: ${error.message}`);
    process.exit(1);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
