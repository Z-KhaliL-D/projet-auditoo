# DESIGN

Auditoo is an offline-first, mobile-first web application for housing inspectors. On site, the inspector describes the structure of a building: the levels (floors) and the spaces (rooms) inside each level. The application works with no connectivity and synchronizes automatically when the network returns.

## Constraints

- The application is used dozens of times a day, often in buildings with no connectivity.
- Data must never be lost.
- The interface must be fast to operate on a phone (Chrome on Android and iOS).
- The frontend stack is fixed: React 19, TypeScript, TanStack Router (single-page application), Tailwind CSS v4, shadcn/ui, lucide, Serwist, dnd-kit.
- Ordering must use fractional indexes.
- The backend is free to choose, with a minimal REST API.
- The live link must be testable by a reviewer without an account.

## Key features

- Add, rename and delete levels and spaces.
- Swipe left to delete, with undo.
- Drag to reorder spaces inside a level.
- Drag to reorder levels.
- Drag a space into another level.
- Every action works offline, through a local queue.
- Automatic synchronization when the connection returns.
- Visible offline indicator and synchronization status badge.
- Installable on the home screen, and opens offline, including after a reload.

## 1. Architecture overview

```
 PHONE (browser)                               SERVER (one Railway service)
┌───────────────────────────────┐            ┌──────────────────────────────┐
│ React UI                      │            │ Hono (Node, TypeScript)      │
│    │ reads (useLiveQuery)     │            │   POST /api/sync/push        │
│    ▼                          │            │   GET  /api/sync/pull        │
│ Dexie / IndexedDB             │   push     │   GET  /api/health           │
│   levels, spaces              │ ─────────► │   static web app (dist)      │
│   outbox, rejected, meta      │   pull     │        │                     │
│    ▲                          │ ◄───────── │        ▼                     │
│ Sync engine (background)      │            │ SQLite on a persistent volume│
│ Service worker (Serwist)      │            └──────────────────────────────┘
└───────────────────────────────┘
```

**Golden rule**
- The UI only reads and writes the local database.
- The UI never calls the API.
- Only the sync engine talks to the server, in the background.
- The network is an optimization, not a requirement.

**One action, end to end**
1. The user renames a space.
2. One Dexie transaction updates the row and appends a `space.rename` op to the outbox.
3. `useLiveQuery` re-renders instantly, with no network.
4. The sync engine sees the outbox grow, waits 1 second, then pushes.
5. The server applies the op once (idempotent by `opId`) and bumps a change counter.
6. The client removes the op from the outbox only after the server confirms it.
7. Other devices pull the change on their next cycle.

## 2. Packages

The repository is a monorepo with npm workspaces.

**`apps/web`**
- React 19 single-page application, the only thing the inspector sees.
- Owns the local database (Dexie) and the mutation functions.
- Runs the sync engine and the service worker.

**`apps/api`**
- Hono server on Node, with SQLite.
- Exposes the sync endpoints: push, pull and health.
- Serves the built web application, so the whole product lives on one origin.

**`packages/shared`**
- zod schemas and TypeScript types for levels, spaces, ops and sync messages.
- Imported by both applications, so client and server cannot drift.
- Contains `compareByRank`, the single sorting function.

## 3. Data model

Two entities. A space belongs to exactly one level. Types are defined once as zod schemas in `packages/shared` and imported by both apps.

### 3.1 Level

| Field | Type | Meaning |
|---|---|---|
| `id` | `string` (UUID) | Generated on the client with `crypto.randomUUID()` |
| `name` | `string` | Trimmed, 1 to 80 characters |
| `rank` | `string` | Fractional index, sorts the level among its siblings |
| `updatedAt` | `number` | Last change, in milliseconds |
| `deletedAt` | `number \| null` | Deletion time in milliseconds, `null` when the level is alive |

### 3.2 Space

Same fields as a level, plus:

| Field | Type | Meaning |
|---|---|---|
| `levelId` | `string` (UUID) | The level the space belongs to |

