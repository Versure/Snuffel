import type { ShapePart } from '../../core/content/content.types';

/** A bell curve with its top (1) at `at` and `width` as the standard deviation. */
export function gaussian(t: number, at: number, width: number): number {
  return Math.exp(-((t - at) ** 2) / (2 * width * width));
}

/**
 * A smooth step from 0 (at or before `from`) to 1 (at or after `to`): s · s · (3 − 2s). When
 * `to` is not after `from`, it is a sharp step at `from`.
 */
export function smoothstep(from: number, to: number, t: number): number {
  if (to <= from) return t >= from ? 1 : 0;
  const s = Math.min(1, Math.max(0, (t - from) / (to - from)));
  return s * s * (3 - 2 * s);
}

/** The value of one building block at time `t` (0-1). */
export function partValue(part: ShapePart, t: number): number {
  switch (part.type) {
    case 'base':
      return part.level;
    case 'pulse':
      return part.height * gaussian(t, part.at, part.width);
    case 'pulses': {
      let sum = 0;
      for (let k = 0; k < part.count; k += 1) {
        sum += part.height * gaussian(t, part.start + k * part.interval, part.width);
      }
      return sum;
    }
    case 'ramp':
      return part.height * smoothstep(part.from, part.to, t);
    case 'wobble': {
      const from = part.from ?? 0;
      const to = part.to ?? 1;
      if (t < from || t > to) return 0;
      const fadeIn = part.fadeIn ?? 0;
      const strength = fadeIn > 0 ? smoothstep(from, from + fadeIn, t) : 1;
      const phase = part.phase ?? 0;
      return strength * part.amplitude * Math.sin(2 * Math.PI * (part.frequency * t + phase));
    }
  }
}

/** The value of a whole shape at time `t`: the sum of its parts, not clamped. */
export function shapeValue(shape: readonly ShapePart[], t: number): number {
  let sum = 0;
  for (const part of shape) sum += partValue(part, t);
  return sum;
}
