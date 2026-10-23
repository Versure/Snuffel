import type { FigureBlock as FigureBlockData } from '../../../core/content/content.types';
import { renderBlock, textOf } from '../testing';
import { FigureBlock } from './figure-block';

const figure: FigureBlockData = {
  type: 'figure',
  src: 'assets/hengeltop.svg',
  alt: 'Een buigende hengeltop',
  caption: 'Hoe harder je trekt, hoe verder de top **buigt**.',
  sourceRefs: [],
};

describe('FigureBlock', () => {
  it('uses the hashed url from the lesson context', async () => {
    const element = await renderBlock(FigureBlock, figure);
    const img = element.querySelector('figure img');
    expect(img?.getAttribute('src')).toBe(
      '/content/proefcursus/assets/hengeltop.svg?v=0123456789abcdef',
    );
    expect(img?.getAttribute('alt')).toBe('Een buigende hengeltop');
    expect(img?.getAttribute('loading')).toBe('lazy');
    expect(element.querySelector('.sources')).toBeNull();
  });

  it('shows the caption', async () => {
    const element = await renderBlock(FigureBlock, figure);
    const caption = element.querySelector('figure figcaption');
    expect(textOf(caption)).toBe('Hoe harder je trekt, hoe verder de top buigt.');
    expect(caption?.querySelector('strong')?.textContent).toBe('buigt');
    const without = await renderBlock(FigureBlock, { ...figure, caption: undefined });
    expect(without.querySelector('figcaption')).toBeNull();
  });

  it('falls back to the alt text without a url', async () => {
    const unknown = await renderBlock(FigureBlock, { ...figure, src: 'assets/onbekend.svg' });
    expect(unknown.querySelector('img')).toBeNull();
    expect(textOf(unknown.querySelector('.fallback'))).toBe('Een buigende hengeltop');
    const withoutContext = await renderBlock(FigureBlock, figure, { context: false });
    expect(withoutContext.querySelector('img')).toBeNull();
    expect(textOf(withoutContext.querySelector('.fallback'))).toBe('Een buigende hengeltop');
  });

  it('shows its sources', async () => {
    const element = await renderBlock(FigureBlock, { ...figure, sourceRefs: ['svnl'] });
    expect(element.querySelector('.sources')).not.toBeNull();
  });
});
