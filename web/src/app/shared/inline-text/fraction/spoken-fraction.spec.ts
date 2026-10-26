import { spokenFraction } from './spoken-fraction';

describe('spokenFraction', () => {
  const cases: readonly [string, Parameters<typeof spokenFraction>[0], string][] = [
    ['1/2', { numerator: '1', denominator: '2' }, '1 half'],
    ['3/2', { numerator: '3', denominator: '2' }, '3 halve'],
    ['1/3', { numerator: '1', denominator: '3' }, '1 derde'],
    ['3/4', { numerator: '3', denominator: '4' }, '3 vierde'],
    ['1/5', { numerator: '1', denominator: '5' }, '1 vijfde'],
    ['5/6', { numerator: '5', denominator: '6' }, '5 zesde'],
    ['3/8', { numerator: '3', denominator: '8' }, '3 achtste'],
    ['3/10', { numerator: '3', denominator: '10' }, '3 tiende'],
    ['7/12', { numerator: '7', denominator: '12' }, '7 twaalfde'],
    ['1/20', { numerator: '1', denominator: '20' }, '1 twintigste'],
    ['3/100', { numerator: '3', denominator: '100' }, '3 honderdste'],
    ['1/1000', { numerator: '1', denominator: '1000' }, '1 duizendste'],
    ['3/37', { numerator: '3', denominator: '37' }, '3 gedeeld door 37'],
    ['3/1', { numerator: '3', denominator: '1' }, '3 gedeeld door 1'],
    ['1 1/4', { whole: '1', numerator: '1', denominator: '4' }, '1 en 1 vierde'],
    ['−1/2', { numerator: '1', denominator: '2', negative: true }, 'min 1 half'],
    ['0/5', { numerator: '0', denominator: '5' }, '0 vijfde'],
  ];

  for (const [name, parts, spoken] of cases) {
    it(`reads ${name} as "${spoken}"`, () => {
      expect(spokenFraction(parts)).toBe(spoken);
    });
  }

  it('has an ordinal for every denominator from 3 to 20 and for the tens up to 100', () => {
    for (const denominator of [
      ...Array.from({ length: 18 }, (_, i) => i + 3),
      30,
      40,
      50,
      60,
      70,
      80,
      90,
      100,
    ]) {
      expect(spokenFraction({ numerator: '1', denominator: String(denominator) })).not.toContain(
        'gedeeld door',
      );
    }
    expect(spokenFraction({ numerator: '1', denominator: '21' })).toBe('1 gedeeld door 21');
  });
});
