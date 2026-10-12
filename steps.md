# Steps

Log of each step: what was built, how it was verified, and the commit.

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
