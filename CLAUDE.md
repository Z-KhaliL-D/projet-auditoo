# Auditoo: Levels & Spaces

Offline-first, mobile-first PWA for housing inspectors to describe a building's structure: levels (floors) and spaces (rooms). Used on-site, often without connectivity. Data must never be lost.

## Stack

| Area | Tools |
|---|---|
| Monorepo | npm workspaces: `apps/web`, `apps/api`, `packages/shared` |
| Web | Vite, React 19, TypeScript (strict), TanStack Router (file-based SPA), Tailwind CSS v4, shadcn/ui, lucide-react |
| Local data | Dexie (IndexedDB), `useLiveQuery` |
| Interactions | dnd-kit (drag and drop) |
| PWA | Serwist (`@serwist/vite`) |
| API | TypeScript, Hono on Node, better-sqlite3, zod |
| Ordering | `fractional-indexing` |
| Tests | Vitest |

Do not add or swap libraries without asking.

## Data model

- `Level`: id, name, rank, updatedAt, deletedAt
- `Space`: id, levelId, name, rank, updatedAt, deletedAt
- A space belongs to exactly one level.
- Lists are sorted by `(rank, id)`.
- Types and zod schemas live in `packages/shared` and are imported by both apps.

## Architecture rules

1. The UI reads only from Dexie. Components never fetch from the API.
2. Every mutation runs in one Dexie transaction: update the local table and append an op to `outbox`.
3. IDs are generated on the client with `crypto.randomUUID()`.
4. Deletes are soft (`deletedAt`). Deleting a level also deletes its spaces.
5. Ranks are generated with `generateKeyBetween(prev, next)`. Only the moved item changes.

## Sync

- `POST /api/sync/push`: batched ops, applied in order in one transaction, idempotent by `opId`.
- `GET /api/sync/pull?since=<seq>`: returns rows changed since the cursor and the new cursor.
- Outbox ops are removed only after a successful push.
- During pull, entities with pending outbox ops keep their local state.
- Triggers: `online` event, window focus, debounced after each mutation, retry with exponential backoff.
- A failed request means offline, regardless of `navigator.onLine`.
- Do not use the Background Sync API (unsupported on iOS Safari).
- UI status: offline, syncing, synced, pending count, error.

## Mobile UX

- Design for phones first (Chrome on Android and iOS).
- Tap targets at least 44px. Respect safe-area insets.
- Drag uses a handle only. Swipe-to-delete uses the row body. Neither may block scrolling.
- Deletes are immediate with an undo toast. No confirmation dialogs.

## Working rules

- Work in small steps. After each step, stop and explain how to test it.
- Explain non-obvious decisions in one or two sentences.
- Write Vitest tests for sync logic and API endpoints.
- Keep files small and focused. No dead code.
- Commits follow Conventional Commits (`feat:`, `fix:`, `chore:`, `test:`, `docs:`).
- Never use em dashes in code comments or docs.
- If a decision is ambiguous and hard to undo, ask for clarification before writing code. Do not assume. 
