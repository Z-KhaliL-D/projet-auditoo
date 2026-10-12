import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { build } from "vite";

// Builds the real app into a temporary folder and checks what the service worker will do,
// because this contract cannot fail loudly at runtime: a missing file means a broken start
// with no network, and an /api rule that went missing would mean cached sync answers.
const outDir = mkdtempSync(join(tmpdir(), "auditoo-build-"));
const previousEnv = process.env.NODE_ENV;
let sw = "";
let precached: string[] = [];

beforeAll(async () => {
  process.env.AUDITOO_OUT_DIR = outDir;
  // Under test runners NODE_ENV is "test", which makes Vite and the Serwist plugin skip the
  // manifest injection. A real build is a production build.
  process.env.NODE_ENV = "production";
  await build({ configFile: join(import.meta.dirname, "../vite.config.ts"), logLevel: "silent" });
  sw = readFileSync(join(outDir, "sw.js"), "utf8");
  const list = sw.match(/precacheEntries:\[(.*?)\]/s)?.[1] ?? "";
  precached = [...list.matchAll(/url:`([^`]+)`/g)].map((m) => m[1]);
}, 120_000);

afterAll(() => {
  delete process.env.AUDITOO_OUT_DIR;
  process.env.NODE_ENV = previousEnv;
  rmSync(outDir, { recursive: true, force: true });
});

describe("service worker build", () => {
  it("precaches the shell: page, scripts, styles, manifest and icons", () => {
    expect(precached).toContain("index.html");
    expect(precached).toContain("manifest.webmanifest");
    expect(precached.filter((f) => f.endsWith(".js")).length).toBeGreaterThanOrEqual(2);
    expect(precached.some((f) => f.endsWith(".css"))).toBe(true);
    for (const icon of ["icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png", "icon.svg"]) {
      expect(precached).toContain(`icons/${icon}`);
    }
  });

  it("keeps Latin and Latin-extended fonts and drops the Cyrillic and Vietnamese ones", () => {
    const fonts = precached.filter((f) => f.endsWith(".woff2"));
    expect(fonts.some((f) => f.includes("geist-latin-wght"))).toBe(true);
    expect(fonts.some((f) => f.includes("geist-latin-ext"))).toBe(true);
    expect(fonts.some((f) => /cyrillic|vietnamese/.test(f))).toBe(false);
  });

  it("does not precache the service worker itself or any source map", () => {
    expect(precached).not.toContain("sw.js");
    expect(precached.some((f) => f.endsWith(".map"))).toBe(false);
  });

  it("sends /api to the network only, for every method", () => {
    expect(sw).toContain("`/api/`");
    expect(sw).toContain("[`GET`,`POST`,`PUT`,`PATCH`,`DELETE`].map");
  });

  it("waits for the user instead of taking over, and still honors SKIP_WAITING", () => {
    expect(sw).toContain("SKIP_WAITING");
    expect(sw).not.toMatch(/skipWaiting:\s*!0|skipWaiting:\s*true/);
  });
});
