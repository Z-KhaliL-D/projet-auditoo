import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "./app";
import { createDb } from "./db";

const root = mkdtempSync(join(tmpdir(), "auditoo-web-"));
const dist = join(root, "dist");
const BIG = `console.log(${JSON.stringify("x".repeat(4000))});`;

beforeAll(() => {
  mkdirSync(join(dist, "assets"), { recursive: true });
  mkdirSync(join(dist, "icons"));
  writeFileSync(join(dist, "index.html"), "<!doctype html><title>shell</title>");
  writeFileSync(join(dist, "sw.js"), BIG);
  writeFileSync(join(dist, "manifest.webmanifest"), '{"name":"Auditoo"}');
  writeFileSync(join(dist, "assets", "index-abc123.js"), BIG);
  writeFileSync(join(dist, "icons", "icon.svg"), "<svg xmlns='http://www.w3.org/2000/svg'/>");
  writeFileSync(join(dist, "icons", "icon-192.png"), Buffer.from([137, 80, 78, 71]));
  writeFileSync(join(root, "secret.txt"), "TOP SECRET");
});
afterAll(() => rmSync(root, { recursive: true, force: true }));

const app = () => createApp(createDb(":memory:"), { webDist: dist });
const get = (path: string, headers: Record<string, string> = {}) => app().request(path, { headers });

describe("cache headers", () => {
  it.each(["/", "/index.html", "/sw.js", "/manifest.webmanifest", "/icons/icon.svg", "/icons/icon-192.png"])(
    "%s must be revalidated, so a new version reaches users",
    async (path) => {
      const res = await get(path);
      expect(res.status).toBe(200);
      expect(res.headers.get("cache-control")).toBe("no-cache");
      expect(res.headers.get("etag")).toBeTruthy();
    },
  );

  it("caches hashed assets for a year and never revalidates them", async () => {
    const res = await get("/assets/index-abc123.js");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(res.headers.get("etag")).toBeNull();
  });

  it("answers a matching If-None-Match with a 304 that keeps no-cache", async () => {
    const first = await get("/sw.js");
    const second = await get("/sw.js", { "if-none-match": first.headers.get("etag")! });
    expect(second.status).toBe(304);
    expect(second.headers.get("cache-control")).toBe("no-cache");
  });

  it("never lets an API response be cached, with the web app mounted", async () => {
    for (const path of ["/api/health", "/api/sync/pull?since=0", "/api/unknown"]) {
      expect((await get(path)).headers.get("cache-control")).toBe("no-store");
    }
  });
});

describe("content types", () => {
  it("serves the manifest and the service worker with usable types", async () => {
    expect((await get("/manifest.webmanifest")).headers.get("content-type")).toMatch(/json/);
    expect((await get("/sw.js")).headers.get("content-type")).toMatch(/javascript/);
    expect((await get("/")).headers.get("content-type")).toMatch(/html/);
  });
});

describe("routing", () => {
  it("serves the app shell for client-side routes, revalidated", async () => {
    const res = await get("/levels/123");
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("shell");
    expect(res.headers.get("cache-control")).toBe("no-cache");
  });

  it("answers a missing file with 404, never with the shell", async () => {
    for (const path of ["/assets/missing-abc.js", "/missing.png", "/icons/nope.svg"]) {
      const res = await get(path);
      expect(res.status).toBe(404);
      expect(await res.text()).not.toContain("shell");
    }
  });

  it("answers an unknown API path with a JSON 404, never with the shell", async () => {
    for (const path of ["/api/unknown", "/api"]) {
      const res = await get(path);
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "not_found" });
    }
  });

  it("keeps the API working next to the web app", async () => {
    expect(await (await get("/api/health")).json()).toEqual({ ok: true });
    const pull = await (await get("/api/sync/pull?since=0")).json();
    expect(pull).toEqual({ levels: [], spaces: [], cursor: 0 });
  });

  it("does not serve files outside the web folder", async () => {
    for (const path of ["/../secret.txt", "/%2e%2e/secret.txt", "/..%2fsecret.txt", "/assets/../../secret.txt"]) {
      const res = await get(path);
      expect(await res.text()).not.toContain("TOP SECRET");
    }
  });

  it("answers HEAD requests", async () => {
    const res = await app().request("/sw.js", { method: "HEAD" });
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-cache");
  });
});

describe("compression", () => {
  it("compresses text files when the client accepts gzip", async () => {
    for (const path of ["/sw.js", "/assets/index-abc123.js"]) {
      const res = await get(path, { "accept-encoding": "gzip" });
      expect(res.headers.get("content-encoding")).toBe("gzip");
    }
  });

  it("does not compress when the client does not ask for it", async () => {
    expect((await get("/sw.js")).headers.get("content-encoding")).toBeNull();
  });

  it("leaves images alone", async () => {
    const res = await get("/icons/icon-192.png", { "accept-encoding": "gzip" });
    expect(res.headers.get("content-encoding")).toBeNull();
  });
});

describe("without a web build (development)", () => {
  it("serves only the API", async () => {
    const dev = createApp(createDb(":memory:"));
    expect((await dev.request("/")).status).toBe(404);
    expect((await dev.request("/api/health")).status).toBe(200);
  });
});

describe("health check", () => {
  it("returns 503 when the database cannot be read", async () => {
    const db = createDb(":memory:");
    const broken = createApp(db);
    db.close();
    const res = await broken.request("/api/health");
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false });
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});

