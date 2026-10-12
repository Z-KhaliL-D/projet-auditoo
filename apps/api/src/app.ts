import { cursorSchema, pushRequestSchema } from "@auditoo/shared";
import { Hono } from "hono";
import type { Db } from "./db";
import { pullChanges } from "./sync/pull";
import { pushOps } from "./sync/push";

export function createApp(db: Db): Hono {
  const app = new Hono();

  app.get("/api/health", (c) => c.json({ ok: true }));

  app.post("/api/sync/push", async (c) => {
    const body = pushRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "invalid_request" }, 400);
    return c.json(pushOps(db, body.data.ops));
  });

  app.get("/api/sync/pull", (c) => {
    const since = cursorSchema.safeParse(Number(c.req.query("since") ?? 0));
    if (!since.success) return c.json({ error: "invalid_cursor" }, 400);
    return c.json(pullChanges(db, since.data));
  });

  return app;
}
