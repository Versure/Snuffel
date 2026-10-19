import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Card } from './card';

@Component({
  imports: [Card],
  template: `<snf-card><strong>Hallo</strong> Ted</snf-card>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class Host {}

describe('Card', () => {
  it('projects its content', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const element = (fixture.nativeElement as HTMLElement).querySelector('snf-card');
    expect(element?.querySelector('strong')?.textContent).toBe('Hallo');
    expect(element?.textContent).toBe('Hallo Ted');
  });
});
