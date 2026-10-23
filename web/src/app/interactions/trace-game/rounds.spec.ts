import { makeRounds } from './rounds';

/** A fixed sequence of pseudo-random numbers (a small linear congruential generator). */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

const five = ['tik', 'zwaar', 'vast', 'plant', 'bodem'];

function counts(rounds: string[]): Map<string, number> {
  const result = new Map<string, number>();
  for (const id of rounds) result.set(id, (result.get(id) ?? 0) + 1);
  return result;
}

const cases: [string[], number][] = [
  [five, 8],
  [five, 5],
  [five, 12],
  [['a', 'b'], 7],
  [['a', 'b', 'c'], 12],
  [['a', 'b', 'c', 'd'], 9],
];

describe('makeRounds', () => {
  it('every pattern comes at least once when there are enough rounds', () => {
    for (let seed = 1; seed <= 50; seed += 1) {
      for (const [ids, rounds] of cases) {
        const result = makeRounds(ids, rounds, seeded(seed));
        expect(result).toHaveLength(rounds);
        for (const id of ids) expect(result).toContain(id);
      }
    }
  });

  it('no pattern comes more than once more often than another', () => {
    for (let seed = 1; seed <= 50; seed += 1) {
      for (const [ids, rounds] of cases) {
        const found = [...counts(makeRounds(ids, rounds, seeded(seed))).values()];
        expect(Math.max(...found) - Math.min(...found)).toBeLessThanOrEqual(1);
      }
    }
  });

  it('never the same pattern twice in a row when that is possible', () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      for (const [ids, rounds] of cases) {
        const result = makeRounds(ids, rounds, seeded(seed));
        for (let index = 1; index < result.length; index += 1) {
          expect(result[index]).not.toBe(result[index - 1]);
        }
      }
    }
    // With one pattern it is not possible; the game still has every round.
    expect(makeRounds(['enige'], 3, seeded(1))).toEqual(['enige', 'enige', 'enige']);
  });

  it('fewer rounds than patterns gives different patterns', () => {
    for (let seed = 1; seed <= 50; seed += 1) {
      const result = makeRounds(five, 3, seeded(seed));
      expect(result).toHaveLength(3);
      expect(new Set(result).size).toBe(3);
      for (const id of result) expect(five).toContain(id);
    }
  });

  it('five patterns and eight rounds give all five plus three extra, like the reference', () => {
    for (let seed = 1; seed <= 50; seed += 1) {
      const found = counts(makeRounds(five, 8, seeded(seed)));
      expect([...found.keys()].sort()).toEqual([...five].sort());
      expect([...found.values()].sort()).toEqual([1, 1, 2, 2, 2]);
    }
  });

  it('is deterministic with a fixed random', () => {
    expect(makeRounds(five, 8, seeded(7))).toEqual(makeRounds(five, 8, seeded(7)));
    const orders = new Set(
      Array.from({ length: 20 }, (_, seed) => makeRounds(five, 8, seeded(seed + 1)).join()),
    );
    expect(orders.size).toBeGreaterThan(1);
  });
});
