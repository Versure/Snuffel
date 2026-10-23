import { InjectionToken } from '@angular/core';

/** A source of random numbers in [0, 1), like Math.random. */
export type RandomSource = () => number;

/**
 * The randomness of the app (shuffled quiz options, a Ted line). Math.random by default; a unit
 * test provides a fixed sequence so the result is always the same.
 */
export const RANDOM = new InjectionToken<RandomSource>('RANDOM', {
  providedIn: 'root',
  factory: () => Math.random,
});
