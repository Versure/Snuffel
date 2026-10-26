// The name of a key in a text, in a file without other imports: the typing drill and /ouder share
// it without loading the keyboard map.

/** Keys with a name of their own; any other key is named by itself (`f`, `;`). */
const KEY_NAMES: Readonly<Record<string, string>> = {
  space: 'spatie',
  shift: 'Shift',
};

/** The name of a key (a key id of `newKeys`, or of `mistakes` in a result) in a text. */
export function keyName(key: string): string {
  return KEY_NAMES[key] ?? key;
}
