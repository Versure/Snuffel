import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import markupCases from '../../../../../../content/schema/v1/inline-markup.cases.json';
import { LessonContext } from '../../lesson-context/lesson-context';
import { InlineText } from './inline-text';

interface MarkupCase {
  readonly name: string;
  readonly input: string;
  readonly tokens: readonly { readonly type: string; readonly url?: string }[];
}
const cases = (markupCases as { cases: readonly MarkupCase[] }).cases;
const findCase = (name: string): MarkupCase => {
  const found = cases.find((markupCase) => markupCase.name === name);
  if (!found) throw new Error(`no case ${name}`);
  return found;
};
const caseInput = (name: string): string => findCase(name).input;
/** The url of the link in a case, so no host is written out in this spec. */
const caseUrl = (name: string): string => {
  const url = findCase(name).tokens.find((token) => token.type === 'link')?.url;
  if (!url) throw new Error(`no link in case ${name}`);
  return url;
};

@Component({
  imports: [InlineText],
  template: `<p><snf-inline-text [text]="text()" [terms]="terms()" /></p>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class Host {
  readonly text = signal('');
  readonly terms = signal(true);
}

describe('InlineText', () => {
  async function render(text: string, { terms = true, context = true } = {}) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: context ? [LessonContext] : [] });
    if (context) {
      TestBed.inject(LessonContext).glossary.set([
        { term: 'aanslaan', definition: 'de haak vastzetten' },
        { term: 'shad', definition: 'rubber visje' },
      ]);
    }
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.text.set(text);
    fixture.componentInstance.terms.set(terms);
    await fixture.whenStable();
    return (fixture.nativeElement as HTMLElement).querySelector('p') as HTMLElement;
  }

  it('renders plain text as it is', async () => {
    const p = await render('Een gewone zin.');
    expect(p.textContent).toBe('Een gewone zin.');
  });

  it('renders bold and italic as strong and em', async () => {
    const p = await render(caseInput('italic inside bold'));
    const strong = p.querySelector('strong');
    expect(strong?.textContent).toBe('echt heel belangrijk');
    expect(strong?.querySelector('em')?.textContent).toBe('heel');
    expect(p.textContent).toBe('echt heel belangrijk');

    const italic = await render(caseInput('italic'));
    expect(italic.querySelector('em')?.textContent).toBe('vast');
    expect(italic.textContent).toBe('Dan zit hij vast.');
  });

  it('renders an https link with target and rel', async () => {
    const p = await render(caseInput('link'));
    const link = p.querySelector('a');
    expect(link?.getAttribute('href')).toBe(caseUrl('link'));
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link?.textContent).toContain('VISpas-check');
    expect(p.textContent).toBe('Doe de VISpas-check (opent in een nieuw tabblad).');
  });

  it('renders a non-https link as plain text', async () => {
    const p = await render(caseInput('link').replace('https', 'http'));
    expect(p.querySelector('a')).toBeNull();
    expect(p.textContent).toBe('Doe de VISpas-check.');
  });

  it('renders a known term as a button', async () => {
    const p = await render(caseInput('term with a shown form'));
    const button = p.querySelector('button');
    expect(button).not.toBeNull();
    expect(button?.getAttribute('aria-expanded')).toBe('false');
  });

  it('renders an unknown term as plain text', async () => {
    const p = await render('Een [[loodkop]] zinkt.');
    expect(p.querySelector('button')).toBeNull();
    expect(p.textContent).toBe('Een loodkop zinkt.');
    const withoutContext = await render('Een [[shad]].', { context: false });
    expect(withoutContext.querySelector('button')).toBeNull();
    expect(withoutContext.textContent).toBe('Een shad.');
  });

  it('renders terms as text when terms is false', async () => {
    const p = await render('Je moet [[aanslaan|slaat aan]] en **[[shad]]**.', { terms: false });
    expect(p.querySelector('button')).toBeNull();
    expect(p.textContent).toBe('Je moet slaat aan en shad.');
  });

  /** The text a screen reader reads: without aria-hidden parts, whitespace collapsed. */
  const readable = (element: Element): string => {
    const clone = element.cloneNode(true) as Element;
    clone.querySelectorAll('[aria-hidden="true"]').forEach((node) => node.remove());
    return (clone.textContent ?? '').replace(/\s+/g, ' ').trim();
  };
  const fractionParts = (fraction: Element) =>
    [...fraction.querySelectorAll('mfrac > mn')].map((mn) => mn.textContent?.trim());

  it('renders {{1/5}} as a stacked fraction with 1 vijfde for a screen reader', async () => {
    const p = await render(caseInput('fraction'));
    const fractions = [...p.querySelectorAll('snf-fraction')];
    expect(fractions.map(fractionParts)).toEqual([
      ['1', '5'],
      ['2', '5'],
    ]);
    expect(p.querySelector('math')?.getAttribute('aria-hidden')).toBe('true');
    expect(readable(p)).toBe('Hoeveel is 1 vijfde + 2 vijfde?');
  });

  it('a fraction inside bold is bold', async () => {
    const p = await render(caseInput('fraction inside bold'));
    const fraction = p.querySelector('strong snf-fraction');
    expect(fraction).not.toBeNull();
    expect(fractionParts(fraction as Element)).toEqual(['1', '2']);
    expect(readable(p)).toBe('1 half');
  });

  it('a plain 1/5 stays text', async () => {
    const p = await render(caseInput('plain slash stays text'));
    expect(p.querySelector('snf-fraction')).toBeNull();
    expect(p.textContent).toBe('Hoeveel is 1/5 + 2/5?');
    const invalid = await render('Neem {{1/0}} liter.');
    expect(invalid.querySelector('snf-fraction')).toBeNull();
    expect(invalid.textContent).toBe('Neem {{1/0}} liter.');
  });

  it('a fraction in a glossary definition and with terms off is still stacked', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [LessonContext] });
    TestBed.inject(LessonContext).glossary.set([
      { term: 'noemer', definition: 'het getal onder de streep, zoals de 5 in {{1/5}}' },
    ]);
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.text.set('De [[noemer]] van {{3/4}}.');
    await fixture.whenStable();
    const p = (fixture.nativeElement as HTMLElement).querySelector('p') as HTMLElement;
    const definition = p.querySelector('.definition') as HTMLElement;
    expect(fractionParts(definition.querySelector('snf-fraction') as Element)).toEqual(['1', '5']);
    expect(p.querySelectorAll('snf-fraction').length).toBe(2);

    const termsOff = await render('De [[shad]] is {{3/4}} van de vis.', { terms: false });
    expect(termsOff.querySelector('button')).toBeNull();
    expect(fractionParts(termsOff.querySelector('snf-fraction') as Element)).toEqual(['3', '4']);
    expect(readable(termsOff)).toBe('De shad is 3 vierde van de vis.');
  });

  it('never uses innerHTML', async () => {
    const p = await render(caseInput('html stays plain text'));
    expect(p.querySelector('b')).toBeNull();
    expect(p.textContent).toBe('Dit is <b>vet</b>.');
  });
});
