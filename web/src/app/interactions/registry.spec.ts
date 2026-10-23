import { TestBed } from '@angular/core/testing';
import { INTERACTION_REGISTRY, INTERACTIONS } from './registry';
import { TraceGame } from './trace-game/trace-game';

describe('interaction registry', () => {
  it('trace-game loads the TraceGame component', async () => {
    const registry = TestBed.inject(INTERACTION_REGISTRY);
    expect(registry).toBe(INTERACTIONS);
    const load = registry['trace-game'];
    expect(load).toBeDefined();
    expect(await load?.()).toBe(TraceGame);
  });

  it('stepped-exercise has no component yet', () => {
    expect(TestBed.inject(INTERACTION_REGISTRY)['stepped-exercise']).toBeUndefined();
  });
});
