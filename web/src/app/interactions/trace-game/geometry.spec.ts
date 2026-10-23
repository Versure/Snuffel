import type { ShapePart } from '../../core/content/content.types';
import { lineTip, rodPath, tracePoint, tracePoints, VIEW_BOX, WATER_Y } from './geometry';
import { referencePoints, referenceRod } from './reference-curves';
import { shapeValue } from './shape';

const plant: ShapePart[] = [
  { type: 'base', level: 0.22 },
  { type: 'ramp', from: 0.25, to: 0.85, height: 0.42 },
  { type: 'wobble', amplitude: 0.02, frequency: 9 / (2 * Math.PI) },
];

const numbers = (path: string) => (path.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);

describe('trace-game geometry', () => {
  it('maps time and height like the reference', () => {
    expect(VIEW_BOX).toBe('0 0 320 200');
    expect(tracePoint(0, 0)).toEqual({ x: 10, y: 140 });
    expect(tracePoint(1, 1)).toEqual({ x: 200, y: 30 });
    expect(tracePoint(0.5, 0.22).x).toBeCloseTo(105, 10);
    expect(tracePoint(0.5, 0.22).y).toBeCloseTo(115.8, 10);
    for (const end of [1, 0.5, 0.001]) {
      expect(tracePoints(plant, end)).toBe(referencePoints((t) => shapeValue(plant, t), end));
    }
  });

  it('draws 121 points up to the end', () => {
    const points = tracePoints(plant, 0.5).split(' ');
    expect(points).toHaveLength(121);
    expect(points[0]).toBe('10.0,115.8');
    const [lastX] = points[120].split(',').map(Number);
    expect(lastX).toBe(105);
    expect(tracePoints(plant, 1, 10).split(' ')).toHaveLength(11);
  });

  it('bends the rod tip like the reference', () => {
    for (const value of [0, 0.22, 0.5, 0.85, 1]) {
      const reference = referenceRod(value);
      expect(lineTip(value).x).toBeCloseTo(reference.tipX, 10);
      expect(lineTip(value).y).toBeCloseTo(reference.tipY, 10);
      const ours = numbers(rodPath(value));
      const theirs = numbers(reference.d);
      expect(ours).toHaveLength(theirs.length);
      ours.forEach((n, index) => expect(n).toBeCloseTo(theirs[index], 2));
    }
    expect(rodPath(0)).toBe('M310 196 Q282 120 236 40');
  });

  it('keeps the line above the water', () => {
    expect(tracePoint(0.5, -0.5).y).toBe(WATER_Y);
    expect(tracePoint(0.5, 2).y).toBe(0);
    const deep: ShapePart[] = [
      { type: 'base', level: 0 },
      { type: 'wobble', amplitude: 1, frequency: 3 },
    ];
    for (const point of tracePoints(deep, 1).split(' ')) {
      const y = Number(point.split(',')[1]);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(WATER_Y);
    }
  });
});
