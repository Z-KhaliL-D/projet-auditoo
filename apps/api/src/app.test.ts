import { describe, expect, it } from "vitest";
import { ops, setup, uuid } from "./test-utils";

describe("API responses are never cacheable", () => {
  it("sends Cache-Control: no-store on health, push and pull", async () => {
    const { app, push } = setup();
    const health = await app.request("/api/health");
    const pushed = await push([ops.levelCreate(uuid())]);
    const pulled = await app.request("/api/sync/pull?since=0");

    for (const res of [health, pushed, pulled]) {
      expect(res.status).toBe(200);
      expect(res.headers.get("cache-control")).toBe("no-store");
    }
  });

  it("also covers error responses", async () => {
    const { app } = setup();
    const badPush = await app.request("/api/sync/push", { method: "POST", body: "nope" });
    const badPull = await app.request("/api/sync/pull?since=abc");

    expect(badPush.status).toBe(400);
    expect(badPush.headers.get("cache-control")).toBe("no-store");
    expect(badPull.status).toBe(400);
    expect(badPull.headers.get("cache-control")).toBe("no-store");
  });
});
