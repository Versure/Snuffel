// Inline markup of lesson text (a small subset of Markdown) and simple text measures.
//
// Allowed: **bold**, *italic*, [label](https://…), [[term]], [[term|shown form]], and a stacked
// fraction {{a/b}} or mixed number {{n a/b}} (M14). Everything else is plain text. The cases in content/schema/v1/inline-markup.cases.json pin the
// behaviour; the renderer in the app (M7) is tested against the same cases.

/**
 * Parses inline markup into tokens:
 * - `{ type: 'text', text }`
 * - `{ type: 'strong', children }` and `{ type: 'em', children }` (children: text, link, term,
 *   fraction; em may sit inside strong, not the other way round)
 * - `{ type: 'link', text, url }` (label is plain text; the url is not checked here)
 * - `{ type: 'term', term, text }` (`text` is the shown form, the term itself when not given)
 * - `{ type: 'fraction', text, whole?, numerator, denominator }` (digits as written, as strings;
 *   `text` is the plain form with a slash: `1/5`, `1 1/4`)
 */
export function parseInline(input) {
  return parse(input, { strong: true, em: true });
}

function parse(input, allow) {
  const tokens = [];
  let buffer = '';
  const flush = () => {
    if (buffer) tokens.push({ type: 'text', text: buffer });
    buffer = '';
  };
  let i = 0;
  while (i < input.length) {
    const fraction = input.startsWith('{{', i) ? readFraction(input, i) : null;
    if (fraction) {
      flush();
      tokens.push(fraction.token);
      i = fraction.end;
      continue;
    }
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
          children: parse(strong.content, { strong: false, em: true }),
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
        tokens.push({ type: 'em', children: parse(em.content, { strong: false, em: false }) });
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

// Whole numbers without a leading zero; one space between the whole number and the fraction.
const FRACTION = /^(?:([1-9][0-9]*) )?(0|[1-9][0-9]*)\/([1-9][0-9]*)$/;

/**
 * `{{a/b}}` or `{{n a/b}}` at `start`, or null. Digits only, no spaces except the one after the
 * whole number, the denominator is never 0, and in a mixed number the whole number is at least 1
 * and the fraction is proper (1 ≤ numerator < denominator).
 */
function readFraction(input, start) {
  const close = input.indexOf('}}', start + 2);
  if (close < 0) return null;
  const match = FRACTION.exec(input.slice(start + 2, close));
  if (!match) return null;
  const [, whole, numerator, denominator] = match;
  if (whole !== undefined && (Number(numerator) < 1 || Number(numerator) >= Number(denominator))) {
    return null;
  }
  const text = `${whole === undefined ? '' : `${whole} `}${numerator}/${denominator}`;
  const token =
    whole === undefined
      ? { type: 'fraction', text, numerator, denominator }
      : { type: 'fraction', text, whole, numerator, denominator };
  return { token, end: close + 2 };
}

/** `[[term]]` or `[[term|shown form]]` at `start`, or null. */
function readTerm(input, start) {
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
function readLink(input, start) {
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
function readDelimited(input, start, marker) {
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

/**
 * The text a reader sees: markup removed, link labels and shown term forms kept, a fraction with a
 * slash (`{{1 1/4}}` is `1 1/4`).
 */
export function plainText(input) {
  return tokensToText(parseInline(input));
}

function tokensToText(tokens) {
  return tokens
    .map((token) =>
      token.type === 'strong' || token.type === 'em' ? tokensToText(token.children) : token.text,
    )
    .join('');
}

/** Every link url in the text (from `[label](url)`). */
export function inlineLinks(input) {
  const urls = [];
  const visit = (tokens) => {
    for (const token of tokens) {
      if (token.type === 'link') urls.push(token.url);
      if (token.type === 'strong' || token.type === 'em') visit(token.children);
    }
  };
  visit(parseInline(input));
  return urls;
}

/** Every `[[term]]` in the text: `[{ term, text }]`. */
export function inlineTerms(input) {
  const terms = [];
  const visit = (tokens) => {
    for (const token of tokens) {
      if (token.type === 'term') terms.push({ term: token.term, text: token.text });
      if (token.type === 'strong' || token.type === 'em') visit(token.children);
    }
  };
  visit(parseInline(input));
  return terms;
}

const WORD = /[\p{L}\p{N}]/u;
const URL_LIKE = /^(https?:\/\/|www\.)/i;

/** Words in the plain text; punctuation, markup and bare urls do not count. */
export function countWords(input) {
  return plainText(input)
    .split(/\s+/)
    .filter((word) => WORD.test(word) && !URL_LIKE.test(word)).length;
}

/** Abbreviations that end with a full stop but do not end a sentence. */
export const ABBREVIATIONS = ['bijv.', 'bv.', 'o.a.', 'd.w.z.', 'enz.', 'ca.', 'm.', 'cm.'];

const SENTENCE_END = /[.!?…]["'”’)»]*$/;

/**
 * Splits plain text into sentences. A sentence ends with `.`, `!`, `?` or `…` (optionally
 * followed by a closing quote or bracket) before a space or the end of the text. Abbreviations
 * from ABBREVIATIONS and numbers such as 1,5 or 3.2 do not end a sentence. Text without such a
 * mark (a title, an option) is one sentence.
 */
export function splitSentences(input) {
  const words = plainText(input).split(/\s+/).filter(Boolean);
  const sentences = [];
  let current = [];
  for (const word of words) {
    current.push(word);
    const bare = word.replace(/["'”’)»]+$/, '').toLocaleLowerCase('nl');
    const isAbbreviation = ABBREVIATIONS.some(
      (abbreviation) => bare === abbreviation || bare.endsWith(`(${abbreviation}`),
    );
    if (SENTENCE_END.test(word) && !isAbbreviation) {
      sentences.push(current.join(' '));
      current = [];
    }
  }
  if (current.length > 0) sentences.push(current.join(' '));
  return sentences;
}
