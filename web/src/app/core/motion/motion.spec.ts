import { TestBed } from '@angular/core/testing';
import { ANIMATION_FRAMES, REDUCED_MOTION } from './motion';

describe('motion', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    TestBed.resetTestingModule();
  });

  it('REDUCED_MOTION follows prefers-reduced-motion', () => {
    let matches = true;
    const matchMedia = vi.fn((query: string) => ({ matches, media: query }));
    vi.stubGlobal('matchMedia', matchMedia);
    const reducedMotion = TestBed.inject(REDUCED_MOTION);
    expect(reducedMotion()).toBe(true);
    expect(matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
    matches = false;
    expect(reducedMotion()).toBe(false);
  });

  it('REDUCED_MOTION is false without matchMedia', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(TestBed.inject(REDUCED_MOTION)()).toBe(false);
  });

  it('ANIMATION_FRAMES uses requestAnimationFrame', () => {
    const request = vi.fn(() => 7);
    const cancel = vi.fn();
    vi.stubGlobal('requestAnimationFrame', request);
    vi.stubGlobal('cancelAnimationFrame', cancel);
    const frames = TestBed.inject(ANIMATION_FRAMES);
    const callback = vi.fn();
    expect(frames.request(callback)).toBe(7);
    expect(request).toHaveBeenCalledWith(callback);
    frames.cancel(7);
    expect(cancel).toHaveBeenCalledWith(7);
  });
});
