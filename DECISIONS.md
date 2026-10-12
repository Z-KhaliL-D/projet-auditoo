# Decisions

- 2026-10-07: Run web and api together with `concurrently` (dev-only dependency). Reason: portable and gives labeled output, unlike shell `&`.
- 2026-10-07: Keep the shadcn `base-nova` style. Reason: the generated default is fine for now.
- 2026-10-07: Ops use an envelope (`opId`, `createdAt`, `type`) with a nested `payload`. Reason: keeps metadata separate from entity fields.
- 2026-10-07: Sort ranks with plain `<` in `compareByRank`, never `localeCompare`. Reason: `fractional-indexing` ranks are ordered by character code.
- 2026-10-07: `cursorSchema` is a non-negative integer used for the pull cursor. Reason: the cursor is a server sequence counter, not a timestamp.