A space's `rank` orders it among the spaces of its own level.

### 3.3 Rules

- **IDs are created on the client.** Items can be created and referenced offline, and the server never remaps ids.
- **Deletes are soft.** `deletedAt` is set instead of removing the row, so deletions can be synchronized and undone.
- **Deleting a level** also marks its live spaces with the same `deletedAt`. Restoring the level brings back only the spaces with that exact value.
- **Ordering** uses fractional indexes. Moving an item changes one row only.
- **Sorting** is by `(rank, id)` with plain `<`, never `localeCompare`, because ranks order by character code. The id breaks ties.

### 3.4 Local storage (phone, Dexie / IndexedDB)

| Table | Contents | Key |
|---|---|---|
| `levels` | `Level` rows | `id` |
| `spaces` | `Space` rows | `id`, indexed on `levelId` |
| `outbox` | Pending ops, in the order they were made | auto-increment `key`, indexed on `opId` |
| `rejected` | Ops refused by the server (HTTP 400), kept and never deleted | auto-increment `key` |
| `meta` | Small values, such as the pull `cursor` (`number`) | `key` |

`deletedAt` is not indexed, because `null` is not a valid IndexedDB key. Soft-delete checks use filters.

### 3.5 Server storage (SQLite)

| Table | Contents |
|---|---|
| `levels` | Same fields as `Level`, plus `seq` (`integer`, the change number of the last write) |
| `spaces` | Same fields as `Space`, plus `seq` |
| `processed_ops` | `opId` of every op already applied, used for idempotency |
| `meta` | Two counters: the global `seq` and the last issued timestamp |

`seq` is a single global counter. Every row change takes the next number, so a client can ask for everything after its cursor.

## 4. Ops

- Every mutation is written as an op.
- An op has an envelope (`opId`, `createdAt`, `type`) and a nested typed `payload`.
- There are ten types: `level.create`, `level.rename`, `level.move`, `level.delete`, `level.restore`, and the same five for `space`.
- The sync engine reads only the envelope. Only the business logic reads the payload.
- The client validates every op with zod before it enters the outbox, so a server 400 is a safety net, not a normal path.
- Each mutation updates the local table and appends its op in one Dexie transaction. A change can never exist without its op.

## 5. Sync strategy

### 5.1 Push (client to server)

- Ops are sent in outbox order, using an auto-increment key and not the clock.
- Batches are at most 100 ops.
- The server applies a batch in one transaction.
- The server skips any `opId` already stored in `processed_ops`. This makes retries after a lost response safe (idempotency).
- An op leaves the outbox only after the server lists it as applied or skipped.
- On a 400, the client resends ops one at a time and moves refused ones to a `rejected` table. One bad op cannot block the others.

### 5.2 Pull (server to client)

- The server numbers every row change with a global `seq`.
- The client stores a `cursor` and asks for rows with `seq > cursor`.
- Soft-deleted rows are included, so deletions propagate.
- Rows with pending outbox ops are skipped, so unsent local work is never overwritten. This includes the spaces of a level with a pending delete or restore.
- All other rows are copied exactly as sent, including `deletedAt`. Undo depends on this.
- The cursor advances only when nothing was skipped. Otherwise a skipped row could be lost if the server ignored our pending op.
- Pull runs in one Dexie transaction.

### 5.3 Triggers and retries

- App start, `online` event, focus and visibility change.
- One second after the outbox grows (debounce).
- Every 30 seconds (±20% jitter) while the page is visible.
- Manual tap on the status badge.
- On failure, exponential backoff from 2s to 60s with jitter.
- Only one sync runs at a time.
- A thrown fetch, a 15 second timeout or a non-JSON 200 (captive portal) counts as offline. `navigator.onLine` is not trusted.

### 5.4 Status badge

- Priority is error, offline, syncing, pending, synced.
- Offline with pending ops shows "Offline · N".
- Tapping the badge runs a sync now.

### 5.5 Conflict rules

