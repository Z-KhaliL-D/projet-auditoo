# Auditoo: Levels & Spaces

Offline-first, mobile-first PWA for housing inspectors to describe a building's structure: levels (floors) and spaces (rooms). Used on-site, often without connectivity. Data must never be lost.

## Stack

| Area | Tools |
|---|---|
| Monorepo | npm workspaces: `apps/web`, `apps/api`, `packages/shared` |
| Web | Vite, React 19, TypeScript (strict), TanStack Router (file-based SPA), Tailwind CSS v4, shadcn/ui (base-nova), lucide-react |
| Local data | Dexie (IndexedDB), `useLiveQuery` |
| Interactions | dnd-kit (drag and drop) |
| PWA | Serwist (`@serwist/vite`) |
| API | TypeScript, Hono on Node, better-sqlite3 |
| Validation | zod (schemas in `packages/shared`) |
| Ordering | `fractional-indexing` |
| Tests | Vitest |
| Dev tooling | concurrently |

- Do not add or swap app libraries without asking.
- Dev-only tooling (type definitions, test helpers) is allowed; mention it when added.

## Data model

- `Level`: id, name, rank, updatedAt, deletedAt
- `Space`: id, levelId, name, rank, updatedAt, deletedAt
- A space belongs to exactly one level.
- Lists are sorted by `(rank, id)` using `compareByRank` (plain `<`, never `localeCompare`).
- Ops have an envelope (`opId`, `createdAt`, `type`) and a nested `payload`.
- Types and zod schemas live in `packages/shared` and are imported by both apps.

## Architecture rules

1. The UI reads only from Dexie. Components never fetch from the API.
2. Every mutation runs in one Dexie transaction: update the local table and append an op to `outbox`.
3. IDs are generated on the client with `crypto.randomUUID()`.
4. Deletes are soft (`deletedAt`). Deleting a level also deletes its spaces.
5. Ranks are generated with `generateKeyBetween(prev, next)`. Only the moved item changes.

## Sync

- `POST /api/sync/push`: batched ops, applied in order in one transaction, idempotent by `opId`.
- `GET /api/sync/pull?since=<cursor>`: returns rows changed since the cursor and the new cursor. The cursor is a server sequence number, not a timestamp.
- Outbox ops are removed only after a successful push.
- During pull, entities with pending outbox ops keep their local state.
- Triggers: `online` event, window focus, debounced after each mutation, periodic pull (about every 30 seconds with jitter, only while the page is visible), retry with exponential backoff.
- A failed request means offline, regardless of `navigator.onLine`.
- Do not use the Background Sync API (unsupported on iOS Safari).
- UI status: offline, syncing, synced, pending count, error.

## PWA

- The service worker precaches the app shell and never touches `/api`: no caching of any API request or response, for any method.
- A new version never takes over by itself. The user chooses when to reload.
- API and shared schema changes stay backward compatible with the previous client version.
- Test the service worker with a production build, not in dev.

## Mobile UX

- Design for phones first (Chrome on Android and iOS).
- Tap targets at least 44px. Respect safe-area insets.
- Drag uses a handle only. Swipe-to-delete uses the row body. Neither may block scrolling.
- Deletes are immediate with an undo toast. No confirmation dialogs.

## Decision protocol

I own the architecture and design decisions. You implement.

- Before implementing a step, list the decisions it involves that are not already fixed in this file.
- For each decision: give 2 or 3 options, the tradeoffs in one line each, and your recommendation.
- Wait for my choice before writing code.
- Trivial choices (naming, file layout inside a folder) do not need a decision; state them in the summary.
- Record each decision I make in `DECISIONS.md`: the date, the decision, and the reason, one line each.

## Working rules

- Work in small steps. After each step, stop and explain how to test it.
- Explain non-obvious decisions in one or two sentences.
- Write Vitest tests for sync logic and API endpoints.
- Keep files small and focused. No dead code.
- Never commit until I say so.
- Never amend commits. Fix mistakes with a new commit.
- Do not write commit hashes in `steps.md` or any other doc. Git history is the record.
- Commits follow Conventional Commits (`feat:`, `fix:`, `chore:`, `test:`, `docs:`). No co-author lines.
- Never use em dashes in code comments or docs.
