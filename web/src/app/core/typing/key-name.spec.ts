import { keyName } from './key-name';

describe('keyName', () => {
  it('names space and Shift, and any other key by itself', () => {
    expect(keyName('space')).toBe('spatie');
    expect(keyName('shift')).toBe('Shift');
    expect(keyName(';')).toBe(';');
    expect(keyName('f')).toBe('f');
  });
});
