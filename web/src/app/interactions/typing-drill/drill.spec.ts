import type { TypingKey } from '../../core/content/content.types';
import {
  drillDuration,
  drillResult,
  expectedChar,
  goalsMet,
  keysPerMinute,
  startDrill,
  topMistakes,
  typeChar,
  type DrillState,
} from './drill';

/** Types `text` one char at a time, `step` ms apart, starting at `start`. */
function typeText(state: DrillState, text: string, step = 100, start = 0): DrillState {
  let next = state;
  [...text].forEach((char, index) => {
    next = typeChar(next, char, start + index * step);
  });
  return next;
}

describe('typing drill logic', () => {
  it('a right char turns green and moves the cursor', () => {
    const state = typeChar(startDrill(['asdf']), 'a', 0);
    expect(state.marks[0]).toEqual(['correct', 'pending', 'pending', 'pending']);
    expect(state.position).toBe(1);
    expect(expectedChar(state)).toBe('s');
    expect(state.correct).toBe(1);
    expect(state.times).toEqual([0]);
  });

  it('a wrong char turns red, counts and still moves the cursor', () => {
    const state = typeChar(startDrill(['asdf']), 'x', 0);
    expect(state.marks[0]).toEqual(['wrong', 'pending', 'pending', 'pending']);
    expect(state.position).toBe(1);
    expect(state.correct).toBe(0);
    expect(state.times.length).toBe(1);
    expect(state.mistakes).toEqual({ a: 1 });
  });

  it('the last char of a line goes to the next line', () => {
    const state = typeText(startDrill(['as', 'df']), 'as');
    expect(state.line).toBe(1);
    expect(state.position).toBe(0);
    expect(expectedChar(state)).toBe('d');
    expect(state.finished).toBe(false);
  });

  it('the last char of the last line finishes the drill', () => {
    const state = typeText(startDrill(['as', 'd f']), 'asd f');
    expect(state.finished).toBe(true);
    expect(expectedChar(state)).toBeNull();
    expect(state.marks).toEqual([
      ['correct', 'correct'],
      ['correct', 'correct', 'correct'],
    ]);
  });

  it('chars after the end are ignored', () => {
    const finished = typeText(startDrill(['as']), 'as');
    const after = typeChar(finished, 'x', 500);
    expect(after).toBe(finished);
    expect(drillResult(after).total).toBe(2);
  });

  it('keys per minute count right keys from the first to the last key', () => {
    // 11 keys 200 ms apart: 2000 ms from the first to the last; 10 right.
    const state = typeText(startDrill(['asdf jkl;a']), 'asdf jkl;x', 200, 7000);
    expect(drillDuration(state.times)).toBe(1800);
    expect(state.correct).toBe(9);
    expect(keysPerMinute(state.correct, state.times)).toBe(300);
    const result = drillResult(state);
    expect(result.detail.keysPerMinute).toBe(300);
    expect(result.detail.durationMs).toBe(1800);
  });

  it('a pause counts at most 5 seconds', () => {
    expect(drillDuration([0, 1000, 61000, 62000])).toBe(7000);
    expect(keysPerMinute(4, [0, 1000, 61000, 62000])).toBe(34);
  });

  it('a drill of one key does not divide by zero', () => {
    expect(drillDuration([5000])).toBe(1000);
    expect(keysPerMinute(1, [5000])).toBe(60);
    expect(keysPerMinute(0, [])).toBe(0);
    const result = drillResult(typeChar(startDrill(['a']), 'a', 0));
    expect(result).toEqual({
      score: 1,
      total: 1,
      detail: { keysPerMinute: 60, durationMs: 1000, mistakes: [] },
    });
  });

  it('mistakes count the key that should have been pressed (A counts as a)', () => {
    const state = typeText(startDrill(['Aa ;:']), 'xxxxx');
    expect(state.mistakes).toEqual({ a: 2, space: 1, ';': 2 });
    expect(drillResult(state).detail.mistakes).toEqual([
      { key: ';', count: 2 },
      { key: 'a', count: 2 },
      { key: 'space', count: 1 },
    ]);
  });

  it('at most ten mistakes, most first', () => {
    const counts: Partial<Record<TypingKey, number>> = {
      a: 1,
      b: 2,
      c: 3,
      d: 4,
      e: 5,
      f: 6,
      g: 7,
      h: 8,
      i: 9,
      j: 10,
      k: 11,
      l: 12,
      m: 0,
    };
    const top = topMistakes(counts);
    expect(top.length).toBe(10);
    expect(top[0]).toEqual({ key: 'l', count: 12 });
    expect(top.map((item) => item.key)).toEqual(['l', 'k', 'j', 'i', 'h', 'g', 'f', 'e', 'd', 'c']);
    expect(topMistakes({ s: 2, a: 2, space: 2 }, 2)).toEqual([
      { key: 'a', count: 2 },
      { key: 's', count: 2 },
    ]);
  });

  it('the result has score, total and detail with keysPerMinute, durationMs and mistakes only', () => {
    const state = typeText(startDrill(['asdf', 'jkl;']), 'asdxjkl;', 250);
    const result = drillResult(state);
    expect(result.score).toBe(7);
    expect(result.total).toBe(8);
    expect(Object.keys(result).sort()).toEqual(['detail', 'score', 'total']);
    expect(Object.keys(result.detail).sort()).toEqual(['durationMs', 'keysPerMinute', 'mistakes']);
    expect(result.detail.mistakes).toEqual([{ key: 'f', count: 1 }]);
    // 7 gaps of 250 ms.
    expect(result.detail.durationMs).toBe(1750);
    expect(result.detail.keysPerMinute).toBe(240);
  });

  it('detail of 12 lines of 40 wrong chars stays under 4 kB', () => {
    const lines = Array.from({ length: 12 }, (_, index) =>
      `${'qwertyuiop'[index % 10]}${"asdfghjkl;'zxcvbnm,./1234567890-=[]\\`AB"}`.slice(0, 40),
    );
    let state = startDrill(lines);
    let time = 0;
    while (!state.finished) {
      state = typeChar(state, 'é', time);
      time += 100;
    }
    const result = drillResult(state);
    expect(result.total).toBe(480);
    expect(result.score).toBe(0);
    expect(result.detail.mistakes.length).toBe(10);
    expect(new TextEncoder().encode(JSON.stringify(result.detail)).length).toBeLessThan(4096);
  });

  it('detail never contains a typed char that was not expected', () => {
    const state = typeText(startDrill(['asdf jkl;']), 'éQ%~xZ$|?');
    const detail = JSON.stringify(drillResult(state).detail);
    for (const char of ['é', 'Q', '%', '~', 'x', 'Z', '$', '|', '?']) {
      expect(detail.includes(char), char).toBe(false);
    }
    expect(detail).not.toContain('asdf');
  });

  it('goals are met when every given goal is reached', () => {
    const goals = { accuracy: 90, keysPerMinute: 60 };
    expect(goalsMet({ accuracy: 90, keysPerMinute: 60 }, goals)).toBe(true);
    expect(goalsMet({ accuracy: 89, keysPerMinute: 200 }, goals)).toBe(false);
    expect(goalsMet({ accuracy: 100, keysPerMinute: 59 }, goals)).toBe(false);
    expect(goalsMet({ accuracy: 90, keysPerMinute: 0 }, { accuracy: 90 })).toBe(true);
    expect(goalsMet({ accuracy: 0, keysPerMinute: 61 }, { keysPerMinute: 60 })).toBe(true);
  });

  it('without goals nothing is required', () => {
    expect(goalsMet({ accuracy: 0, keysPerMinute: 0 }, undefined)).toBe(true);
  });
});
