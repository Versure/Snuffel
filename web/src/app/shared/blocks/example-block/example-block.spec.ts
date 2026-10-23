import { renderBlock, textOf } from '../testing';
import { ExampleBlock } from './example-block';

describe('ExampleBlock', () => {
  it('renders the text in a card with its sources', async () => {
    const element = await renderBlock(ExampleBlock, {
      type: 'example',
      text: 'Je draait een [[shad]] binnen.',
      sourceRefs: ['svnl'],
    });
    const card = element.querySelector('snf-card');
    expect(textOf(card?.querySelector('p'))).toBe('Je draait een shad binnen.');
    expect(card?.querySelector('.sources')).not.toBeNull();
  });

  it('shows no sources without sourceRefs', async () => {
    const element = await renderBlock(ExampleBlock, {
      type: 'example',
      text: 'Voorbeeld.',
      sourceRefs: [],
    });
    expect(element.querySelector('.sources')).toBeNull();
  });
});
