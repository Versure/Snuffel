import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { TypingKey } from '../../../core/content/content.types';
import {
  FINGER_KINDS,
  fingerKind,
  fingerOf,
  KEYBOARD_ROWS,
  ROW_UNITS,
  type DrawnKey,
  type FingerKind,
  type KeyPress,
} from '../keyboard-layout';
import { newKeysText, nextKeyText } from '../typing-text';

/** One drawn key as the template shows it. */
interface KeyView {
  readonly id: string;
  readonly label: string;
  readonly shiftLabel: string | null;
  readonly classes: string;
  readonly column: string;
  readonly isNew: boolean;
}

/** Grid columns per key unit: a quarter key is the smallest step (Caps Lock is 1.75). */
const COLUMNS_PER_UNIT = 4;

/**
 * The keyboard of a typing drill with the finger guide (plan M15 question 3): every key in the
 * colour of its finger, the key (and the Shift) for the next char marked, new keys with a star,
 * a legend of the fingers and the next key as text. The drawn keyboard is hidden from a screen
 * reader; the line "Volgende toets: …" is its text alternative. Nothing depends on hover.
 */
@Component({
  selector: 'snf-typing-keyboard',
  templateUrl: './keyboard.html',
  styleUrl: './keyboard.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TypingKeyboard {
  /** The key for the next char, or null when there is none (finished, not started). */
  readonly next = input<KeyPress | null>(null);
  /** The keys that are new in this lesson. */
  readonly newKeys = input<readonly TypingKey[]>([]);

  protected readonly columns = ROW_UNITS * COLUMNS_PER_UNIT;

  protected readonly rows = computed(() => {
    const next = this.next();
    const fresh = new Set(this.newKeys());
    return KEYBOARD_ROWS.map((row) => {
      // The space bar is centred: its row starts four keys in.
      let column = row.length === 1 ? 4 * COLUMNS_PER_UNIT + 1 : 1;
      return row.map((key): KeyView => {
        const span = key.width * COLUMNS_PER_UNIT;
        const view: KeyView = {
          id: key.id,
          label: key.label,
          shiftLabel: key.shiftLabel,
          classes: keyClasses(key, next, fresh),
          column: `${column} / span ${span}`,
          isNew: key.key !== null && fresh.has(key.key),
        };
        column += span;
        return view;
      });
    });
  });

  /** The finger kinds that type the next char (the Shift pinky too). */
  private readonly nowKinds = computed(() => {
    const next = this.next();
    const kinds = new Set<FingerKind>();
    if (!next) return kinds;
    kinds.add(fingerKind(fingerOf(next.key)));
    if (next.shift) kinds.add('pinky');
    return kinds;
  });

  protected readonly legend = computed(() =>
    FINGER_KINDS.map((item) => ({ ...item, now: this.nowKinds().has(item.kind) })),
  );

  protected readonly nextText = computed(() => {
    const next = this.next();
    return next ? nextKeyText(next) : '';
  });

  protected readonly newText = computed(() => newKeysText(this.newKeys()));
}

function keyClasses(key: DrawnKey, next: KeyPress | null, fresh: ReadonlySet<TypingKey>): string {
  const classes = ['key'];
  if (key.finger === null) classes.push('empty');
  else classes.push(`finger-${fingerKind(key.finger)}`);
  if (key.key !== null && fresh.has(key.key)) classes.push('new');
  if (next && isNext(key, next)) classes.push('next');
  if (key.key === 'space') classes.push('space');
  return classes.join(' ');
}

function isNext(key: DrawnKey, next: KeyPress): boolean {
  if (key.key === 'shift') return key.side === next.shift;
  return key.key !== null && key.key === next.key;
}
