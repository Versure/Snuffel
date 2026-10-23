import { renderBlock, textOf } from '../testing';
import { SignalCardsBlock } from './signal-cards-block';

describe('SignalCardsBlock', () => {
  it('renders a card per signal with icon, title, text and sources', async () => {
    const element = await renderBlock(SignalCardsBlock, {
      type: 'signal-cards',
      cards: [
        { icon: 'tick', title: 'Een tik', text: 'Een korte ruk.', sourceRefs: ['svnl'] },
        { icon: 'shake', title: 'Zwaar én *levend*', text: 'Het schudt.', sourceRefs: [] },
        { icon: 'stop', title: 'Stopt', text: 'Te vroeg slap.', sourceRefs: [] },
      ],
    });
    const cards = [...element.querySelectorAll('li.card')];
    expect(cards).toHaveLength(3);
    expect(cards.map((card) => textOf(card.querySelector('h3')))).toEqual([
      'Een tik',
      'Zwaar én levend',
      'Stopt',
    ]);
    expect(cards[1].querySelector('h3 em')?.textContent).toBe('levend');
    expect(textOf(cards[0].querySelector('p'))).toBe('Een korte ruk.');
    expect(cards.map((card) => card.querySelector('svg')?.getAttribute('data-icon'))).toEqual([
      'tick',
      'shake',
      'stop',
    ]);
    expect(cards[0].querySelector('.sources')).not.toBeNull();
    expect(cards[1].querySelector('.sources')).toBeNull();
  });
});
