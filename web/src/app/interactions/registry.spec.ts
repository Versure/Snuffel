import { TestBed } from '@angular/core/testing';
import { INTERACTION_REGISTRY, INTERACTIONS } from './registry';
import { SteppedExercise } from './stepped-exercise/stepped-exercise';
import { TraceGame } from './trace-game/trace-game';

describe('interaction registry', () => {
  it('trace-game loads the TraceGame component', async () => {
    const registry = TestBed.inject(INTERACTION_REGISTRY);
    expect(registry).toBe(INTERACTIONS);
    const load = registry['trace-game'];
    expect(load).toBeDefined();
    expect(await load?.()).toBe(TraceGame);
  });

  it('stepped-exercise loads the SteppedExercise component', async () => {
    const load = TestBed.inject(INTERACTION_REGISTRY)['stepped-exercise'];
    expect(load).toBeDefined();
    expect(await load?.()).toBe(SteppedExercise);
  });
});
