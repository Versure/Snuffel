import { renderBlock, textOf } from '../testing';
import { TipBlock } from './tip-block';

describe('TipBlock', () => {
  it('renders the title and the text in a card', async () => {
    const element = await renderBlock(TipBlock, {
      type: 'tip',
      title: 'Slim',
      text: 'Gevlochten lijn rekt niet.',
      sourceRefs: ['svnl'],
    });
    expect(textOf(element.querySelector('snf-card .title'))).toBe('Slim');
    expect(textOf(element.querySelector('snf-card p:not(.title)'))).toBe(
      'Gevlochten lijn rekt niet.',
    );
    expect(element.querySelector('.sources')).not.toBeNull();
  });

  it('uses Tip as the default title', async () => {
    const element = await renderBlock(TipBlock, {
      type: 'tip',
      text: 'Tekst.',
      sourceRefs: [],
    });
    expect(textOf(element.querySelector('.title'))).toBe('Tip');
    expect(element.querySelector('.sources')).toBeNull();
  });
});
