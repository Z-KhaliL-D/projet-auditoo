import { compareByRank } from "@auditoo/shared";
import { generateKeyBetween } from "fractional-indexing";

type Ranked = { id: string; rank: string };

// `siblings` must exclude the item being placed. `index` is its final position
// in the list (defaults to the end). Equal ranks can come from two devices
// appending at once, so `next` skips ties with `prev` to keep prev < next.
export function rankAt(siblings: Ranked[], index?: number): string {
  const sorted = [...siblings].sort(compareByRank);
  const at = Math.max(0, Math.min(index ?? sorted.length, sorted.length));
  const prev = sorted[at - 1]?.rank ?? null;
  const next = sorted.slice(at).find((s) => prev === null || s.rank > prev)?.rank ?? null;
  return generateKeyBetween(prev, next);
}
