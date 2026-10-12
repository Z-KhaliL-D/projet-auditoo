export function compareByRank(
  a: { rank: string; id: string },
  b: { rank: string; id: string },
): number {
  if (a.rank !== b.rank) return a.rank < b.rank ? -1 : 1;
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  return 0;
}
