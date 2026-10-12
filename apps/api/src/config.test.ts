import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { ConfigError, resolveDbPath, resolveWebDist } from "./config";

const root = mkdtempSync(join(tmpdir(), "auditoo-config-"));
afterAll(() => {
  chmodSync(join(root, "readonly"), 0o755);
  rmSync(root, { recursive: true, force: true });
});

const volume = join(root, "volume");
mkdirSync(volume);
const readonly = join(root, "readonly");
mkdirSync(readonly);
chmodSync(readonly, 0o555);

describe("resolveDbPath", () => {
  it("falls back to a local file in development", () => {
    expect(resolveDbPath({})).toBe("auditoo.db");
    expect(resolveDbPath({ NODE_ENV: "development", DB_PATH: "x.db" })).toBe("x.db");
  });

  it("accepts a path inside an existing writable folder in production", () => {
    const path = join(volume, "auditoo.db");
    expect(resolveDbPath({ NODE_ENV: "production", DB_PATH: path })).toBe(path);
  });

  it("refuses to start in production without DB_PATH, instead of using the temporary disk", () => {
    expect(() => resolveDbPath({ NODE_ENV: "production" })).toThrow(ConfigError);
    expect(() => resolveDbPath({ NODE_ENV: "production", DB_PATH: "   " })).toThrow(/required/);
  });

  it("refuses to start when the volume folder is missing", () => {
    expect(() => resolveDbPath({ NODE_ENV: "production", DB_PATH: join(root, "no-volume", "auditoo.db") })).toThrow(
      /volume mounted/,
    );
  });

  it("refuses to start when the folder is a file", () => {
    const file = join(root, "a-file");
    writeFileSync(file, "x");
    expect(() => resolveDbPath({ NODE_ENV: "production", DB_PATH: join(file, "auditoo.db") })).toThrow(ConfigError);
  });

  it("refuses to start when the folder is not writable", () => {
    expect(() => resolveDbPath({ NODE_ENV: "production", DB_PATH: join(readonly, "auditoo.db") })).toThrow(
      /not writable/,
    );
  });
});

describe("resolveWebDist", () => {
  const dist = join(root, "dist");
  mkdirSync(dist);
  writeFileSync(join(dist, "index.html"), "<html></html>");

  it("uses WEB_DIST when it holds a build, otherwise the default folder", () => {
    expect(resolveWebDist({ WEB_DIST: dist }, join(root, "nowhere"))).toBe(dist);
    expect(resolveWebDist({}, dist)).toBe(dist);
  });

  it("is optional in development", () => {
    expect(resolveWebDist({}, join(root, "nowhere"))).toBeNull();
  });

  it("refuses to start in production without a web build", () => {
    expect(() => resolveWebDist({ NODE_ENV: "production" }, join(root, "nowhere"))).toThrow(/web build/);
  });
});
