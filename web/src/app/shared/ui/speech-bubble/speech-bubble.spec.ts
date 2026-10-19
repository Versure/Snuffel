import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SpeechBubble, type SpeechBubbleTail } from './speech-bubble';

@Component({
  imports: [SpeechBubble],
  template: `
    <snf-speech-bubble id="default"><strong>Yo!</strong> Ik ben Ted.</snf-speech-bubble>
    <snf-speech-bubble id="bound" [tail]="tail()">Hoi</snf-speech-bubble>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class Host {
  readonly tail = signal<SpeechBubbleTail>('bottom');
}

describe('SpeechBubble', () => {
  async function render() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const bubble = (id: string): HTMLElement => {
      const found = element.querySelector<HTMLElement>(`snf-speech-bubble#${id}`);
      if (!found) throw new Error(`bubble ${id} not found`);
      return found;
    };
    return { fixture, bubble };
  }

  it('projects its content', async () => {
    const { bubble } = await render();
    expect(bubble('default').querySelector('strong')?.textContent).toBe('Yo!');
    expect(bubble('default').textContent).toBe('Yo! Ik ben Ted.');
  });

  it('has a tail to the left by default', async () => {
    const { bubble } = await render();
    expect(bubble('default').classList).toContain('snf-speech-bubble--left');
    expect(bubble('default').classList).not.toContain('snf-speech-bubble--bottom');
  });

  it('follows the tail input', async () => {
    const { fixture, bubble } = await render();
    expect(bubble('bound').classList).toContain('snf-speech-bubble--bottom');
    expect(bubble('bound').classList).not.toContain('snf-speech-bubble--left');
    fixture.componentInstance.tail.set('left');
    await fixture.whenStable();
    expect(bubble('bound').classList).toContain('snf-speech-bubble--left');
    expect(bubble('bound').classList).not.toContain('snf-speech-bubble--bottom');
  });
});
