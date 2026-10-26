import { dutchList, newKeysText, nextKeyText } from './typing-text';

describe('typing texts', () => {
  it('lists in Dutch', () => {
    expect(dutchList([])).toBe('');
    expect(dutchList(['a'])).toBe('a');
    expect(dutchList(['a', 'b'])).toBe('a en b');
    expect(dutchList(['a', 'b', 'c'])).toBe('a, b en c');
  });

  it('names the new keys', () => {
    expect(newKeysText([])).toBe('');
    expect(newKeysText(['g', 'h'])).toBe('Nieuw: g en h');
    expect(newKeysText(['a', ';', 'space'])).toBe('Nieuw: a, ; en spatie');
  });

  it('writes the next key with its finger, and Shift on the other hand', () => {
    expect(nextKeyText({ key: 'f', shift: null })).toBe('Volgende toets: f, linkerwijsvinger');
    expect(nextKeyText({ key: 'space', shift: null })).toBe('Volgende toets: spatie, duim');
    expect(nextKeyText({ key: 'a', shift: 'right' })).toBe(
      'Volgende toets: Shift rechts + a, rechterpink en linkerpink',
    );
    expect(nextKeyText({ key: 'l', shift: 'left' })).toBe(
      'Volgende toets: Shift links + l, linkerpink en rechterringvinger',
    );
  });
});
