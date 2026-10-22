// Figures: an svg in the course's assets directory that exists and loads nothing from elsewhere.
// (A non-empty alt text is enforced by the schema, reported as figure-alt-missing.)
import { existsSync, lstatSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// XML namespaces are identifiers, not requests (same rule as npm run privacy).
const allowedUrls = [/^http:\/\/www\.w3\.org\//];
const urlPattern = /https?:\/\/[^\s'"`)<>]+/g;
const protocolRelative = /(?:href|src)\s*=\s*["']\s*\/\//i;

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

export function checkAssets({ courses }) {
  const issues = [];
  for (const course of courses) {
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
        const external = externalReferences(readFileSync(file, 'utf8'));
        if (external.length > 0) {
          issue(
            'asset-external-ref',
            `${src} verwijst naar een andere site (${external.join(', ')}); een svg mag niets van buiten laden`,
          );
        }
      }
    }
  }
  return issues;
}
