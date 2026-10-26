import type { Locator } from '@playwright/test';
import { spokenFraction } from '../../src/app/shared/inline-text/fraction/spoken-fraction';
import { type InlineToken, parseInline } from '../../src/app/shared/inline-text/inline-markup';

// What a screen reader reads of a text with fractions. The MathML of a fraction is aria-hidden and
// the words ("1 vijfde") sit in visually hidden text, so the DOM text is not `plainText`.

function collapse(text: string | null | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}

/** The text of the element without its aria-hidden parts (the MathML), whitespace collapsed. */
export async function readableText(locator: Locator): Promise<string> {
  return collapse(
    await locator.evaluate((element) => {
      const copy = element.cloneNode(true) as Element;
      copy.querySelectorAll('[aria-hidden="true"]').forEach((hidden) => hidden.remove());
      return copy.textContent;
    }),
  );
}

function read(tokens: readonly InlineToken[]): string {
  return tokens
    .map((token) => {
      if (token.type === 'fraction') return spokenFraction(token);
      if (token.type === 'strong' || token.type === 'em') return read(token.children);
      return token.text;
    })
    .join('');
}

/** What a screen reader reads of a content text: the plain text with every fraction in words. */
export function spokenText(content: string): string {
  return read(parseInline(content));
}
