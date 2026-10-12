# Steps

Log of each step: what was built, how it was verified, and the commit.

## Known limits (deferred by choice)

- No screen to inspect or retry rejected ops. The badge shows an error with the count, and the ops stay in the `rejected` table. Ops that depended on a rejected one reach the server as no-ops, so that data stays on this device only.
- A remote delete can remove a level while another device has its add input open, and the typed text is dropped.

## Step 1: Monorepo scaffold

- Commit: `chore: scaffold monorepo with web, api and shared workspaces`
- Built:
  - Root npm workspaces, `.gitignore`, scripts `dev` (concurrently) and `test`.
  - `apps/web`: Vite, React 19, strict TypeScript, TanStack Router (file-based), Tailwind v4, shadcn (base-nova). Route `/` shows "Auditoo".
  - `apps/api`: Hono on Node, better-sqlite3, `tsx watch`. `GET /api/health` returns `{ ok: true }`.
  - `packages/shared`: empty package exported as `@auditoo/shared`.
  - Vite proxies `/api` to the API on port 3001.
- Verified:
  - `npm run dev` starts web and api with labeled output.
  - `localhost:5173` shows "Auditoo".
  - `localhost:3001/api/health` and `localhost:5173/api/health` both return `{"ok":true}`.
  - `npm test` runs Vitest in every workspace and reports no test files.
  - `tsc --noEmit` passes for web and api.

## Step 2: Shared zod schemas

- Commit: `feat(shared): zod schemas for data model and sync ops`
- Built:
  - `Level`, `Space`, `Op` (discriminated union with nested `payload`), `PushRequest`, `PushResponse`, `PullResponse`, `cursorSchema`.
  - `compareByRank` sorts by rank then id with plain `<`.
  - `DECISIONS.md` created.
- Verified:
  - 27 Vitest tests pass in `packages/shared`.
  - `tsc --noEmit` passes.

## Step 3: Backend sync API

- Commit: `feat(api): sync push and pull endpoints with sqlite`
- Built:
  - SQLite tables `levels`, `spaces`, `processed_ops`, `meta` (global `seq` counter).
  - `POST /api/sync/push`: ordered ops in one transaction, skips processed opIds, 400 on an invalid body.
  - `GET /api/sync/pull?since=<cursor>`: changed rows including tombstones, plus the cursor.
  - Rules: deletes win over edits, new data wins over deletes, server cascades level deletes.
- Verified:
  - 22 Vitest tests pass in `apps/api`, run by the assistant and by the user.
  - `tsc --noEmit` passes.
  - Manual check against a real server: a push created a level and the pull returned it with cursor 1.
  - User replayed a push with the same opId through curl and it was skipped.

## Step 4: Local data layer (apps/web)

- Commit: `feat(web): dexie local data layer with outbox mutations`
- Built:
  - Dexie `AuditooDb` with `levels`, `spaces`, `outbox` (auto-increment key, `opId` indexed) and `meta` (pull cursor via `getCursor` and `setCursor`).
  - Mutations for all 8 op types in `data/levels.ts` and `data/spaces.ts`. Each one updates the local table and appends the op in one Dexie transaction.
  - `rankAt` in `data/ranking.ts` computes ranks from the target index with `generateKeyBetween`.
  - New dependencies: `dexie`, `fractional-indexing`. Dev-only: `fake-indexeddb`.
  - Test setup uses `vitest.config.ts` with `fake-indexeddb/auto`. Replaced `__dirname` with `import.meta.dirname` in both Vite configs to silence the native config loader warning.
- Verified:
  - 31 Vitest tests pass in `apps/web`: rank placement and ties, cursor, create and rename, move and delete for levels and spaces, no-ops on deleted targets, rollback when the outbox write fails, outbox order.
  - `tsc --noEmit` passes.

## Step 5a: Restore ops for undo

- Commit: `feat: restore ops for undo across shared, api and web`
- Built:
  - Shared: `level.restore` and `space.restore` ops.
  - API: restore handling in `applyOp`. Restoring a level revives only the spaces its delete cascaded to. Restoring a space under a deleted level is an applied no-op.
  - API: strictly increasing timestamps (`nextTimestamp`, `meta.ts`) so one push batch never gives two ops the same `deletedAt`.
  - Web data: `restoreLevel`, `restoreSpace`, and `tick()` in `data/clock.ts` for strictly increasing local timestamps.
- Verified:
  - Shared 29, API 27, web 36 Vitest tests pass.
  - `tsc --noEmit` passes in all three.
  - Same-batch case covered: a space deleted before its level in the same push stays deleted after the level restore.

