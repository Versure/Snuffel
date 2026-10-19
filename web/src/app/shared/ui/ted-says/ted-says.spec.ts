import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { SpeechBubbleTail } from '../speech-bubble/speech-bubble';
import type { TedMood, TedSize } from '../ted/ted';
import { TedSays } from './ted-says';

@Component({
  imports: [TedSays],
  template: `
    <snf-ted-says [mood]="mood()" [size]="size()" [wiggle]="wiggle()" [tail]="tail()">
      <strong>Yo!</strong> Ik ben Ted.
    </snf-ted-says>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class Host {
  readonly mood = signal<TedMood>('cool');
  readonly size = signal<TedSize>('large');
  readonly wiggle = signal(false);
  readonly tail = signal<SpeechBubbleTail>('left');
}

@Component({
  imports: [TedSays],
  template: `<snf-ted-says>Hoi</snf-ted-says>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class DefaultHost {}

describe('TedSays', () => {
  async function render() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const query = (selector: string): HTMLElement => {
      const found = element.querySelector<HTMLElement>(selector);
      if (!found) throw new Error(`${selector} not found`);
      return found;
    };
    const update = async (change: (host: Host) => void) => {
      change(fixture.componentInstance);
      await fixture.whenStable();
    };
    return { query, update };
  }

  it('projects the text into the bubble', async () => {
    const { query } = await render();
    const bubble = query('snf-speech-bubble');
    expect(bubble.querySelector('strong')?.textContent).toBe('Yo!');
    expect(bubble.textContent?.trim()).toBe('Yo! Ik ben Ted.');
  });

  it('passes mood, size and wiggle to Ted', async () => {
    const { query, update } = await render();
    const ted = query('snf-ted');
    expect(ted.classList).toContain('snf-ted--large');
    expect(ted.classList).not.toContain('snf-ted--wiggle');
    expect(query('snf-ted svg').style.getPropertyValue('--m-bril')).toBe('');

    await update((host) => {
      host.mood.set('happy');
      host.size.set('small');
      host.wiggle.set(true);
    });
    expect(ted.classList).toContain('snf-ted--small');
    expect(ted.classList).toContain('snf-ted--wiggle');
    expect(query('snf-ted svg').style.getPropertyValue('--m-ogen-blij')).toBe('inline');
  });

  it('passes tail to the bubble and sets the layout', async () => {
    const { query, update } = await render();
    const host = query('snf-ted-says');
    expect(query('snf-speech-bubble').classList).toContain('snf-speech-bubble--left');
    expect(host.classList).toContain('snf-ted-says--row');
    expect(host.classList).not.toContain('snf-ted-says--column');

    await update((h) => h.tail.set('bottom'));
    expect(query('snf-speech-bubble').classList).toContain('snf-speech-bubble--bottom');
    expect(host.classList).toContain('snf-ted-says--column');
    expect(host.classList).not.toContain('snf-ted-says--row');
  });

  it('hides Ted from assistive technology', async () => {
    const { query } = await render();
    const svg = query('snf-ted svg');
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.hasAttribute('role')).toBe(false);
    expect(svg.hasAttribute('aria-label')).toBe(false);
  });

  it('defaults to a large, still, cool Ted with a tail to the left', async () => {
    const fixture = TestBed.createComponent(DefaultHost);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const ted = element.querySelector('snf-ted');
    expect(ted?.classList).toContain('snf-ted--large');
    expect(ted?.classList).not.toContain('snf-ted--wiggle');
    expect(element.querySelector('snf-speech-bubble')?.classList).toContain(
      'snf-speech-bubble--left',
    );
    expect(element.querySelector('snf-ted-says')?.classList).toContain('snf-ted-says--row');
  });
});