Last write wins per row, in server arrival order, using the server clock (phone clocks drift).

| Case | Rule |
|---|---|
| Rename, move or delete on a deleted target | No-op, reported as applied. Deletes win over edits. |
| `space.create` under a deleted level | The level is restored. New data wins over deletes. |
| `level.delete` | Server cascades to the level's live spaces, using the same timestamp. |
| `level.restore` | Restores the level and only the spaces with that same delete timestamp. |
| Two ops in one batch | Each gets a strictly increasing timestamp, so two separate deletes never look like one cascade. |
| Two devices create the same rank | Tie broken by id. Order is identical everywhere. |

## 6. Database choice

- SQLite (better-sqlite3) on a Railway volume.
- Zero operations work, transactional, and enough for this scope.
- The server refuses to start without `DB_PATH` pointing inside the volume, so data can never silently land on the temporary disk.
- `/api/health` checks the database and returns 503 if it fails.

## 7. Offline installable app setup

- Serwist (`@serwist/vite`) precaches every build file, so the app opens offline, including after a reload.
- Navigations fall back to the cached `index.html`.
- `/api` is never cached, in four layers: a network-only service worker route, `Cache-Control: no-store` on API responses, `cache: "no-store"` on sync requests, and no other runtime cache rule. A cached push answer would make the client delete ops the server never received.
- **Updates.** A new version waits instead of taking over. A toast "A new version is available" lets the user choose when to reload, so old and new hashed chunks never mix. The app checks for updates when it becomes visible, at most every 15 minutes.
- Standalone display mode, light and dark theme colors, maskable icon, iOS touch icon and meta tags.
- `navigator.storage.persist()` at startup, plus a dismissible banner in iOS Safari asking to install. Safari can erase IndexedDB after about 7 days for sites that are not installed.
- The service worker is production only.

## 8. UI and gestures

Mobile-first, teal accent on a neutral palette, dark mode follows the system.

- **Add and edit.** One tap on "Add space" opens an input that stays open after Enter. Rename in place from a 44px "⋮" menu.
- **Drag** uses dnd-kit with a handle only (`touch-action: none`), activated after 4px of movement. One `DndContext` covers reordering spaces, reordering levels and moving a space across levels. Drops call the existing move mutations, which compute the rank. A drop at the same position writes nothing.
- **Swipe to delete** is a small custom pointer-event state machine on the row body, with `touch-action: pan-y` so vertical scroll stays native. Axis lock after 10px, left swipe only. Spaces delete past 40% of the width or on a fast flick. Levels need 60% and no flick, because they take their spaces with them.
- **Undo** is a toast backed by real `restore` ops. Delete stays immediate.
- **Layout stability during drag.** Droppables are re-measured continuously, a ghost row keeps the source level's height, and levels fold during a level drag while the page compensates scroll.
- The optimistic order is kept in state until Dexie confirms the drop, which avoids a snap-back flicker.

## 9. Serving and deploy

- One Railway service built from a Dockerfile (Node 22).
- Hono serves the built web application and the API from one origin, so there is no CORS.
- `sw.js`, `index.html` and the manifest are `no-cache` with ETag. `/assets/*` is immutable.
- Unknown `/api/*` paths return a JSON 404, never the application shell.
- The image was built for linux/amd64 and tested locally with a volume, a restart and a recreated container before deploying.

## 10. Tradeoffs considered and rejected