## Step 5b: Main screen

- Commit: `feat(web): levels and spaces screen`
- Built:
  - `/` shows levels as collapsible sections with their spaces, read only through `useLiveQuery` (`useLevelTree`).
  - Inline add for spaces (stays open after Enter) and levels (fixed bottom button), in-place rename, row menu with Rename and Delete, delete with a 6 second Undo toast.
  - Empty states for no levels and for an empty level. Teal accent, neutral palette, dark mode follows the system.
  - 44px tap targets, safe-area insets, reserved empty slots for the header sync badge and the row drag handle.
  - New dependencies: `dexie-react-hooks`, `sonner` (via shadcn), shadcn `dropdown-menu` and `input`. Dev-only: `jsdom`, `@testing-library/react`, `@testing-library/user-event`.
- Verified:
  - 45 Vitest tests pass in `apps/web`, 9 of them component tests for add, rename, delete, undo and collapse.
  - `tsc --noEmit` and `vite build` pass.
  - Not yet checked by eye in a browser or on a phone.
- Bugs caught while testing:
  - Characters typed right after Enter while adding were wiped by a late state reset. The field now clears before the write starts.
  - Undo on a space toast would do nothing after its level was deleted, so those toasts are dismissed when the level is deleted.

## Step 6: Sync engine and status badge

- Commit: `feat(web): sync engine, status badge and periodic pull`
- Built:
  - `sync/http.ts`: transport with a 15 second timeout; network errors, timeouts and non-JSON 200s are `OfflineError`, other failures are `ServerError`.
  - `sync/push.ts`: sends the outbox in order in chunks of 100, removes ops only after the server lists them. A 400 isolates the bad op into the new `rejected` table (Dexie schema v2) and the rest continues.
  - `sync/pull.ts`: one transaction. Skips rows with pending ops (and the spaces of a level with a pending delete or restore), copies the rest exactly, advances the cursor only when nothing was skipped.
  - `sync/engine.ts`: triggers on start, `online`, focus, visibility, 1 second after the outbox grows, and a periodic pull every 30 seconds with jitter while the page is visible; one sync at a time; exponential backoff 2s to 60s with jitter; manual trigger bypasses the delay.
  - `SyncBadge` in the header: Synced, Syncing, N pending, Offline (with pending count), Sync error or N not accepted. Tapping it syncs now.
- Verified:
  - 107 Vitest tests pass in `apps/web`: transport, push, pull, engine (fake scheduler, including the periodic pull), badge state and view, and integration files with two devices on the real API app.
  - Integration cases: devices converge on identical rows, undo on another device matches the cascade through `deletedAt`, a pending rename survives a pull and the device still converges after the server deleted the level, a refused op is quarantined while the rest arrives, a lost response is re-sent without duplicates.
  - An idle device receives another device's change with no local action once the poll fires.
  - `tsc --noEmit` passes.
  - Not yet checked in a real browser with the dev servers.
- Known limits:
  - No UI to inspect or retry rejected ops yet. Ops that depend on a rejected op are accepted by the server as no-ops, so that data stays on this device only.
  - iOS has no Background Sync, so changes upload only while the app is open.
  - Focus and visibility can both fire on return to the app, costing one extra pass.
  - A remote delete can remove a level while another device has its add input open, dropping the typed text.
- For the deploy step:
  - If the server database is reset or lost, ops already pushed are not re-sent and the server cannot recover them. The SQLite file must live on a persistent volume.

## Step 7a: Reorder spaces inside a level

- Commit: `feat(web): drag to reorder spaces inside a level`
- Built:
  - One `DndContext` on the main screen with a sortable list per level, ready for levels (7b) and cross-level moves (7c).
  - `DragHandle`: 44px grip with `touch-action: none` and no text selection. It is the only element with drag listeners, so the row body scrolls normally and stays free for swipe-to-delete.
  - Instant drag after 4px, keyboard sensor for accessibility, `DragOverlay` preview with the source row dimmed.
  - `drop.ts`: pure `resolveSpaceDrop`, `applyMove` and `reflects`. A drop that changes nothing writes no op.
  - `useOptimisticMove`: shows the dropped order until Dexie reflects it, then hands over, so rows do not snap back.
  - Drops call the existing `moveSpace`, which computes the rank.
  - New dependencies: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`.
- Verified:
  - 125 Vitest tests pass in `apps/web`, including the drop logic, the optimistic hook and handle rendering.
  - `tsc --noEmit` and `vite build` pass.
  - Not yet checked by hand on a phone: drag feel, scrolling, edge auto-scroll.
