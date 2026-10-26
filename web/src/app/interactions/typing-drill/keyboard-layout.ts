// The keyboard of a typing drill: the US QWERTY layout (the standard in the Netherlands;
// US-International has the same keys), with the finger for every key.
//
// tools/content/typing.mjs has the same keyboard; both are tested against
// content/schema/v1/typing-keyboard.cases.json. A change starts there.
import type { TypingKey } from '../../core/content/content.types';

/** A finger of the standard touch-typing method; the thumbs share the space bar. */
export type Finger =
  | 'left-pinky'
  | 'left-ring'
  | 'left-middle'
  | 'left-index'
  | 'right-index'
  | 'right-middle'
  | 'right-ring'
  | 'right-pinky'
  | 'thumb';

/** The side of a Shift key. */
export type Side = 'left' | 'right';

/** One key press for a char: its key, and the Shift that goes with it (the other hand). */
export interface KeyPress {
  readonly key: TypingKey;
  readonly shift: Side | null;
}

/** One drawn key: a key of the drill, a Shift, or an empty key (Tab, Enter) for the shape. */
export interface DrawnKey {
  /** Unique on the keyboard: the key id, `shift-left`, `shift-right`, `tab`, … */
  readonly id: string;
  /** What is printed on the key (without Shift); empty for an empty key. */
  readonly label: string;
  /** The char with Shift, printed above the label for a digit or punctuation. */
  readonly shiftLabel: string | null;
  /** Width in key units (a letter is 1). */
  readonly width: number;
  /** The key of the drill, or null for an empty key. */
  readonly key: TypingKey | null;
  /** The side of a Shift key, else null. */
  readonly side: Side | null;
  /** The finger that types it, or null for an empty key. */
  readonly finger: Finger | null;
}

/** The pairs of chars without and with Shift, per row of the keyboard. */
const CHAR_ROWS = [
  ['`~', '1!', '2@', '3#', '4$', '5%', '6^', '7&', '8*', '9(', '0)', '-_', '=+'],
  ['qQ', 'wW', 'eE', 'rR', 'tT', 'yY', 'uU', 'iI', 'oO', 'pP', '[{', ']}', '\\|'],
  ['aA', 'sS', 'dD', 'fF', 'gG', 'hH', 'jJ', 'kK', 'lL', ';:', '\'"'],
  ['zZ', 'xX', 'cC', 'vV', 'bB', 'nN', 'mM', ',<', '.>', '/?'],
] as const;

/** The keys per finger (standard touch typing; the 6 with the right hand). */
const FINGER_KEYS: Readonly<Record<Exclude<Finger, 'thumb'>, string>> = {
  'left-pinky': '`1qaz',
  'left-ring': '2wsx',
  'left-middle': '3edc',
  'left-index': '45rtfgvb',
  'right-index': '67yuhjnm',
  'right-middle': '8ik,',
  'right-ring': '9ol.',
  'right-pinky': "0-=p[]\\;'/",
};

/** The finger of a key of the drill (Shift: the pinky of that side). */
export function fingerOf(key: TypingKey, side: Side | null = null): Finger {
  if (key === 'space') return 'thumb';
  if (key === 'shift') return side === 'right' ? 'right-pinky' : 'left-pinky';
  for (const [finger, keys] of Object.entries(FINGER_KEYS)) {
    if (keys.includes(key)) return finger as Finger;
  }
  throw new Error(`No finger for key ${key}`);
}

/** The hand of a finger; the thumb is both. */
export function handOf(finger: Finger): Side | 'both' {
  if (finger === 'thumb') return 'both';
  return finger.startsWith('left') ? 'left' : 'right';
}

const CHARS = new Map<string, KeyPress>([[' ', { key: 'space', shift: null }]]);
for (const row of CHAR_ROWS) {
  for (const pair of row) {
    const [base, shifted] = [...pair] as [TypingKey, string];
    CHARS.set(base, { key: base, shift: null });
    CHARS.set(shifted, { key: base, shift: handOf(fingerOf(base)) === 'left' ? 'right' : 'left' });
  }
}

/** The key (and Shift) that types a char; null for a char that is not on the keyboard. */
export function keyForChar(char: string): KeyPress | null {
  return CHARS.get(char) ?? null;
}

function drillKey(pair: string): DrawnKey {
  const [base, shifted] = [...pair] as [TypingKey, string];
  const letter = /[a-z]/.test(base);
  return {
    id: base,
    // A letter key shows its capital, as on a real keyboard; other keys show both chars.
    label: letter ? shifted : base,
    shiftLabel: letter ? null : shifted,
    width: 1,
    key: base,
    side: null,
    finger: fingerOf(base),
  };
}

function emptyKey(id: string, label: string, width: number): DrawnKey {
  return { id, label, shiftLabel: null, width, key: null, side: null, finger: null };
}

function shiftKey(side: Side, width: number): DrawnKey {
  return {
    id: `shift-${side}`,
    label: 'Shift',
    shiftLabel: null,
    width,
    key: 'shift',
    side,
    finger: fingerOf('shift', side),
  };
}

/** Every row is 15 key units wide. */
export const ROW_UNITS = 15;

/** The rows of the drawn keyboard, top to bottom. */
export const KEYBOARD_ROWS: readonly (readonly DrawnKey[])[] = [
  [...CHAR_ROWS[0].map(drillKey), emptyKey('backspace', '', 2)],
  [
    emptyKey('tab', '', 1.5),
    ...CHAR_ROWS[1].slice(0, 12).map(drillKey),
    {
      ...drillKey(CHAR_ROWS[1][12]),
      width: 1.5,
    },
  ],
  [emptyKey('caps-lock', '', 1.75), ...CHAR_ROWS[2].map(drillKey), emptyKey('enter', '', 2.25)],
  [shiftKey('left', 2.25), ...CHAR_ROWS[3].map(drillKey), shiftKey('right', 2.75)],
  [
    {
      id: 'space',
      label: '',
      shiftLabel: null,
      width: 7,
      key: 'space',
      side: null,
      finger: 'thumb',
    },
  ],
];

/** The name of a finger with its hand, as in "Volgende toets: f, linkerwijsvinger". */
export const FINGER_NAMES: Readonly<Record<Finger, string>> = {
  'left-pinky': 'linkerpink',
  'left-ring': 'linkerringvinger',
  'left-middle': 'linkermiddelvinger',
  'left-index': 'linkerwijsvinger',
  'right-index': 'rechterwijsvinger',
  'right-middle': 'rechtermiddelvinger',
  'right-ring': 'rechterringvinger',
  'right-pinky': 'rechterpink',
  thumb: 'duim',
};

/** A finger without its hand: the legend has one colour per finger for both hands. */
export type FingerKind = 'pinky' | 'ring' | 'middle' | 'index' | 'thumb';

/** The fingers of the legend, from the outside in, with their name. */
export const FINGER_KINDS: readonly { readonly kind: FingerKind; readonly name: string }[] = [
  { kind: 'pinky', name: 'pink' },
  { kind: 'ring', name: 'ringvinger' },
  { kind: 'middle', name: 'middelvinger' },
  { kind: 'index', name: 'wijsvinger' },
  { kind: 'thumb', name: 'duim' },
];

/** The kind of a finger (`left-index` is `index`). */
export function fingerKind(finger: Finger): FingerKind {
  return finger === 'thumb' ? 'thumb' : (finger.split('-')[1] as FingerKind);
}
