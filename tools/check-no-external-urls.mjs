// Privacy gate: the app may not reference other hosts (fonts, CDNs, analytics).
// Scans app and PocketBase hook/migration sources for http(s) URLs. External links belong in lesson content, not in code.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const roots = ['web/src', 'web/public', 'pocketbase/pb_hooks', 'pocketbase/pb_migrations'];
const extensions = [
  '.ts',
  '.mts',
  '.js',
  '.mjs',
  '.cjs',
  '.html',
  '.css',
  '.json',
  '.svg',
  '.webmanifest',
  '.txt',
  '.xml',
];
// Only the generated content output (lesson sources may link out) and its staging dirs from
// content:build are skipped; app code in a directory called `content` is scanned like the rest.
const ignoredDirs = ['web/public/content'];
const ignoredDirPrefixes = ['web/public/.content-'];
// XML namespaces are identifiers, not network requests.
const allowed = [/^http:\/\/www\.w3\.org\//i];
// Case-insensitive: HTTPS://host loads just as well.
const urlPattern = /https?:\/\/[^\s'"`)<>]+/gi;

/** Path relative to the scanned base, always with forward slashes. */
function posixRelative(baseDir, path) {
  return relative(baseDir, path).split(sep).join('/');
}

function isIgnored(baseDir, dir) {
  const rel = posixRelative(baseDir, dir);
  return ignoredDirs.includes(rel) || ignoredDirPrefixes.some((prefix) => rel.startsWith(prefix));
}

function* walk(baseDir, dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      if (!isIgnored(baseDir, path)) yield* walk(baseDir, path);
    } else if (extensions.some((ext) => path.endsWith(ext))) {
      yield path;
    }
  }
}

/** Whether `dir` exists; only a missing directory counts, any other error is thrown. */
function exists(dir) {
  try {
    statSync(dir);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

/**
 * Every external URL in the scanned roots below `baseDir`, as `file:line  url`. A missing root is
 * an error (a renamed directory would otherwise silently go unscanned), unless `allowMissingRoots`
 * is set, which the tests use for small fixture projects.
 */
export function findExternalUrls(baseDir = '.', { allowMissingRoots = false } = {}) {
  const findings = [];
  for (const root of roots) {
    const rootDir = join(baseDir, root);
    if (!exists(rootDir)) {
      if (allowMissingRoots) continue;
      throw new Error(`privacy: directory ${root} not found; run from the repository root`);
    }
    for (const file of walk(baseDir, rootDir)) {
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, index) => {
        for (const [url] of line.matchAll(urlPattern)) {
          if (!allowed.some((pattern) => pattern.test(url))) {
            findings.push(`${posixRelative(baseDir, file)}:${index + 1}  ${url}`);
          }
        }
      });
    }
  }
  return findings;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const findings = findExternalUrls('.');
  if (findings.length > 0) {
    console.error('External URLs found in app source (privacy rule, see CLAUDE.md):');
    for (const finding of findings) console.error(`  ${finding}`);
    process.exit(1);
  }
  console.log('privacy: no external URLs in app source');
}
