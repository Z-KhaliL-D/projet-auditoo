import { describe, expect, it } from "vitest";
import { ops, setup, uuid } from "../test-utils";

describe("GET /api/sync/pull", () => {
  it("returns an empty set and cursor 0 on a fresh database", async () => {
    const { pull } = setup();
    expect(await pull()).toEqual({ levels: [], spaces: [], cursor: 0 });
  });

  it("defaults since to 0 when omitted", async () => {
    const { app, push } = setup();
    await push([ops.levelCreate(uuid())]);
    const body = await (await app.request("/api/sync/pull")).json();
    expect(body.levels).toHaveLength(1);
  });

  it("returns only rows changed after the cursor", async () => {
    const { push, pull } = setup();
    const [a, b] = [uuid(), uuid()];
    await push([ops.levelCreate(a)]);
    const first = await pull();

    await push([ops.levelCreate(b, "B", "a1")]);

    const changes = await pull(first.cursor);
    expect(changes.levels.map((l) => l.id)).toEqual([b]);
    expect(changes.cursor).toBeGreaterThan(first.cursor);
  });

  it("returns nothing and a stable cursor when nothing changed", async () => {
    const { push, pull } = setup();
    await push([ops.levelCreate(uuid())]);
    const first = await pull();
    expect(await pull(first.cursor)).toEqual({ levels: [], spaces: [], cursor: first.cursor });
  });

  it("returns an edited row again", async () => {
    const { push, pull } = setup();
    const l = uuid();
    await push([ops.levelCreate(l, "A")]);
    const { cursor } = await pull();
    await push([ops.levelRename(l, "B")]);
    expect((await pull(cursor)).levels).toMatchObject([{ id: l, name: "B" }]);
  });

  it("includes soft-deleted rows as tombstones", async () => {
    const { push, pull } = setup();
    const l = uuid();
    await push([ops.levelCreate(l), ops.levelDelete(l)]);
    expect((await pull()).levels).toMatchObject([{ id: l, deletedAt: expect.any(Number) }]);
  });

  it("does not advance the cursor for no-op ops", async () => {
    const { push, pull } = setup();
    await push([ops.levelCreate(uuid())]);
    const { cursor } = await pull();
    await push([ops.levelRename(uuid(), "ghost")]);
    expect((await pull()).cursor).toBe(cursor);
  });

  it("returns 400 for an invalid cursor", async () => {
    const { app } = setup();
    for (const since of ["abc", "-1", "1.5"]) {
      const res = await app.request(`/api/sync/pull?since=${since}`);
      expect(res.status).toBe(400);
    }
  });
});
