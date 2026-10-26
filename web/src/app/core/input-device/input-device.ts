import { InjectionToken } from '@angular/core';

/** What the app knows about the input of the device. */
export interface InputDevice {
  /**
   * True on a device with only a touch screen (a phone, a bare tablet): a coarse pointer
   * without hover, and no fine pointer anywhere. A laptop with a touch screen, or a tablet with
   * a trackpad, has a fine pointer and is not touch-only. Read again on every call.
   */
  touchOnly(): boolean;
}

function matches(query: string): boolean {
  return matchMedia(query).matches;
}

/** The input device of the browser; false without matchMedia (plan M15 question 5). */
export const INPUT_DEVICE = new InjectionToken<InputDevice>('INPUT_DEVICE', {
  providedIn: 'root',
  factory: () => ({
    touchOnly: () =>
      typeof matchMedia === 'function' &&
      matches('(pointer: coarse) and (hover: none)') &&
      !matches('(any-pointer: fine)'),
  }),
});
