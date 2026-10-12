import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { createDb } from "./db";

const port = Number(process.env.PORT ?? 3001);
const db = createDb(process.env.DB_PATH ?? "auditoo.db");

serve({ fetch: createApp(db).fetch, port }, () => {
  console.log(`API listening on http://localhost:${port}`);
});
