// The keyboard of a typing-drill: which key (and which Shift) types a char, and which dead keys of
// US-International compose with the next letter.
//
// The app (web/src/app/interactions/typing-drill/keyboard-layout.ts) has the same keyboard; both
// are tested against content/schema/v1/typing-keyboard.cases.json. A change starts there.

/** The rows of the US QWERTY keyboard, as pairs of the char without and with Shift. */
const ROWS = [
  ['`~', '1!', '2@', '3#', '4$', '5%', '6^', '7&', '8*', '9(', '0)', '-_', '=+'],
  ['qQ', 'wW', 'eE', 'rR', 'tT', 'yY', 'uU', 'iI', 'oO', 'pP', '[{', ']}', '\\|'],
  ['aA', 'sS', 'dD', 'fF', 'gG', 'hH', 'jJ', 'kK', 'lL', ';:', '\'"'],
  ['zZ', 'xX', 'cC', 'vV', 'bB', 'nN', 'mM', ',<', '.>', '/?'],
];

/** The keys of the left hand; the Shift for their capital is on the right. */
const LEFT_HAND = new Set('`12345qwertasdfgzxcvb');

/**
 * Dead keys of US-International and the letters each one composes into one char (`'` and `e`
 * give `é`). A space after the dead key gives the char itself.
 */
export const DEAD_KEYS = {
  "'": 'aeiouycAEIOUYC',
  '"': 'aeiouyAEIOUY',
  '`': 'aeiouAEIOU',
  '~': 'aonAON',
  '^': 'aeiouAEIOU',
};

const CHARS = new Map([[' ', { key: 'space', shift: null }]]);
for (const row of ROWS) {
  for (const pair of row) {
    const [base, shifted] = [...pair];
    CHARS.set(base, { key: base, shift: null });
    CHARS.set(shifted, { key: base, shift: LEFT_HAND.has(base) ? 'right' : 'left' });
  }
}

/**
 * The key that types a char, `{ key, shift }` with the key id of the newKeys enum (`a`, `;`,
 * `space`) and the side of the Shift (`'left'`, `'right'`, always the other hand) or null.
 * Null for a char that is not on the keyboard (`é`, a tab).
 */
export function keyForChar(char) {
  return CHARS.get(char) ?? null;
}

/** The key ids a line uses, in order of first use, with `shift` when a char needs Shift. */
export function keysOfLine(line) {
  const keys = new Set();
  for (const char of line) {
    const found = keyForChar(char);
    if (!found) continue;
    keys.add(found.key);
    if (found.shift) keys.add('shift');
  }
  return [...keys];
}

/** Every dead key directly followed by a letter it composes: `[{ index, sequence }]`. */
export function deadKeySequences(line) {
  const found = [];
  const chars = [...line];
  for (let index = 0; index < chars.length - 1; index++) {
    const composes = DEAD_KEYS[chars[index]];
    if (composes?.includes(chars[index + 1])) {
      found.push({ index, sequence: chars[index] + chars[index + 1] });
    }
  }
  return found;
}
