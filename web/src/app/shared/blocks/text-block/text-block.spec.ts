import { renderBlock, textOf } from '../testing';
import { TextBlock } from './text-block';

describe('TextBlock', () => {
  it('renders the text with markup and a term', async () => {
    const element = await renderBlock(TextBlock, {
      type: 'text',
      text: '**En vastzitten?** Een [[shad]] zinkt.',
      sourceRefs: [],
    });
    const p = element.querySelector('p');
    expect(textOf(p)).toBe('En vastzitten? Een shad zinkt.');
    expect(p?.querySelector('strong')?.textContent).toBe('En vastzitten?');
    expect(p?.querySelector('button')?.textContent?.trim()).toBe('shad');
  });

  it('shows its sources, or none without sourceRefs', async () => {
    const withSources = await renderBlock(TextBlock, {
      type: 'text',
      text: 'Tekst.',
      sourceRefs: ['svnl'],
    });
    expect(textOf(withSources.querySelector('.sources'))).toMatch(/^Bron: /);
    expect(withSources.querySelector('.sources a')?.textContent).toContain(
      'Sportvisserij Nederland',
    );
    const without = await renderBlock(TextBlock, { type: 'text', text: 'Tekst.', sourceRefs: [] });
    expect(without.querySelector('.sources')).toBeNull();
  });
});
