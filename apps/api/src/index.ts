import type { Server } from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { ConfigError, resolveDbPath, resolveWebDist } from "./config";
import { createDb } from "./db";

const port = Number(process.env.PORT ?? 3001);
const here = dirname(fileURLToPath(import.meta.url));

let dbPath: string;
let webDist: string | null;
try {
  dbPath = resolveDbPath(process.env);
  webDist = resolveWebDist(process.env, resolve(here, "../../web/dist"));
} catch (error) {
  if (!(error instanceof ConfigError)) throw error;
  console.error(`Cannot start: ${error.message}`);
  process.exit(1);
}

const db = createDb(dbPath);
const server = serve({ fetch: createApp(db, { webDist }).fetch, port }, () => {
  console.log(`Listening on http://localhost:${port} (database ${dbPath}, web ${webDist ?? "served by Vite"})`);
}) as Server;

// A redeploy sends SIGTERM. Finish in-flight requests and close the database cleanly.
function shutdown(signal: string) {
  console.log(`${signal} received, shutting down`);
  server.close(() => {
    db.close();
    process.exit(0);
  });
  server.closeIdleConnections();
  setTimeout(() => process.exit(1), 8000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
