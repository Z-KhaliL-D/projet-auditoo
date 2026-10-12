let last = 0;

// Strictly increasing, so two mutations never share a timestamp. Restoring a
// level relies on this: it revives the spaces whose deletedAt equals its own.
export function tick(): number {
  last = Math.max(Date.now(), last + 1);
  return last;
}
