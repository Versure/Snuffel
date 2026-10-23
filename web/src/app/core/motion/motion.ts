import { InjectionToken } from '@angular/core';

/** Whether the user asked for less motion; read again every time it matters. */
export type ReducedMotion = () => boolean;

/**
 * `prefers-reduced-motion: reduce` of the browser, read on every call so a change in the system
 * settings counts for the next animation. False without `matchMedia`.
 */
export const REDUCED_MOTION = new InjectionToken<ReducedMotion>('REDUCED_MOTION', {
  providedIn: 'root',
  factory: () => () =>
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches,
});

/** Animation frames, like requestAnimationFrame and cancelAnimationFrame. */
export interface AnimationFrames {
  request(callback: (time: number) => void): number;
  cancel(handle: number): void;
}

/** The animation frames of the browser; a unit test provides frames it runs by hand. */
export const ANIMATION_FRAMES = new InjectionToken<AnimationFrames>('ANIMATION_FRAMES', {
  providedIn: 'root',
  factory: () => ({
    request: (callback) => requestAnimationFrame(callback),
    cancel: (handle) => cancelAnimationFrame(handle),
  }),
});