| Rejected | Why |
|---|---|
| Integer positions (1, 2, 3) | A move renumbers many rows. Concurrent offline reorders collide and scramble the order. |
| Server-assigned ids | Impossible offline. Temporary ids would need remapping everywhere. |
| WebSockets or Server-Sent Events for live updates | Long-lived connections are fragile on mobile and iOS. A catch-up pull is still required, so polling is the foundation. Server-Sent Events could be added later as a "pull now" nudge. |
| Background Sync API | Not supported on iOS Safari. |
| Delaying the real delete until the toast closes | Delete would not be immediate, and killing the app loses the action. `restore` ops are cleaner. |
| Skipping pull while the outbox is non-empty | Can starve while the user keeps editing. |
| Last-write-wins by client `updatedAt` | Client clocks are unreliable. |
| Rejecting the whole push forever on one bad op | Would block the outbox. Quarantine instead. |
| Immediate service worker takeover | An open page would request chunks that no longer exist. |
| Railpack (zero-configuration build) | Cannot be tested locally and picks the Node version itself. Native `better-sqlite3` is a classic "works on my machine" risk. |
| Vercel or Render free tier | No persistent SQLite file on Vercel. Render free tier sleeps and wipes the disk. |
| Authentication | Not in the brief, and reviewers must test the link without an account. Listed as a known limit. |
| Playwright inside the project | Heavy dev tool. Drop logic is unit tested, the feel is checked by hand on a phone. |
| Gesture library for swipe | New dependency for a small state machine. |

## 11. Known limitations

- **No authentication.** Anyone with the URL can read and write all data. Use demo data only.
- **Rejected ops have no UI.** The badge shows "N not accepted", but there is no screen to inspect or retry them. Ops that depended on a rejected one reach the server as no-ops.
- **Typed text can be lost** if a remote delete removes the level you are typing in.
- **Single server instance.** SQLite on a volume does not support replicas. Deploys have a short downtime, which offline-first clients tolerate.
- **No server schema migrations.** The schema uses `CREATE TABLE IF NOT EXISTS`. Any schema change needs a real migration.
- **Restoring an old backup can lose data.** Clients drop ops once acknowledged and will not resend them.
- **Same-rank siblings** (two devices appending at once) can make a drop index look off for a moment. Order stays stable thanks to the id tiebreak.
- **Last write wins** is the only conflict resolution for field edits.
- **No pull paging.** Fine for one building, would need a `hasMore` flag at scale.
- **Updates are not instant.** Changes from another device arrive within about 30 seconds.
- **Multiple tabs** each run a sync engine. Idempotency makes this safe, at the cost of some duplicate work.
- **Placeholder icon**, a brief white splash in dark mode on Android, and no Content-Security-Policy header.
- **iOS** rendering (status bar style, install banner) cannot be verified in devtools.

## 12. Libraries and resources

- [React 19](https://react.dev), [TypeScript](https://www.typescriptlang.org), [Vite](https://vite.dev)
- [TanStack Router](https://tanstack.com/router/latest)
- [Tailwind CSS v4](https://tailwindcss.com), [shadcn/ui](https://ui.shadcn.com), [lucide](https://lucide.dev), [sonner](https://sonner.emilkowal.ski)
- [Dexie](https://dexie.org) and [dexie-react-hooks](https://dexie.org/docs/dexie-react-hooks/useLiveQuery())
- [dnd-kit](https://dndkit.com)
- [Serwist](https://serwist.pages.dev)
- [fractional-indexing](https://www.npmjs.com/package/fractional-indexing)
- [Hono](https://hono.dev), [better-sqlite3](https://github.com/WiseLibs/better-sqlite3), [zod](https://zod.dev)
- [Vitest](https://vitest.dev), [Testing Library](https://testing-library.com)
- [Railway](https://railway.com)

## 13. How AI was used

Built with Claude Code. `CLAUDE.md` holds the stack, the architecture rules and a decision protocol: before each step, the agent lists the decisions with options and a recommendation, and waits for my choice. Every decision is logged in `DECISIONS.md`.

Where I corrected the agent:
- It proposed a private repository and an authentication step. The brief asks for a public repository and a link testable without an account.
- It had no periodic pull. I found it by testing with two windows, and it was added.
- Layout shifts during drag were risky and untested. I asked for a fix before moving on.
- A single timestamp per push batch would have made undo restore the wrong spaces. It was caught and fixed with strictly increasing timestamps.
- I tested drag, swipe and offline behavior on a real phone, because automated tests cannot see touch problems.
