import { createApp } from "../../../api/src/app";
import { createDb } from "../../../api/src/db";
import { testDb } from "@/data/test-utils";
import { createSyncEngine } from "./engine";
import { type Transport, httpTransport } from "./http";

// A real API app on an in-memory SQLite database, reached through the real transport.
export function server() {
  const app = createApp(createDb(":memory:"));
  const fetchFn = ((url: string, init?: RequestInit) => app.request(url, init)) as unknown as typeof fetch;
  return httpTransport(fetchFn);
}

export function device(transport: Transport) {
  const db = testDb();
  const engine = createSyncEngine({ db, transport, schedule: () => () => {} });
  return { db, sync: () => engine.trigger() };
}
