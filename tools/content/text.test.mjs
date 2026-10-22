import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { schemaDir } from './schema.mjs';
import {
  ABBREVIATIONS,
  countWords,
  inlineLinks,
  inlineTerms,
  parseInline,
  plainText,
  splitSentences,
} from './text.mjs';

const { cases } = JSON.parse(readFileSync(join(schemaDir, 'inline-markup.cases.json'), 'utf8'));

describe('parseInline', () => {
  test('parses every case in inline-markup.cases.json', () => {
    assert.ok(cases.length >= 15);
    for (const { name, input, tokens } of cases) {
      assert.deepEqual(parseInline(input), tokens, name);
    }
  });

  test('the cases cover bold, italic, links, terms and the edge cases', () => {
    const types = new Set();
    const visit = (tokens) =>
      tokens.forEach((token) => {
        types.add(token.type);
        if (token.children) visit(token.children);
      });
    cases.forEach(({ tokens }) => visit(tokens));
    assert.deepEqual([...types].sort(), ['em', 'link', 'strong', 'term', 'text']);
  });
});

describe('plainText, links and terms', () => {
  test('plainText drops markup and keeps labels and shown forms', () => {
    assert.equal(
      plainText('**Tip:** [[aanslaan|Sla aan]], zie [de site](https://example.org/a) *nu*.'),
      'Tip: Sla aan, zie de site nu.',
    );
  });

  test('inlineLinks and inlineTerms find links and terms, also inside bold', () => {
    const text = '**[a](https://example.org/a)** en [[shad]] en *[[kunstaas|nepaas]]*';
    assert.deepEqual(inlineLinks(text), ['https://example.org/a']);
    assert.deepEqual(inlineTerms(text), [
      { term: 'shad', text: 'shad' },
      { term: 'kunstaas', text: 'nepaas' },
    ]);
  });
});

describe('countWords', () => {
  test('counts words, not markup, punctuation or urls', () => {
    assert.equal(countWords('Een gewone zin.'), 3);
    assert.equal(countWords('**Tip:** lees [de site](https://example.org/lange/url) - nu!'), 5);
    assert.equal(countWords('Kijk op https://example.org of www.example.org.'), 3);
    assert.equal(countWords('[[aanslaan|slaat aan]]'), 2);
    assert.equal(countWords('1,5 meter'), 2);
    assert.equal(countWords(''), 0);
  });
});

describe('splitSentences', () => {
  test('splits on . ! ? and …', () => {
    assert.deepEqual(splitSentences('Een tik. Zwaar! Vast? Wacht… Klaar'), [
      'Een tik.',
      'Zwaar!',
      'Vast?',
      'Wacht…',
      'Klaar',
    ]);
  });

  test('splits sentences but not on abbreviations or decimals', () => {
    assert.deepEqual(
      splitSentences(
        'Neem bijv. een shad van 1,5 m. lang of ca. 3.2 cm dik. Dat werkt o.a. bij baars.',
      ),
      ['Neem bijv. een shad van 1,5 m. lang of ca. 3.2 cm dik.', 'Dat werkt o.a. bij baars.'],
    );
    for (const abbreviation of ABBREVIATIONS) {
      assert.equal(splitSentences(`Een ${abbreviation} twee.`).length, 1, abbreviation);
    }
    assert.equal(splitSentences('Bijv. dit, d.w.z. dat, enz. en bv. zo.').length, 1);
  });

  test('a closing quote or bracket after the mark still ends the sentence', () => {
    assert.deepEqual(splitSentences('Hij roept "tik!" Dan sla je aan.'), [
      'Hij roept "tik!"',
      'Dan sla je aan.',
    ]);
  });

  test('a title without a mark is one sentence; empty text is none', () => {
    assert.deepEqual(splitSentences('Wachten kost je de vis'), ['Wachten kost je de vis']);
    assert.deepEqual(splitSentences('  '), []);
  });

  test('markup does not break sentences', () => {
    assert.deepEqual(splitSentences('**Let op.** Zie [dit](https://example.org/a.b).'), [
      'Let op.',
      'Zie dit.',
    ]);
  });
});
