// Sorting and printing of content:check results (Dutch, for Jop and the snuffel-leren skill).

const collator = new Intl.Collator('en', { numeric: true });

/** Sorts issues by file, then JSON path, then code; drops exact duplicates. */
export function sortIssues(issues) {
  const seen = new Set();
  return [...issues]
    .sort(
      (a, b) =>
        collator.compare(a.file, b.file) ||
        collator.compare(a.path, b.path) ||
        collator.compare(a.code, b.code) ||
        collator.compare(a.message, b.message),
    )
    .filter((issue) => {
      const key = `${issue.file}|${issue.path}|${issue.code}|${issue.message}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function countLabel(count) {
  return count === 1 ? '1 fout' : `${count} fouten`;
}

/**
 * The report as printed by `npm run content:check`:
 *
 *   content:check: 1 fout
 *   FOUT content/…/01-proefles.json
 *     steps[0].blocks[1]…: message [code]
 */
export function formatReport({ errors, warnings = [] }, title = 'content:check') {
  const lines = [];
  for (const warning of warnings) lines.push(`LET OP: ${warning}`);
  if (errors.length === 0) {
    lines.push(`${title}: geen fouten`);
    return lines.join('\n');
  }
  lines.push(`${title}: ${countLabel(errors.length)}`);
  let currentFile;
  for (const error of sortIssues(errors)) {
    if (error.file !== currentFile) {
      currentFile = error.file;
      lines.push(`FOUT ${error.file}`);
    }
    lines.push(`  ${error.path || '(hele bestand)'}: ${error.message} [${error.code}]`);
  }
  return lines.join('\n');
}
