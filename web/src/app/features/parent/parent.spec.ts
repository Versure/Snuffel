import { TestBed } from '@angular/core/testing';
import { Parent } from './parent';

describe('Parent', () => {
  it('shows the Ouderoverzicht heading and a thinking Ted', async () => {
    const fixture = TestBed.createComponent(Parent);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('h1')?.textContent).toBe('Ouderoverzicht');
    expect(element.querySelector('snf-ted-says')?.textContent?.trim()).toBe(
      'Hier zie je straks hoe het met de kinderen gaat.',
    );
    const svg = element.querySelector<SVGSVGElement>('snf-ted svg');
    expect(svg?.style.getPropertyValue('--m-mond-denk').trim()).toBe('inline');
  });
});
