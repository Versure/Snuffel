import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { SignalIcon as SignalIconName } from '../../../core/content/content.types';

export type SignalIconColor = 'yellow' | 'pink' | 'lilac';

/** One stroke of a drawing in a 48 × 48 box. */
export interface IconStroke {
  readonly d: string;
  readonly dashed?: boolean;
}

export interface IconDrawing {
  readonly color: SignalIconColor;
  readonly strokes: readonly IconStroke[];
  /** Filled dots (the point of ? and !). */
  readonly dots?: readonly { readonly cx: number; readonly cy: number }[];
}

/**
 * The fixed set from lesson.schema.json (`SignalIcon`). A Record, so TypeScript fails when the
 * schema gets an icon without a drawing here. tick, shake and stop come from the reference lesson.
 */
export const SIGNAL_ICONS: Record<SignalIconName, IconDrawing> = {
  tick: { color: 'yellow', strokes: [{ d: 'M8 30 H20 L24 12 L28 30 H40' }] },
  shake: {
    color: 'pink',
    strokes: [{ d: 'M6 32 H14 L18 16 L22 26 L26 14 L30 26 L34 16 L38 24 H42' }],
  },
  stop: {
    color: 'lilac',
    strokes: [{ d: 'M24 8 V26' }, { d: 'M16 22 L24 30 L32 22' }, { d: 'M10 38 H38', dashed: true }],
  },
  check: { color: 'yellow', strokes: [{ d: 'M12 25 L20 33 L36 15' }] },
  cross: { color: 'pink', strokes: [{ d: 'M15 15 L33 33' }, { d: 'M33 15 L15 33' }] },
  question: {
    color: 'lilac',
    strokes: [{ d: 'M17 18 A7 7 0 1 1 27 24 C25 25 24 26.5 24 29 V31' }],
    dots: [{ cx: 24, cy: 37.5 }],
  },
  idea: {
    color: 'yellow',
    strokes: [
      { d: 'M20 31 V28 C14 25 13 17 18 12.5 C21 10 27 10 30 12.5 C35 17 34 25 28 28 V31 Z' },
      { d: 'M19 36 H29' },
      { d: 'M21 40 H27' },
    ],
  },
  warning: {
    color: 'pink',
    strokes: [{ d: 'M24 8 L41 38 H7 Z' }, { d: 'M24 18 V28' }],
    dots: [{ cx: 24, cy: 33 }],
  },
};

/** The icon of a signal card. Decoration: the title of the card carries the meaning. */
@Component({
  selector: 'snf-signal-icon',
  templateUrl: './signal-icon.html',
  styleUrl: './signal-icon.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignalIcon {
  readonly name = input.required<SignalIconName>();

  protected readonly drawing = computed(() => SIGNAL_ICONS[this.name()]);
}
