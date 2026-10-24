import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Measured, Part } from './reference';

// The side-by-side page of the reference lesson and les 1 (web/test-results/reference/<project>/
// index.html). Plain HTML and CSS of its own: no script, no font, nothing from another host.

export type Scheme = 'light' | 'dark';

export interface Shot {
  readonly scheme: Scheme;
  readonly part: Part;
  readonly reference: string;
  readonly app: string;
}

export interface StyleRow {
  readonly scheme: Scheme;
  readonly name: string;
  readonly property: string;
  readonly reference: string;
  readonly app: string;
  readonly asserted: boolean;
}

export interface Report {
  readonly project: string;
  readonly viewport: string;
  readonly shots: readonly Shot[];
  readonly styles: readonly StyleRow[];
  /** Known, deliberate differences: [what, reference, app]. */
  readonly known: readonly (readonly [string, string, string])[];
}

/** `web/test-results/reference/<project>/`, emptied. */
export function reportDir(project: string): string {
  const dir = resolve(__dirname, '..', '..', 'test-results', 'reference', project);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function writeImage(dir: string, name: string, body: Buffer): string {
  writeFileSync(resolve(dir, name), body);
  return name;
}

export function toRows(
  scheme: Scheme,
  reference: readonly Measured[],
  app: readonly Measured[],
  asserted: readonly boolean[],
): StyleRow[] {
  return reference.map((item, index) => ({
    scheme,
    name: item.name,
    property: item.property,
    reference: item.value,
    app: app[index].value,
    asserted: asserted[index],
  }));
}

const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const schemeTitle: Record<Scheme, string> = { light: 'Licht', dark: 'Donker' };

export function renderIndex(report: Report): string {
  const schemes: Scheme[] = ['light', 'dark'];
  const known = report.known
    .map(
      ([what, reference, app]) =>
        `<tr><th scope="row">${escapeHtml(what)}</th><td>${escapeHtml(reference)}</td><td>${escapeHtml(app)}</td></tr>`,
    )
    .join('\n');
  const differing = report.styles.filter((row) => row.reference !== row.app);
  const tables = schemes
    .map((scheme) => {
      const rows = report.styles
        .filter((row) => row.scheme === scheme)
        .map((row) => {
          const same = row.reference === row.app;
          const verdict = same ? 'gelijk' : row.asserted ? 'anders' : 'anders (bekend)';
          const note = row.asserted ? '' : ' <small>(niet getoetst)</small>';
          return `<tr class="${same ? 'same' : 'different'}"><th scope="row">${escapeHtml(row.name)}${note}</th><td>${escapeHtml(row.property)}</td><td><code>${escapeHtml(row.reference)}</code></td><td><code>${escapeHtml(row.app)}</code></td><td><strong>${verdict}</strong></td></tr>`;
        })
        .join('\n');
      return `<h3>${schemeTitle[scheme]}</h3>
<table>
<thead><tr><th scope="col">Onderdeel</th><th scope="col">Eigenschap</th><th scope="col">Referentie</th><th scope="col">App</th><th scope="col">Uitkomst</th></tr></thead>
<tbody>
${rows}
</tbody>
</table>`;
    })
    .join('\n');
  const sections = schemes
    .map((scheme) => {
      const figures = report.shots
        .filter((shot) => shot.scheme === scheme)
        .map(
          (shot) => `<section class="part">
<h3>${escapeHtml(shot.part.title)}</h3>
<div class="pair">
<figure><figcaption>Referentie</figcaption><img src="${shot.reference}" alt="${escapeHtml(`${shot.part.title}, referentieles, ${schemeTitle[scheme].toLowerCase()}`)}"></figure>
<figure><figcaption>App (les 1)</figcaption><img src="${shot.app}" alt="${escapeHtml(`${shot.part.title}, les 1 in de app, ${schemeTitle[scheme].toLowerCase()}`)}"></figure>
</div>
</section>`,
        )
        .join('\n');
      return `<h2>${schemeTitle[scheme]}</h2>\n${figures}`;
    })
    .join('\n');
  return `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Referentieles en les 1 naast elkaar (${escapeHtml(report.project)})</title>
<style>
  body { font-family: system-ui, sans-serif; line-height: 1.5; margin: 1rem auto; max-width: 100rem; padding: 0 1rem; color: #141414; background: #fff; }
  h1, h2 { margin-top: 2rem; }
  table { border-collapse: collapse; width: 100%; margin: 0.5rem 0 1.5rem; }
  th, td { border: 1px solid #999; padding: 0.3rem 0.5rem; text-align: left; vertical-align: top; }
  tr.same td:last-child { color: #0a5c33; }
  tr.different td:last-child { color: #a3112f; }
  .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; align-items: start; }
  figure { margin: 0; }
  figcaption { font-weight: 700; margin-bottom: 0.25rem; }
  img { max-width: 100%; height: auto; border: 1px solid #999; }
  .part { margin-bottom: 2rem; }
  code { word-break: break-word; }
</style>
</head>
<body>
<h1>Referentieles en les 1 naast elkaar</h1>
<p>Project: <strong>${escapeHtml(report.project)}</strong> (${escapeHtml(report.viewport)}). Links de referentie (<code>docs/start/reference/les-01-roofvissen.html</code>, ongewijzigd), rechts les 1 in de app. Met &ldquo;beweging beperken&rdquo; aan en een vaste <code>Math.random</code>. De afbeeldingen komen niet in git.</p>
<p>${differing.length === 0 ? 'Alle gemeten stijlwaarden zijn gelijk.' : `${differing.length} gemeten stijlwaarde(n) anders, zie de tabellen.`}</p>

<h2>Bekende verschillen</h2>
<p>Bewust anders: de les is herschreven omdat de referentie geen bronnen had voor de kern (plan M13, open vraag 10 en afwijking 9), plus de verschillen van open vraag 7.</p>
<table>
<thead><tr><th scope="col">Wat</th><th scope="col">Referentie</th><th scope="col">App (les 1)</th></tr></thead>
<tbody>
${known}
</tbody>
</table>

<h2>Gemeten huisstijl</h2>
${tables}

${sections}
</body>
</html>
`;
}

export function writeIndex(dir: string, report: Report): string {
  const file = resolve(dir, 'index.html');
  writeFileSync(file, renderIndex(report));
  return file;
}
