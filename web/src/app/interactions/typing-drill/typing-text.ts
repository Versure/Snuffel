// Fixed texts of a typing drill (no lesson content), and how keys are written in a sentence.
import type { TypingKey } from '../../core/content/content.types';
import { keyName } from '../../core/typing/key-name';
import { FINGER_NAMES, fingerOf, type KeyPress } from './keyboard-layout';

/** "a", "a en b", "a, b en c". */
export function dutchList(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} en ${items[items.length - 1]}`;
}

/** "Nieuw: g en h", or an empty text without new keys. */
export function newKeysText(keys: readonly TypingKey[]): string {
  return keys.length === 0 ? '' : `Nieuw: ${dutchList(keys.map(keyName))}`;
}

/**
 * The next key and its finger(s) as a sentence: "Volgende toets: f, linkerwijsvinger", with
 * Shift "Volgende toets: Shift rechts + a, rechterpink en linkerpink".
 */
export function nextKeyText(next: KeyPress): string {
  const finger = FINGER_NAMES[fingerOf(next.key)];
  if (next.shift === null) return `Volgende toets: ${keyName(next.key)}, ${finger}`;
  const side = next.shift === 'left' ? 'links' : 'rechts';
  const shiftFinger = FINGER_NAMES[fingerOf('shift', next.shift)];
  return `Volgende toets: Shift ${side} + ${keyName(next.key)}, ${shiftFinger} en ${finger}`;
}
