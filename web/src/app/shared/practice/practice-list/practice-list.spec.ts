import { TestBed } from '@angular/core/testing';
import type { PracticeStep } from '../../../core/content/content.types';
import { PracticeList } from './practice-list';

const checkUrl = ['https', '://example.org/vispas-check'].join('');

const step: PracticeStep = {
  id: 'zelf-doen',
  type: 'practice',
  practiceKind: 'do-it-yourself',
  title: 'Aan het water',
  intro: 'Een spel voor *twee*.',
  items: [
    {
      id: 'vispas',
      text: 'Neem je VISpas mee.',
      links: [{ label: 'VISpas-check', url: checkUrl }],
      sourceRefs: [],
    },
    { id: 'tang', text: 'Stop een **onthaaktang** in de tas.', sourceRefs: [] },
  ],
  successCriterion: 'Gelukt als je het verschil voelt.',
};

const textOf = (element: Element | null): string =>
  (element?.textContent ?? '').replace(/\s+/g, ' ').trim();

describe('PracticeList', () => {
  async function render(): Promise<HTMLElement> {
    const fixture = TestBed.createComponent(PracticeList);
    fixture.componentRef.setInput('step', step);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows items, links and the success criterion', async () => {
    const element = await render();
    expect(textOf(element.querySelector('.intro'))).toBe('Een spel voor twee.');
    const items = [...element.querySelectorAll('snf-sticky-note ul.items > li')];
    expect(items).toHaveLength(2);
    expect(textOf(items[0].querySelector('snf-inline-text'))).toBe('Neem je VISpas mee.');
    expect(textOf(items[0].querySelector('.links'))).toBe(
      'VISpas-check (opent in een nieuw tabblad)',
    );
    expect(textOf(items[1])).toBe('Stop een onthaaktang in de tas.');
    const link = items[0].querySelector('a');
    expect(link?.getAttribute('href')).toBe(checkUrl);
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(items[1].querySelector('a')).toBeNull();
    expect(textOf(element.querySelector('snf-sticky-note .success strong'))).toBe(
      'Gelukt als je het verschil voelt.',
    );
  });

  it('has no checkboxes', async () => {
    const element = await render();
    expect(element.querySelector('input, [role="checkbox"], button')).toBeNull();
  });
});
