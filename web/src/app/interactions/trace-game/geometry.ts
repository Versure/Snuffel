// The drawing of the trace game, as in `tekenTot` and `zetHengel` of the reference lesson
// (docs/start/reference/les-01-roofvissen.html): a line from left to right with the pull on the
// line as its height, and a rod whose tip bends with the pull.
import type { ShapePart } from '../../core/content/content.types';
import { shapeValue } from './shape';

export const VIEW_BOX = '0 0 320 200';

/** The surface of the water; the line never goes below it. */
export const WATER_Y = 150;

/** Number of steps of the line (121 points). */
export const TRACE_SAMPLES = 120;

export interface Point {
  x: number;
  y: number;
}

/** The point of the line at time `t` with height `value`, kept between 0 and the water. */
export function tracePoint(t: number, value: number): Point {
  const y = Math.min(WATER_Y, Math.max(0, 140 - value * 110));
  return { x: 10 + t * 190, y };
}

/** The `points` of the line from time 0 up to `end`, with `samples + 1` points on 1 decimal. */
export function tracePoints(
  shape: readonly ShapePart[],
  end: number,
  samples = TRACE_SAMPLES,
): string {
  const points: string[] = [];
  for (let index = 0; index <= samples; index += 1) {
    const t = (index / samples) * end;
    const { x, y } = tracePoint(t, shapeValue(shape, t));
    points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return points.join(' ');
}

/** The tip of the rod (where the fishing line hangs) for pull `value`. */
export function lineTip(value: number): Point {
  return { x: 236 + value * 18, y: 40 + value * 70 };
}

/** The path of the rod for pull `value`: the harder the pull, the more the tip bends. */
export function rodPath(value: number): string {
  const tip = lineTip(value);
  const round = (n: number) => Number(n.toFixed(2));
  return `M310 196 Q${round(282 - value * 6)} ${round(120 + value * 10)} ${round(tip.x)} ${round(tip.y)}`;
}
