import { renderBlock, textOf } from '../testing';
import { TedSaysBlock } from './ted-says-block';

describe('TedSaysBlock', () => {
  it('shows a small Ted in the mood from the content with the text', async () => {
    const element = await renderBlock(TedSaysBlock, {
      type: 'ted-says',
      mood: 'thinking',
      text: 'Let op je **hengeltop**.',
      sourceRefs: [],
    });
    expect(element.querySelector('snf-ted')?.classList).toContain('snf-ted--small');
    const svg = element.querySelector<SVGElement>('snf-ted svg');
    expect(svg?.style.getPropertyValue('--m-ogen-denk')).toBe('inline');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(textOf(element.querySelector('snf-speech-bubble'))).toBe('Let op je hengeltop.');
    expect(element.querySelector('.sources')).toBeNull();
  });

  it('shows its sources', async () => {
    const element = await renderBlock(TedSaysBlock, {
      type: 'ted-says',
      mood: 'happy',
      text: 'Goed zo.',
      sourceRefs: ['svnl'],
    });
    expect(element.querySelector('.sources')).not.toBeNull();
  });
});
