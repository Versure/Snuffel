import lessonJson from '../../../../../content/fixtures/courses/proefcursus/lessons/01-proefles.json';
import type { Lesson, ShapePart } from '../../core/content/content.types';
import { REFERENCE_CURVES } from './reference-curves';
import { gaussian, partValue, shapeValue, smoothstep } from './shape';

const TAU = 2 * Math.PI;
const times = Array.from({ length: 1001 }, (_, index) => index / 1000);

/** The largest difference between a shape and a curve over 1001 points from 0 to 1. */
function maxDifference(shape: ShapePart[], curve: (t: number) => number): number {
  return Math.max(...times.map((t) => Math.abs(shapeValue(shape, t) - curve(t))));
}

/** The five patterns of the reference, built from blocks with the exact constants. */
const exactShapes: Record<string, ShapePart[]> = {
  tik: [
    { type: 'base', level: 0.22 },
    { type: 'wobble', amplitude: 0.015, frequency: 40 / TAU },
    { type: 'pulse', at: 0.5, width: 0.012, height: 0.62 },
    { type: 'pulse', at: 0.57, width: 0.01, height: 0.32 },
  ],
  // sin a · sin b = ½ cos(a − b) − ½ cos(a + b), and cos x = sin(x + π/2).
  zwaar: [
    { type: 'base', level: 0.22 },
    { type: 'ramp', from: 0.32, to: 0.4, height: 0.42 },
    {
      type: 'wobble',
      amplitude: 0.085,
      frequency: 42 / TAU,
      phase: (Math.PI / 2 - 1) / TAU,
      from: 0.32,
      fadeIn: 0.08,
    },
    {
      type: 'wobble',
      amplitude: 0.085,
      frequency: 68 / TAU,
      phase: 1 + (1 - Math.PI / 2) / TAU,
      from: 0.32,
      fadeIn: 0.08,
    },
    { type: 'wobble', amplitude: 0.05, frequency: 90 / TAU, from: 0.32, fadeIn: 0.08 },
  ],
  vast: [
    { type: 'base', level: 0.22 },
    { type: 'ramp', from: 0.32, to: 0.42, height: 0.63 },
    { type: 'wobble', amplitude: 0.004, frequency: 30 / TAU },
  ],
  plant: [
    { type: 'base', level: 0.22 },
    { type: 'ramp', from: 0.25, to: 0.85, height: 0.42 },
    { type: 'wobble', amplitude: 0.02, frequency: 9 / TAU },
  ],
  bodem: [
    { type: 'base', level: 0.28 },
    { type: 'pulses', start: 0.08, interval: 0.13, count: 8, width: 0.01, height: 0.22 },
  ],
};

