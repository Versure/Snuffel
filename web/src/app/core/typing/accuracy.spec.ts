import { accuracy } from './accuracy';

describe('accuracy', () => {
  it('is rounded down so 100% means no mistakes', () => {
    expect(accuracy(199, 200)).toBe(99);
    expect(accuracy(442, 480)).toBe(92);
    expect(accuracy(480, 480)).toBe(100);
    expect(accuracy(0, 5)).toBe(0);
    expect(accuracy(0, 0)).toBe(0);
    // 29 of 100 is 28.999… as a float; still 29.
    expect(accuracy(29, 100)).toBe(29);
  });
});
