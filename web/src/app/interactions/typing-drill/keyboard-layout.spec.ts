import keyboardCases from '../../../../../content/schema/v1/typing-keyboard.cases.json';
import type { TypingKey } from '../../core/content/content.types';
import {
  FINGER_KINDS,
  FINGER_NAMES,
  fingerKind,
  fingerOf,
  handOf,
  KEYBOARD_ROWS,
  keyForChar,
  keyName,
  ROW_UNITS,
  type DrawnKey,
} from './keyboard-layout';

interface CharCase {
  readonly char: string;
  readonly key: string;
  readonly shift: 'left' | 'right' | null;
}

interface KeyCase {
  readonly key: string;
  readonly base?: string;
  readonly shift?: string;
  readonly finger: string;
  readonly hand: string;
}

// The same cases as tools/content/typing.test.mjs.
const chars = keyboardCases.chars as readonly CharCase[];
const keys = keyboardCases.keys as readonly KeyCase[];
const drawn: readonly DrawnKey[] = KEYBOARD_ROWS.flat();

describe('keyboard layout', () => {
  it('maps every char in typing-keyboard.cases.json like the tools', () => {
    expect(chars.length).toBe(95);
    for (const { char, key, shift } of chars) {
      expect(keyForChar(char), char).toEqual({ key, shift });
    }
    expect(keyForChar('é')).toBeNull();
    expect(keyForChar('\t')).toBeNull();
    expect(keyForChar('€')).toBeNull();
  });

  it('every key of the cases is on the keyboard with its finger', () => {
    expect(keys.length).toBe(49);
    for (const item of keys) {
      const key = item.key as TypingKey;
      if (key === 'shift') {
        expect(drawn.find((entry) => entry.id === 'shift-left')?.finger).toBe('left-pinky');
        expect(drawn.find((entry) => entry.id === 'shift-right')?.finger).toBe('right-pinky');
        continue;
      }
      const found = drawn.filter((entry) => entry.key === key);
      expect(found.length, key).toBe(1);
      expect(found[0]?.finger, key).toBe(item.finger);
      expect(fingerOf(key), key).toBe(item.finger);
      expect(handOf(fingerOf(key)), key).toBe(item.hand);
      if (item.base !== undefined && item.shift !== undefined) {
        // A letter shows its capital; other keys show both chars.
        const labels = [found[0]?.label, found[0]?.shiftLabel];
        expect(labels.includes(item.shift), key).toBe(true);
      }
    }
    // No drawn key that is not in the cases (apart from the empty keys and the two Shifts).
    for (const entry of drawn.filter((item) => item.key !== null)) {
      expect(
        keys.some((item) => item.key === entry.key),
        entry.id,
      ).toBe(true);
    }
  });

  it('shift is on the other hand', () => {
    expect(keyForChar('A')).toEqual({ key: 'a', shift: 'right' });
    expect(keyForChar('L')).toEqual({ key: 'l', shift: 'left' });
    expect(keyForChar(':')).toEqual({ key: ';', shift: 'left' });
    expect(keyForChar('^')).toEqual({ key: '6', shift: 'left' });
    for (const { char, shift } of chars.filter((item) => item.shift !== null)) {
      const press = keyForChar(char);
      expect(press && handOf(fingerOf(press.key)), char).not.toBe(shift);
    }
  });

  it('every row is equally wide and the empty keys have no finger', () => {
    for (const row of KEYBOARD_ROWS.slice(0, 4)) {
      expect(row.reduce((sum, key) => sum + key.width, 0)).toBe(ROW_UNITS);
    }
    for (const id of ['backspace', 'tab', 'caps-lock', 'enter']) {
      const key = drawn.find((entry) => entry.id === id);
      expect(key?.finger).toBeNull();
      expect(key?.key).toBeNull();
    }
    expect(new Set(drawn.map((key) => key.id)).size).toBe(drawn.length);
  });

  it('names fingers and keys in Dutch', () => {
    expect(FINGER_NAMES['left-index']).toBe('linkerwijsvinger');
    expect(FINGER_NAMES['right-pinky']).toBe('rechterpink');
    expect(FINGER_NAMES.thumb).toBe('duim');
    expect(FINGER_KINDS.map((item) => item.name)).toEqual([
      'pink',
      'ringvinger',
      'middelvinger',
      'wijsvinger',
      'duim',
    ]);
    expect(fingerKind('left-ring')).toBe('ring');
    expect(fingerKind('thumb')).toBe('thumb');
    expect(keyName('space')).toBe('spatie');
    expect(keyName('shift')).toBe('Shift');
    expect(keyName(';')).toBe(';');
  });
});
