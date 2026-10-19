// Privacy gate: the app may not reference other hosts (fonts, CDNs, analytics).
// Scans app source files for http(s) URLs. External links belong in lesson content, not in code.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const roots = ['web/src', 'web/public'];
const extensions = ['.ts', '.html', '.css', '.json', '.svg', '.webmanifest'];
const ignoredDirs = ['content'];
// XML namespaces are identifiers, not network requests.
const allowed = [/^http:\/\/www\.w3\.org\//];
const urlPattern = /https?:\/\/[^\s'"`)<>]+/g;

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      if (!ignoredDirs.includes(entry)) yield* walk(path);
    } else if (extensions.some((ext) => path.endsWith(ext))) {
      yield path;
    }
  }
}

const findings = [];
for (const root of roots) {
  for (const file of walk(root)) {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, index) => {
      for (const [url] of line.matchAll(urlPattern)) {
        if (!allowed.some((pattern) => pattern.test(url))) {
          findings.push(`${relative('.', file)}:${index + 1}  ${url}`);
        }
      }
    });
  }
}

if (findings.length > 0) {
  console.error('External URLs found in app source (privacy rule, see CLAUDE.md):');
  for (const finding of findings) console.error(`  ${finding}`);
  process.exit(1);
}
console.log('privacy: no external URLs in app source');
