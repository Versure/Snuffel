// The curves of the trace game in the reference lesson, copied literally as a test oracle from
// docs/start/reference/les-01-roofvissen.html, lines 364-377 (`g`, `glad` and `SOORTEN`).
// Only used by the unit tests; the app builds its curves from the building blocks in shape.ts.

const g = (x: number, m: number, w: number) => Math.exp(-((x - m) ** 2) / (2 * w * w));
const glad = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export const REFERENCE_CURVES: Record<string, (t: number) => number> = {
  tik: (t) => 0.22 + 0.015 * Math.sin(t * 40) + 0.62 * g(t, 0.5, 0.012) + 0.32 * g(t, 0.57, 0.01),
  zwaar: (t) =>
    0.22 +
    glad(0.32, 0.4, t) *
      (0.42 + 0.17 * Math.sin(t * 55) * Math.sin(t * 13 + 1) + 0.05 * Math.sin(t * 90)),
  vast: (t) => 0.22 + 0.63 * glad(0.32, 0.42, t) + 0.004 * Math.sin(t * 30),
  plant: (t) => 0.22 + 0.42 * glad(0.25, 0.85, t) + 0.02 * Math.sin(t * 9),
  bodem: (t) => {
    let s = 0.28;
    for (let k = 0; k < 8; k++) s += 0.22 * g(t, 0.08 + k * 0.13, 0.01);
    return s;
  },
};

/** `tekenTot` of the reference: the points of the line up to `end`. */
export function referencePoints(f: (t: number) => number, end: number): string {
  const pts: string[] = [];
  for (let i = 0; i <= 120; i++) {
    const t = (i / 120) * end;
    pts.push((10 + t * 190).toFixed(1) + ',' + (140 - f(t) * 110).toFixed(1));
  }
  return pts.join(' ');
}

/** `zetHengel` of the reference: the rod path and the tip of the line for pull `s`. */
export function referenceRod(s: number): { d: string; tipX: number; tipY: number } {
  const tipX = 236 + s * 18;
  const tipY = 40 + s * 70;
  return { d: `M310 196 Q${282 - s * 6} ${120 + s * 10} ${tipX} ${tipY}`, tipX, tipY };
}
