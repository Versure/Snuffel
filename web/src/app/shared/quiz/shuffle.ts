import type { RandomSource } from '../../core/random/random';

/** A new list with the items of `list` in a random order (Fisher-Yates); `list` stays as it is. */
export function shuffle<T>(list: readonly T[], random: RandomSource): T[] {
  const result = [...list];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.min(index, Math.floor(random() * (index + 1)));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

/** One random item of `list`, or undefined for an empty list. */
export function pick<T>(list: readonly T[], random: RandomSource): T | undefined {
  if (list.length === 0) return undefined;
  return list[Math.min(list.length - 1, Math.floor(random() * list.length))];
}
