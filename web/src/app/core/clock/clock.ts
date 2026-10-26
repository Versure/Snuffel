import { InjectionToken } from '@angular/core';

/** The time in ms since an arbitrary start, like performance.now. */
export type Clock = () => number;

/**
 * The clock of the app (the speed of a typing drill): performance.now by default; a unit test
 * provides its own time and an e2e test steers it with page.clock.
 */
export const CLOCK = new InjectionToken<Clock>('CLOCK', {
  providedIn: 'root',
  factory: () => () => performance.now(),
});
