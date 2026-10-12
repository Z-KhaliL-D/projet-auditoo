import { cursorSchema, pushRequestSchema } from "@auditoo/shared";
import { Hono } from "hono";
import { compress } from "hono/compress";
import type { Db } from "./db";
import { pullChanges } from "./sync/pull";
import { pushOps } from "./sync/push";
import { mountWeb } from "./web";

type Options = { webDist?: string | null };

export function createApp(db: Db, { webDist = null }: Options = {}): Hono {
  const app = new Hono();

  app.use("*", compress());

  // A cached sync answer could make a client drop outbox ops the server never received,
  // so no browser, proxy or CDN may keep any API response.
  app.use("/api/*", async (c, next) => {
    await next();
    c.header("Cache-Control", "no-store");
  });

  app.get("/api/health", (c) => {
    try {
      db.prepare("SELECT 1").get();
      return c.json({ ok: true });
    } catch {
      return c.json({ ok: false }, 503);
    }
  });

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

  if (webDist) mountWeb(app, webDist);

  app.notFound((c) =>
    c.req.path === "/api" || c.req.path.startsWith("/api/") ? c.json({ error: "not_found" }, 404) : c.text("Not found", 404),
  );

  return app;
}