describe('trace-game shape', () => {
  it('base is constant', () => {
    for (const t of [0, 0.3, 1]) expect(partValue({ type: 'base', level: 0.22 }, t)).toBe(0.22);
  });

  it('pulse is a gaussian with width as standard deviation', () => {
    const pulse: ShapePart = { type: 'pulse', at: 0.5, width: 0.1, height: 0.6 };
    expect(partValue(pulse, 0.5)).toBeCloseTo(0.6, 12);
    expect(partValue(pulse, 0.6)).toBeCloseTo(0.6 * Math.exp(-0.5), 12);
    expect(partValue(pulse, 0.3)).toBeCloseTo(0.6 * Math.exp(-2), 12);
    expect(gaussian(0.4, 0.5, 0.1)).toBeCloseTo(Math.exp(-0.5), 12);
  });

  it('pulses repeats count peaks interval apart', () => {
    const pulses: ShapePart = {
      type: 'pulses',
      start: 0.1,
      interval: 0.2,
      count: 3,
      width: 0.01,
      height: 0.5,
    };
    for (const at of [0.1, 0.3, 0.5]) expect(partValue(pulses, at)).toBeCloseTo(0.5, 6);
    expect(partValue(pulses, 0.7)).toBeLessThan(1e-6);
    expect(partValue(pulses, 0.2)).toBeLessThan(1e-6);
  });

  it('ramp rises smoothly from 0 to height between from and to', () => {
    const ramp: ShapePart = { type: 'ramp', from: 0.2, to: 0.6, height: 0.4 };
    expect(partValue(ramp, 0)).toBe(0);
    expect(partValue(ramp, 0.2)).toBe(0);
    expect(partValue(ramp, 0.4)).toBeCloseTo(0.2, 12);
    expect(partValue(ramp, 0.3)).toBeCloseTo(0.4 * smoothstep(0.2, 0.6, 0.3), 12);
    expect(smoothstep(0.2, 0.6, 0.3)).toBeCloseTo(0.25 * 0.25 * (3 - 0.5), 12);
    expect(partValue(ramp, 0.6)).toBeCloseTo(0.4, 12);
    expect(partValue(ramp, 1)).toBeCloseTo(0.4, 12);
  });

  it('wobble makes frequency waves over the whole trace', () => {
    const wobble: ShapePart = { type: 'wobble', amplitude: 0.1, frequency: 4 };
    expect(partValue(wobble, 0)).toBeCloseTo(0, 12);
    expect(partValue(wobble, 1 / 16)).toBeCloseTo(0.1, 12);
    expect(partValue(wobble, 3 / 16)).toBeCloseTo(-0.1, 12);
    expect(partValue(wobble, 0.5)).toBeCloseTo(0, 12);
    for (const t of [0.1, 0.37, 0.9]) {
      expect(partValue(wobble, t)).toBeCloseTo(0.1 * Math.sin(TAU * 4 * t), 12);
    }
  });

  it('phase shifts the waves by a part of a wave', () => {
    const wobble: ShapePart = { type: 'wobble', amplitude: 0.1, frequency: 4, phase: 0.25 };
    expect(partValue(wobble, 0)).toBeCloseTo(0.1, 12);
    for (const t of [0.1, 0.37, 0.9]) {
      expect(partValue(wobble, t)).toBeCloseTo(0.1 * Math.cos(TAU * 4 * t), 12);
    }
  });

  it('wobble is zero outside from and to and fades in over fadeIn', () => {
    const wobble: ShapePart = {
      type: 'wobble',
      amplitude: 0.1,
      frequency: 4,
      phase: 0.25,
      from: 0.25,
      to: 0.75,
    };
    expect(partValue(wobble, 0.2)).toBe(0);
    expect(partValue(wobble, 0.8)).toBe(0);
    expect(partValue(wobble, 0.5)).toBeCloseTo(0.1, 12);
    const fading: ShapePart = { ...wobble, fadeIn: 0.2 };
    expect(partValue(fading, 0.25)).toBe(0);
    expect(partValue(fading, 0.35)).toBeCloseTo(0.5 * 0.1 * Math.cos(TAU * 4 * 0.35), 12);
    expect(partValue(fading, 0.5)).toBeCloseTo(0.1, 12);
  });

  it('a shape is the sum of its parts', () => {
    const shape: ShapePart[] = [
      { type: 'base', level: 0.2 },
      { type: 'ramp', from: 0, to: 1, height: 0.4 },
      { type: 'wobble', amplitude: 0.05, frequency: 3 },
    ];
    for (const t of [0, 0.3, 0.8]) {
      const sum = shape.reduce((total, part) => total + partValue(part, t), 0);
      expect(shapeValue(shape, t)).toBeCloseTo(sum, 14);
    }
    expect(
      shapeValue(
        [
          { type: 'base', level: 0.9 },
          { type: 'base', level: 0.9 },
        ],
        0,
      ),
    ).toBe(1.8);
  });

  it('tik, zwaar, vast, plant and bodem built from blocks equal the reference curves', () => {
    for (const [id, curve] of Object.entries(REFERENCE_CURVES)) {
      expect(maxDifference(exactShapes[id], curve), id).toBeLessThan(1e-12);
    }
  });

  it('the patterns of the fixture equal the reference curves', () => {
    const lesson = lessonJson as unknown as Lesson;
    const step = lesson.steps.find((candidate) => candidate.type === 'interaction');
    if (step?.type !== 'interaction' || step.interaction.kind !== 'trace-game') {
      throw new Error('no trace-game in the fixture');
    }
    const patterns = step.interaction.config.patterns;
    expect(patterns.map((pattern) => pattern.id).sort()).toEqual(
      Object.keys(REFERENCE_CURVES).sort(),
    );
    for (const pattern of patterns) {
      expect(maxDifference(pattern.shape, REFERENCE_CURVES[pattern.id]), pattern.id).toBeLessThan(
        1e-3,
      );
    }
  });
});
