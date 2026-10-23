// Inline markup of lesson text: a small subset of Markdown, within one line.
//
// Allowed: **bold**, *italic*, [label](url), [[term]] and [[term|shown form]]. Everything else is
// plain text. This is a port of tools/content/text.mjs (parseInline, plainText) with the same
// rules; both are tested against content/schema/v1/inline-markup.cases.json. Extending the markup
// starts with a new case in that file.

export interface TextToken {
  readonly type: 'text';
  readonly text: string;
}

export interface LinkToken {
  readonly type: 'link';
  /** The label, plain text. */
  readonly text: string;
  /** Not checked here; the renderer only links https:// urls. */
  readonly url: string;
}

export interface TermToken {
  readonly type: 'term';
  /** The glossary term. */
  readonly term: string;
  /** The shown form (the term itself when not given). */
  readonly text: string;
}

export interface EmToken {
  readonly type: 'em';
  readonly children: readonly (TextToken | LinkToken | TermToken)[];
}

export interface StrongToken {
  readonly type: 'strong';
  readonly children: readonly (TextToken | LinkToken | TermToken | EmToken)[];
}

export type InlineToken = TextToken | LinkToken | TermToken | EmToken | StrongToken;

interface Allow {
  readonly strong: boolean;
  readonly em: boolean;
}

/** Parses inline markup into tokens. Never throws; anything unrecognised stays text. */
export function parseInline(input: string): InlineToken[] {
  return parse(input, { strong: true, em: true });
}

function parse(input: string, allow: Allow): InlineToken[] {
  const tokens: InlineToken[] = [];
  let buffer = '';
  const flush = (): void => {
    if (buffer) tokens.push({ type: 'text', text: buffer });
    buffer = '';
  };
  let i = 0;
  while (i < input.length) {
    const term = input.startsWith('[[', i) ? readTerm(input, i) : null;
    if (term) {
      flush();
      tokens.push(term.token);
      i = term.end;
      continue;
    }
    const link = input[i] === '[' && !input.startsWith('[[', i) ? readLink(input, i) : null;
    if (link) {
      flush();
      tokens.push(link.token);
      i = link.end;
      continue;
    }
    if (input.startsWith('**', i)) {
      const strong = allow.strong ? readDelimited(input, i, '**') : null;
      if (strong) {
        flush();
        tokens.push({
          type: 'strong',
          children: parse(strong.content, { strong: false, em: true }) as StrongToken['children'],
        });
        i = strong.end;
      } else {
        buffer += '**';
        i += 2;
      }
      continue;
    }
    if (input[i] === '*') {
      const em = allow.em ? readDelimited(input, i, '*') : null;
      if (em) {
        flush();
        tokens.push({
          type: 'em',
          children: parse(em.content, { strong: false, em: false }) as EmToken['children'],
        });
        i = em.end;
        continue;
      }
    }
    buffer += input[i];
    i += 1;
  }
  flush();
  return tokens;
}

/** `[[term]]` or `[[term|shown form]]` at `start`, or null. */
function readTerm(input: string, start: number): { token: TermToken; end: number } | null {
  const end = input.indexOf(']]', start + 2);
  if (end < 0) return null;
  const content = input.slice(start + 2, end);
  if (/[[\]\n]/.test(content)) return null;
  const bar = content.indexOf('|');
  const term = (bar < 0 ? content : content.slice(0, bar)).trim();
  const shown = bar < 0 ? term : content.slice(bar + 1).trim();
  if (!term || !shown) return null;
  return { token: { type: 'term', term, text: shown }, end: end + 2 };
}

/** `[label](url)` at `start`, or null. Parentheses inside the url must be balanced. */
function readLink(input: string, start: number): { token: LinkToken; end: number } | null {
  const close = input.indexOf(']', start + 1);
  if (close < 0 || input[close + 1] !== '(') return null;
  const label = input.slice(start + 1, close);
  if (!label.trim() || /[[\n]/.test(label)) return null;
  let depth = 0;
  let i = close + 2;
  for (; i < input.length; i++) {
    const char = input[i];
    if (/\s/.test(char)) return null;
    if (char === '(') depth += 1;
    if (char === ')') {
      if (depth === 0) break;
      depth -= 1;
    }
  }
  if (i >= input.length) return null;
  const url = input.slice(close + 2, i);
  if (!url) return null;
  return { token: { type: 'link', text: label.trim(), url }, end: i + 1 };
}

/**
 * Text between `marker` at `start` and the next `marker`, or null. The content may not be empty,
 * nor start or end with whitespace (so `3 * 4 * 5` stays plain text). A single `*` is not closed
 * by the first half of a `**`.
 */
function readDelimited(
  input: string,
  start: number,
  marker: '*' | '**',
): { content: string; end: number } | null {
  const from = start + marker.length;
  if (from >= input.length || /\s/.test(input[from]) || input[from] === '*') return null;
  let end = input.indexOf(marker, from);
  while (end >= 0) {
    const doubled = marker === '*' && input[end + 1] === '*';
    if (!doubled && !/\s/.test(input[end - 1])) {
      return { content: input.slice(from, end), end: end + marker.length };
    }
    end = input.indexOf(marker, end + (doubled ? 2 : 1));
  }
  return null;
}

/** The text a reader sees: markup removed, link labels and shown term forms kept. */
export function plainText(input: string): string {
  return tokensToText(parseInline(input));
}

function tokensToText(tokens: readonly InlineToken[]): string {
  return tokens
    .map((token) =>
      token.type === 'strong' || token.type === 'em' ? tokensToText(token.children) : token.text,
    )
    .join('');
}
