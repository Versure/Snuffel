import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StickyNote } from './sticky-note';

@Component({
  imports: [StickyNote],
  template: `<snf-sticky-note><strong>Hallo</strong> Ted</snf-sticky-note>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class Host {}

describe('StickyNote', () => {
  it('projects its content', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const element = (fixture.nativeElement as HTMLElement).querySelector('snf-sticky-note');
    expect(element?.querySelector('strong')?.textContent).toBe('Hallo');
    expect(element?.textContent).toBe('Hallo Ted');
  });
});
