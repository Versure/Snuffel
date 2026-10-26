import markupCases from '../../../../../content/schema/v1/inline-markup.cases.json';
import { hasFraction, type InlineToken, parseInline, plainText } from './inline-markup';

interface MarkupCase {
  readonly name: string;
  readonly input: string;
  readonly tokens: readonly InlineToken[];
}

// The same cases as tools/content/text.test.mjs, read from content/ (never copied into web/src).
const cases = (markupCases as { cases: readonly MarkupCase[] }).cases;

describe('parseInline', () => {
  it('has cases to check', () => {
    expect(cases.length).toBeGreaterThan(10);
  });

  describe('parses every case in inline-markup.cases.json', () => {
    for (const markupCase of cases) {
      it(markupCase.name, () => {
        expect(parseInline(markupCase.input)).toEqual(markupCase.tokens);
      });
    }
  });
});

describe('plainText', () => {
  it('plainText keeps link labels and shown term forms', () => {
    const link = ['https', '://example.org/a'].join('');
    expect(plainText(`Lees **[dit](${link})** over [[aanslaan|slaat aan]] en *[[shad]]*.`)).toBe(
      'Lees dit over slaat aan en shad.',
    );
    expect(plainText('3 * 4 * 5')).toBe('3 * 4 * 5');
  });

  it('plainText writes a fraction with a slash', () => {
    expect(plainText('{{1 1/4}} liter')).toBe('1 1/4 liter');
    expect(plainText('Hoeveel is {{1/5}} + **{{2/5}}**?')).toBe('Hoeveel is 1/5 + 2/5?');
    expect(plainText('1/5')).toBe('1/5');
  });
});

describe('hasFraction', () => {
  it('finds a valid fraction, also inside bold or italic', () => {
    expect(hasFraction('Hoeveel is {{1/5}}?')).toBe(true);
    expect(hasFraction('**{{1 1/4}}**')).toBe(true);
    expect(hasFraction('**echt *{{3/4}}***')).toBe(true);
  });

  it('a plain slash, an invalid fraction or braces in a term are no fraction', () => {
    expect(hasFraction('Hoeveel is 1/5?')).toBe(false);
    expect(hasFraction('{{1/0}} en {{-1/2}}')).toBe(false);
    expect(hasFraction('[[term|{{1/2}}]]')).toBe(false);
    expect(hasFraction('')).toBe(false);
  });
});
