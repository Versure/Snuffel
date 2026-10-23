import type { RandomSource } from '../../core/random/random';
import { pick, shuffle } from '../../shared/quiz/shuffle';

/**
 * The patterns of one game, in order. Every pattern comes equally often (the rest of the rounds
 * goes to different, random patterns, so no pattern comes more than once more often than
 * another), the order is random, and the same pattern never comes twice in a row when that is
 * possible. With fewer rounds than patterns, every round has a different pattern.
 */
export function makeRounds(
  patternIds: readonly string[],
  rounds: number,
  random: RandomSource,
): string[] {
  if (patternIds.length === 0 || rounds <= 0) return [];
  const counts = new Map<string, number>();
  const each = Math.floor(rounds / patternIds.length);
  for (const id of patternIds) counts.set(id, each);
  for (const id of shuffle(patternIds, random).slice(0, rounds % patternIds.length)) {
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  const result: string[] = [];
  let previous: string | undefined;
  for (let left = rounds; left > 0; left -= 1) {
    const available = shuffle(patternIds, random).filter((id) => (counts.get(id) ?? 0) > 0);
    const fitting = available.filter((id) => id !== previous && canFollow(counts, id, left - 1));
    const next = pick(fitting, random) ?? pick(available, random);
    if (next === undefined) break;
    counts.set(next, (counts.get(next) ?? 0) - 1);
    result.push(next);
    previous = next;
  }
  return result;
}

/**
 * Whether the counts left after taking one `taken` (`left` items) can still be put in a row
 * without two equal neighbours and without starting with `taken`.
 */
function canFollow(counts: ReadonlyMap<string, number>, taken: string, left: number): boolean {
  for (const [id, count] of counts) {
    const rest = id === taken ? count - 1 : count;
    const limit = id === taken ? Math.floor(left / 2) : Math.ceil(left / 2);
    if (rest > limit) return false;
  }
  return true;
}
