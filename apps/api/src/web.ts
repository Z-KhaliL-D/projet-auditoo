import { serveStatic } from "@hono/node-server/serve-static";
import type { Hono } from "hono";
import { etag } from "hono/etag";

const IMMUTABLE = "public, max-age=31536000, immutable";
const REVALIDATE = "no-cache";

// Hashed build output can be cached forever. Everything else, above all sw.js,
// index.html and the manifest, must be revalidated or a new version never reaches users.
const cacheControlFor = (path: string) => (path.startsWith("/assets/") ? IMMUTABLE : REVALIDATE);

const isApi = (path: string) => path === "/api" || path.startsWith("/api/");
const hasFileExtension = (path: string) => /\.[a-z0-9]+$/i.test(path);

export function mountWeb(app: Hono, webDist: string): void {
  // Runs once the response exists. Errors are never cacheable: a 404 for a missing hashed
  // asset must not be remembered for a year.
  app.use("*", async (c, next) => {
    await next();
    if (!isApi(c.req.path)) c.header("Cache-Control", c.res.status < 400 ? cacheControlFor(c.req.path) : "no-store");
  });

  // Revalidated files carry an ETag so "no-cache" costs a 304 instead of a download.
  const revalidate = etag();
  app.use("*", (c, next) => (isApi(c.req.path) || c.req.path.startsWith("/assets/") ? next() : revalidate(c, next)));

  app.use("*", serveStatic({ root: webDist }));

  // Client-side routes get the app shell. A missing file never does: answering a missing
  // hashed asset with HTML would hide a bad deploy behind a confusing script error.
  const shell = serveStatic({ root: webDist, path: "index.html" });
  app.get("*", async (c, next) => {
    if (isApi(c.req.path) || hasFileExtension(c.req.path)) return c.notFound();
    return (await shell(c, next)) ?? c.notFound();
  });
}
