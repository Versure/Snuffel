import { TestBed } from '@angular/core/testing';
import type { Interaction } from '../../core/content/content.types';
import { InteractionPlaceholder } from './interaction-placeholder';

const traceGame = {
  id: 'voel-spel',
  kind: 'trace-game',
  config: {
    choices: [{ id: 'vis', label: 'Vis!', color: 'yellow' }],
    patterns: [{ id: 'tik', answer: 'vis', shape: [], explanation: 'Een tik, meteen aanslaan.' }],
    rounds: 8,
    durationMs: 3200,
  },
} as unknown as Interaction;

const steppedExercise = {
  id: 'breuken',
  kind: 'stepped-exercise',
  config: { exercises: [{ id: 'som', prompt: 'Hoeveel is 1/2 + 1/4?' }] },
} as unknown as Interaction;

describe('InteractionPlaceholder', () => {
  async function render(interaction: Interaction): Promise<HTMLElement> {
    TestBed.resetTestingModule();
    const fixture = TestBed.createComponent(InteractionPlaceholder);
    fixture.componentRef.setInput('interaction', interaction);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('trace-game says Dit spel komt binnenkort', async () => {
    const element = await render(traceGame);
    expect(element.querySelector('.message')?.textContent?.trim()).toBe(
      'Dit spel komt binnenkort.',
    );
    // Ted thinks and is decoration; the configuration is not shown.
    const svg = element.querySelector<SVGElement>('snf-ted svg');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(svg?.style.getPropertyValue('--m-ogen-denk')).toBe('inline');
    expect(element.textContent).not.toContain('Vis!');
    expect(element.textContent).not.toContain('aanslaan');
    expect(element.querySelector('button')).toBeNull();
  });

  it('stepped-exercise says Deze oefening komt binnenkort', async () => {
    const element = await render(steppedExercise);
    expect(element.querySelector('.message')?.textContent?.trim()).toBe(
      'Deze oefening komt binnenkort.',
    );
    expect(element.textContent).not.toContain('1/2');
  });
});
