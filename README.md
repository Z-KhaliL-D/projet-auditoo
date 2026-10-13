# Auditoo

**Live app** https://projet-auditoo-production.up.railway.app/

An offline-first, mobile-first web app to manage the levels (floors) and spaces (rooms) of a building. It works without a network, queues every change on the device, and syncs with the server when the connection returns.

Architecture and decisions are in [DESIGN.md](DESIGN.md).

## Features

- Add, rename and delete levels and spaces, with undo.
- Drag to reorder spaces and levels, and to move a space into another level.
- Swipe left to delete.
- Works offline, installable as an app, with a status badge (Synced, Syncing, Offline, pending changes).
- Changes made on one device appear on the others.

## Try it

1. Open the live app on a phone, or in Chrome with device mode on.
2. Add a level, then a few spaces. Drag them by the handle, swipe one to the left to delete it.
3. In DevTools, Network tab, switch to Offline. Keep editing, then reload the page. The app still opens and your data is there.
4. Go back online. The badge turns to Synced.
5. Open the app in a private window. It acts as a second device and shows the same data within 30 seconds.

## Stack

| Area | Choice |
|---|---|
| Web | React 19, TypeScript, Vite, TanStack Router |
| UI | Tailwind v4, shadcn/ui, lucide, dnd-kit |
| Local data | Dexie (IndexedDB) |
| Offline | Serwist (service worker) |
| Server | Hono on Node, SQLite (better-sqlite3) |
| Shared | zod schemas in a shared package |
| Deploy | Docker on Railway, SQLite on a volume |

## Project layout

```
apps/web         the app (UI, local database, sync engine)
apps/api         the server (sync API, SQLite)
packages/shared  types and validation shared by both
```

## Run locally

```
npm install
npm run dev
```

The app runs at http://localhost:5173 and the API at http://localhost:3001.

## Tests

```
npm test
```

## Deployment

The server serves the built web app and the API from one URL. In production it needs a `DB_PATH` variable that points to a writable folder.

On Railway the SQLite file lives on a volume mounted at `/data`, with `DB_PATH=/data/auditoo.db`. The build uses the `Dockerfile` and `railway.json` at the repo root.

## Known limitations

- No authentication. Anyone with the URL can read and change the data, so the deployed app holds demo data only.
- One server instance, and no schema migrations.
- Conflicts are resolved with "last write wins".
- No screen yet to inspect operations the server refused.

See [DESIGN.md](DESIGN.md) for the full list.
