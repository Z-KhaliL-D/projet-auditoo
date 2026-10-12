# Decisions

- 2026-10-07: Run web and api together with `concurrently` (dev-only dependency). Reason: portable and gives labeled output, unlike shell `&`.
- 2026-10-07: Keep the shadcn `base-nova` style. Reason: the generated default is fine for now.
- 2026-10-07: Ops use an envelope (`opId`, `createdAt`, `type`) with a nested `payload`. Reason: keeps metadata separate from entity fields.
- 2026-10-07: Sort ranks with plain `<` in `compareByRank`, never `localeCompare`. Reason: `fractional-indexing` ranks are ordered by character code.
- 2026-10-07: `cursorSchema` is a non-negative integer used for the pull cursor. Reason: the cursor is a server sequence counter, not a timestamp.
- 2026-10-07: The pull cursor is one global server counter (`meta.seq`). Every row write stores the new value in the row's `seq`. Reason: one number matches `cursorSchema` and `rowid` does not change on update.
- 2026-10-07: Deletes win over edits: rename, move or delete on a missing or deleted target is a no-op reported as applied. Reason: the client can clear its outbox and the delete is never undone by a stale edit.
- 2026-10-07: New data wins over deletes: `space.create` under a deleted level restores the level (deletedAt = null, seq bumped) and its old spaces stay deleted. Reason: new data entered on site must never be lost.
- 2026-10-07: `updatedAt` is the server clock at apply time, and conflicts resolve by arrival order. Reason: phone clocks drift.
- 2026-10-07: The server cascades `level.delete` to the level's live spaces. Reason: a space created on another device would otherwise stay alive under a deleted level.
- 2026-10-07: An invalid push body returns 400 and applies nothing, and a DB error rolls back the whole batch. The client must handle a 400 (drop or quarantine the offending op) so one bad op can never block the outbox forever. Reason: all-or-nothing batches avoid silent partial data loss.
- 2026-10-07: Pull has no size limit for now. Reason: inspection data is small and paging would change `PullResponse`.
