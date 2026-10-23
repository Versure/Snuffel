import { renderBlock, textOf } from '../testing';
import { RuleBlock } from './rule-block';

describe('RuleBlock', () => {
  it('renders the title and the text on the rule block', async () => {
    const element = await renderBlock(RuleBlock, {
      type: 'rule',
      title: 'Twijfel? Sla aan!',
      text: 'Het kost *niets*.',
      sourceRefs: ['svnl'],
    });
    const rule = element.querySelector('.rule');
    expect(textOf(rule?.querySelector('.title'))).toBe('Twijfel? Sla aan!');
    expect(rule?.querySelector('em')?.textContent).toBe('niets');
    expect(rule?.querySelector('.sources')).not.toBeNull();
  });

  it('shows no sources without sourceRefs', async () => {
    const element = await renderBlock(RuleBlock, {
      type: 'rule',
      title: 'Regel',
      text: 'Tekst.',
      sourceRefs: [],
    });
    expect(element.querySelector('.sources')).toBeNull();
  });
});
