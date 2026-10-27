// Figures: an svg in the course's assets directory that exists, loads nothing from elsewhere and
// follows the illustration style guide (content/illustrations/README.md, M16): palette colours,
// no code, a viewBox, short labels in the agreed font, at most 40 kB. An svg in assets/ that no
// lesson uses is a warning. (A non-empty alt text is enforced by the schema, figure-alt-missing.)
import { existsSync, lstatSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { analyzeSvg, loadPalette } from '../svg.mjs';

// XML namespaces are identifiers, not requests (same rule as npm run privacy).
const allowedUrls = [/^http:\/\/www\.w3\.org\//i];
const urlPattern = /https?:\/\/[^\s'"`)<>]+/gi;
const protocolRelative = /(?:href|src)\s*=\s*["']\s*\/\/|url\(\s*['"]?\s*\/\//i;

/** True when `src` is a relative path below assets/ ending in .svg, without `..`. */
export function isValidAssetPath(src) {
  if (!src.startsWith('assets/') || !src.endsWith('.svg')) return false;
  if (src.includes('\\') || src.includes('//')) return false;
  return src.split('/').every((segment) => segment !== '..' && segment !== '.' && segment !== '');
}

/**
 * True when `src` (a valid asset path) or one of its directories below the course directory is a
 * symbolic link. A link could point outside the course, so it is refused.
 */
export function hasSymlink(courseDir, src) {
  const segments = src.split('/');
  for (let i = 1; i <= segments.length; i++) {
    let stats;
    try {
      stats = lstatSync(join(courseDir, ...segments.slice(0, i)));
    } catch {
      return false; // does not exist: asset-missing reports it
    }
    if (stats.isSymbolicLink()) return true;
  }
  return false;
}

/** The figures of a lesson: `[{ src, path }]` (path is the JSON path of src). */
export function lessonFigures(lesson) {
  const figures = [];
  lesson.steps.forEach((step, s) => {
    if (step.type !== 'explain') return;
    step.blocks.forEach((block, b) => {
      if (block.type === 'figure')
        figures.push({ src: block.src, path: `steps[${s}].blocks[${b}].src` });
    });
  });
  return figures;
}

/** External references in an svg: every http(s) url except XML namespaces, and `//host` links. */
export function externalReferences(svg) {
  const found = [...svg.matchAll(urlPattern)]
    .map(([url]) => url)
    .filter((url) => !allowedUrls.some((pattern) => pattern.test(url)));
  if (protocolRelative.test(svg)) found.push('//…');
  return found;
}

/** At most `max` different findings, then "…". */
function list(findings, max = 10) {
  const unique = [...new Set(findings)];
  return unique.length > max ? `${unique.slice(0, max).join(', ')}, …` : unique.join(', ');
}

/** `kB` with one decimal at most, as people read it (40960 bytes is 40 kB). */
function kilobytes(bytes) {
  return `${Math.round((bytes / 1024) * 10) / 10} kB`;
}

/**
 * The style and safety issues of one svg (an issue is `[code, message]`), per the rules in
 * content/illustrations/palette.json.
 */
export function svgIssues(src, svg, size, palette = loadPalette()) {
  const issues = [];
  const { colors, unsafe, viewBox, text } = analyzeSvg(svg, palette);
  if (colors.length > 0) {
    issues.push([
      'asset-color-off-palette',
      `${src} gebruikt kleuren buiten het palet (${list(colors)}); gebruik alleen de kleuren uit content/illustrations/palette.json, zonder verloop en zonder doorzichtigheid`,
    ]);
  }
  if (unsafe.length > 0) {
    issues.push([
      'asset-unsafe-content',
      `${src} bevat iets wat geen tekening is (${list(unsafe)}); een svg mag geen code, ingepakte bestanden of verwijzingen naar andere bestanden bevatten`,
    ]);
  }
  if (viewBox) {
    issues.push([
      'asset-viewbox-missing',
      `${src}: ${viewBox}; zet een viewBox op <svg> (bijv. viewBox="0 0 400 240"), anders schaalt hij niet mee op een telefoon`,
    ]);
  }
  if (text.length > 0) {
    issues.push([
      'asset-text-invalid',
      `${src}: ${list(text)}; een label is hoogstens ${palette.font.maxTextLength} tekens, met font-family="${palette.font.family}" en font-weight ${palette.font.weights.join(' of ')}`,
    ]);
  }
  if (size > palette.maxBytes) {
    issues.push([
      'asset-too-large',
      `${src} is ${kilobytes(size)} (hoogstens ${kilobytes(palette.maxBytes)}); maak de tekening eenvoudiger`,
    ]);
  }
  return issues;
}

/** Every .svg below the assets/ directory of a course, as `assets/…` paths (no symlinks). */
export function courseSvgs(courseDir) {
  const found = [];
  const walk = (dir, rel) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const entryRel = `${rel}/${entry.name}`;
      if (entry.isDirectory()) walk(join(dir, entry.name), entryRel);
      else if (entry.isFile() && entry.name.endsWith('.svg')) found.push(entryRel);
    }
  };
  const assetsDir = join(courseDir, 'assets');
  if (existsSync(assetsDir) && lstatSync(assetsDir).isDirectory()) walk(assetsDir, 'assets');
  return found.sort();
}

export function checkAssets({ courses }) {
  const issues = [];
  const palette = loadPalette();
  for (const course of courses) {
    const used = new Set();
    for (const lesson of course.lessons) {
      for (const { src, path } of lessonFigures(lesson.data)) {
        const issue = (code, message) => issues.push({ code, file: lesson.file, path, message });
        if (!isValidAssetPath(src)) {
          issue(
            'asset-path-invalid',
            `"${src}" moet een .svg in de map assets/ van de cursus zijn (zonder ..)`,
          );
          continue;
        }
        if (hasSymlink(course.dir, src)) {
          issue(
            'asset-path-invalid',
            `"${src}" is een snelkoppeling (symlink); zet het echte bestand in de map assets/`,
          );
          continue;
        }
        const file = join(course.dir, ...src.split('/'));
        if (!existsSync(file) || !statSync(file).isFile()) {
          issue('asset-missing', `afbeelding ${course.relDir}/${src} bestaat niet`);
          continue;
        }
        used.add(src);
        const svg = readFileSync(file, 'utf8');
        const external = externalReferences(svg);
        if (external.length > 0) {
          issue(
            'asset-external-ref',
            `${src} verwijst naar een andere site (${external.join(', ')}); een svg mag niets van buiten laden`,
          );
        }
        for (const [code, message] of svgIssues(src, svg, statSync(file).size, palette)) {
          issue(code, message);
        }
      }
    }
    for (const src of courseSvgs(course.dir)) {
      if (used.has(src)) continue;
      issues.push({
        code: 'asset-unused',
        severity: 'warning',
        file: `${course.relDir}/${src}`,
        path: '',
        message: `geen les gebruikt deze afbeelding; zet hem in een figure of haal hem weg`,
      });
    }
  }
  return issues;
}
