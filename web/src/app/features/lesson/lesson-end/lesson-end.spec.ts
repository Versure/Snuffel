import { TestBed } from '@angular/core/testing';
import type {
  FaqEntry,
  FurtherReading,
  GlossaryEntry,
  Source,
} from '../../../core/content/content.types';
import { LessonContext } from '../../../shared/lesson-context/lesson-context';
import { LessonEnd } from './lesson-end';

const source: Source = {
  id: 'streetfishing',
  title: 'Hét Visblad: streetfishing',
  url: ['https', '://example.org/streetfishing'].join(''),
  publisher: 'Sportvisserij Nederland',
  type: 'association',
  reliability: 'high',
  accessedOn: '2026-10-19',
};

const glossary: GlossaryEntry[] = [
  { term: 'shad', definition: 'rubber visje' },
  { term: 'VISpas', definition: 'de pas om te vissen' },
  { term: 'aanslaan', definition: 'de haak **vastzetten**' },
  { term: 'ijsvogel', definition: 'een vogel' },
  { term: 'onderlijn', definition: 'het laatste stukje lijn' },
];
const furtherReading: FurtherReading[] = [
  { sourceRef: 'streetfishing', why: 'Over vissen in de stad.' },
];
const faq: FaqEntry[] = [
  { q: 'Wat als ik twijfel?', a: 'Sla aan.' },
  { q: 'Waarom een proefles?', a: 'Om te testen.' },
];

const textOf = (element: Element | null): string =>
  (element?.textContent ?? '').replace(/\s+/g, ' ').trim();

describe('LessonEnd', () => {
  async function render(
    inputs: {
      glossary?: GlossaryEntry[];
      furtherReading?: FurtherReading[];
      faq?: FaqEntry[];
    } = {},
  ): Promise<HTMLElement> {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [LessonContext] });
    TestBed.inject(LessonContext).sources.set([source]);
    const fixture = TestBed.createComponent(LessonEnd);
    fixture.componentRef.setInput('glossary', inputs.glossary ?? glossary);
    fixture.componentRef.setInput('furtherReading', inputs.furtherReading ?? furtherReading);
    fixture.componentRef.setInput('faq', inputs.faq ?? faq);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('sorts the glossary alphabetically', async () => {
    const element = await render();
    expect(textOf(element.querySelector('#woordenlijst h2'))).toBe('Woordenlijst');
    expect([...element.querySelectorAll('dl dt')].map(textOf)).toEqual([
      'aanslaan',
      'ijsvogel',
      'onderlijn',
      'shad',
      'VISpas',
    ]);
    expect(textOf(element.querySelector('dl dd'))).toBe('de haak vastzetten');
    expect(element.querySelector('dl dd strong')?.textContent).toBe('vastzetten');
  });

  it('hides empty sections', async () => {
    const element = await render({ glossary: [], furtherReading: [], faq: [] });
    expect(element.querySelector('section')).toBeNull();
    const onlyFaq = await render({ glossary: [], furtherReading: [] });
    expect([...onlyFaq.querySelectorAll('h2')].map(textOf)).toEqual(['Vragen']);
  });

  it('renders further reading as external links with the source title', async () => {
    const element = await render();
    const item = element.querySelector('#verder-lezen li');
    const link = item?.querySelector('a');
    expect(link?.getAttribute('href')).toBe(source.url);
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(textOf(link ?? null)).toBe('Hét Visblad: streetfishing (opent in een nieuw tabblad)');
    expect(textOf(item?.querySelector('.publisher') ?? null)).toBe('(Sportvisserij Nederland)');
    expect(textOf(item?.querySelector('.why') ?? null)).toBe('Over vissen in de stad.');
  });

  it('shows every FAQ question as h3 with its answer', async () => {
    const element = await render();
    expect([...element.querySelectorAll('#vragen h3')].map(textOf)).toEqual([
      'Wat als ik twijfel?',
      'Waarom een proefles?',
    ]);
    expect([...element.querySelectorAll('#vragen p')].map(textOf)).toEqual([
      'Sla aan.',
      'Om te testen.',
    ]);
  });

  it('leaves out further reading with an unknown source', async () => {
    const element = await render({ furtherReading: [{ sourceRef: 'onbekend', why: 'x' }] });
    expect(element.querySelector('#verder-lezen')).toBeNull();
  });
});
