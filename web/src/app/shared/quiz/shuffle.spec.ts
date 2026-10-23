import { pick, shuffle } from './shuffle';

/** A random source that returns the given values in turn (and then starts again). */
function sequence(...values: number[]): () => number {
  let index = 0;
  return () => values[index++ % values.length];
}

describe('shuffle', () => {
  const list = ['a', 'b', 'c', 'd', 'e'];

  it('keeps every item exactly once', () => {
    for (let run = 0; run < 20; run += 1) {
      const result = shuffle(list, Math.random);
      expect(result).toHaveLength(list.length);
      expect([...result].sort()).toEqual(list);
    }
  });

  it('is deterministic with a fixed random', () => {
    expect(shuffle(list, sequence(0))).toEqual(['b', 'c', 'd', 'e', 'a']);
    expect(shuffle(list, sequence(0.99))).toEqual(list);
    expect(shuffle(list, sequence(0.3, 0.7))).toEqual(shuffle(list, sequence(0.3, 0.7)));
  });

  it('does not change the input', () => {
    const input = [...list];
    const result = shuffle(input, sequence(0));
    expect(input).toEqual(list);
    expect(result).not.toBe(input);
  });

  it('handles an empty list, one item and a random of almost 1', () => {
    expect(shuffle([], Math.random)).toEqual([]);
    expect(shuffle(['a'], Math.random)).toEqual(['a']);
    expect(shuffle(['a', 'b'], () => 0.999999999)).toEqual(['a', 'b']);
  });
});

describe('pick', () => {
  it('picks the item at the random position', () => {
    expect(pick(['a', 'b', 'c'], () => 0)).toBe('a');
    expect(pick(['a', 'b', 'c'], () => 0.5)).toBe('b');
    expect(pick(['a', 'b', 'c'], () => 0.999)).toBe('c');
  });

  it('gives undefined for an empty list', () => {
    expect(pick([], Math.random)).toBeUndefined();
  });
});
