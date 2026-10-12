# Steps

Log of each step: what was built, how it was verified, and the commit.

## Step 1: Monorepo scaffold

- Commit: `ab3f89e chore: scaffold monorepo with web, api and shared workspaces`
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

- Commit: `1eede15 feat(shared): zod schemas for data model and sync ops`
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
