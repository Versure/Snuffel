import type { Block as BlockData } from '../../../core/content/content.types';
import { renderBlock } from '../testing';
import { Block } from './block';

const blocks: [string, BlockData][] = [
  ['snf-text-block', { type: 'text', text: 'Tekst.', sourceRefs: [] }],
  ['snf-example-block', { type: 'example', text: 'Voorbeeld.', sourceRefs: [] }],
  ['snf-rule-block', { type: 'rule', title: 'Regel', text: 'Tekst.', sourceRefs: [] }],
  ['snf-tip-block', { type: 'tip', text: 'Tip.', sourceRefs: [] }],
  ['snf-ted-says-block', { type: 'ted-says', mood: 'happy', text: 'Hoi.', sourceRefs: [] }],
];

describe('Block', () => {
  it('renders the component for each block type', async () => {
    for (const [selector, block] of blocks) {
      const element = await renderBlock(Block, block);
      expect(element.querySelector(selector), block.type).not.toBeNull();
      const rendered = blocks.filter(([other]) => element.querySelector(other) !== null);
      expect(rendered.length, block.type).toBe(1);
    }
  });
});
