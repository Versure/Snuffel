// The accuracy of a typing drill, in a file without other imports: the lesson page and /ouder use
// it without loading the drill and its keyboard map.

/** Right as a percentage of all, rounded down: 100 only without mistakes. 0 without keys. */
export function accuracy(score: number, total: number): number {
  if (total <= 0) return 0;
  return Math.floor((score * 100) / total);
}
