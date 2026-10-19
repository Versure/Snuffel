import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Sticker } from './sticker';

@Component({
  imports: [Sticker],
  template: `<snf-sticker><strong>Hallo</strong> Ted</snf-sticker>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class Host {}

describe('Sticker', () => {
  it('projects its content', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const element = (fixture.nativeElement as HTMLElement).querySelector('snf-sticker');
    expect(element?.querySelector('strong')?.textContent).toBe('Hallo');
    expect(element?.textContent).toBe('Hallo Ted');
  });
});
