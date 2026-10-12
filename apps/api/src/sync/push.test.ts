import { describe, expect, it } from "vitest";
import { ops, setup, uuid } from "../test-utils";

describe("POST /api/sync/push", () => {
  it("applies ops in order and reports them as applied", async () => {
    const { push, pull } = setup();
    const [l, s] = [uuid(), uuid()];
    const batch = [ops.levelCreate(l, "Ground"), ops.spaceCreate(s, l, "Kitchen")];

    const res = await push(batch);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ applied: batch.map((o) => o.opId), skipped: [] });
    const data = await pull();
    expect(data.levels).toMatchObject([{ id: l, name: "Ground", deletedAt: null }]);
    expect(data.spaces).toMatchObject([{ id: s, levelId: l, name: "Kitchen" }]);
  });

  it("skips opIds already processed, including across requests", async () => {
    const { push, pull } = setup();
    const l = uuid();
    const create = ops.levelCreate(l, "A");
    const rename = ops.levelRename(l, "B");
    await push([create, rename]);
    await push([ops.levelRename(l, "C")]);

    const res = await push([rename]);

    expect(await res.json()).toEqual({ applied: [], skipped: [rename.opId] });
    expect((await pull()).levels[0].name).toBe("C");
  });

  it("skips a duplicate opId inside the same batch", async () => {
    const { push } = setup();
    const create = ops.levelCreate(uuid());
    const res = await push([create, create]);
    expect(await res.json()).toEqual({ applied: [create.opId], skipped: [create.opId] });
  });

  it("handles rename, move and delete", async () => {
    const { push, pull } = setup();
    const [l, s] = [uuid(), uuid()];
    const l2 = uuid();
    await push([ops.levelCreate(l), ops.levelCreate(l2, "L2", "a1"), ops.spaceCreate(s, l)]);

    await push([ops.levelRename(l, "New"), ops.levelMove(l, "a2"), ops.spaceRename(s, "Bath"), ops.spaceMove(s, l2, "b0")]);

    const data = await pull();
    expect(data.levels.find((x) => x.id === l)).toMatchObject({ name: "New", rank: "a2" });
    expect(data.spaces[0]).toMatchObject({ name: "Bath", levelId: l2, rank: "b0" });

    await push([ops.spaceDelete(s)]);
    expect((await pull()).spaces[0].deletedAt).not.toBeNull();
  });

  it("is idempotent for creates with an existing id", async () => {
    const { push, pull } = setup();
    const l = uuid();
    await push([ops.levelCreate(l, "First")]);
    await push([ops.levelCreate(l, "Second")]);
    expect((await pull()).levels).toMatchObject([{ name: "First" }]);
  });

  describe("deletes win over edits", () => {
    it("treats rename, move and delete on deleted targets as applied no-ops", async () => {
      const { push, pull } = setup();
      const [l, s] = [uuid(), uuid()];
      await push([ops.levelCreate(l, "Gone"), ops.spaceCreate(s, l, "Gone"), ops.levelDelete(l)]);
      const before = await pull();

      const edits = [
        ops.levelRename(l, "X"),
        ops.levelMove(l, "z"),
        ops.levelDelete(l),
        ops.spaceRename(s, "X"),
        ops.spaceMove(s, l, "z"),
        ops.spaceDelete(s),
      ];
      const res = await push(edits);

      expect(await res.json()).toEqual({ applied: edits.map((o) => o.opId), skipped: [] });
      expect(await pull()).toEqual(before);
    });

    it("treats ops on unknown targets as applied no-ops", async () => {
      const { push, pull } = setup();
      const edits = [ops.levelRename(uuid(), "X"), ops.spaceDelete(uuid())];
      const res = await push(edits);
      expect(await res.json()).toEqual({ applied: edits.map((o) => o.opId), skipped: [] });
      expect(await pull()).toMatchObject({ levels: [], spaces: [], cursor: 0 });
    });

    it("does not move a space into a deleted level", async () => {
      const { push, pull } = setup();
      const [a, b, s] = [uuid(), uuid(), uuid()];
      await push([ops.levelCreate(a), ops.levelCreate(b, "B", "a1"), ops.spaceCreate(s, a), ops.levelDelete(b)]);
      await push([ops.spaceMove(s, b, "z")]);
      expect((await pull()).spaces[0]).toMatchObject({ levelId: a, rank: "a0" });
    });
  });

  describe("level delete cascade", () => {
    it("soft-deletes the level and all its live spaces", async () => {
      const { push, pull } = setup();
      const [l, s1, s2] = [uuid(), uuid(), uuid()];
      await push([ops.levelCreate(l), ops.spaceCreate(s1, l), ops.spaceCreate(s2, l, "S2", "a1")]);
      const { cursor } = await pull();

      await push([ops.levelDelete(l)]);

      const changes = await pull(cursor);
      expect(changes.levels[0].deletedAt).not.toBeNull();
      expect(changes.spaces).toHaveLength(2);
      expect(changes.spaces.every((s) => s.deletedAt !== null)).toBe(true);
    });
  });

  describe("new data wins over deletes", () => {
    it("restores a deleted level on space.create and keeps its old spaces deleted", async () => {
      const { push, pull } = setup();
      const [l, old, fresh] = [uuid(), uuid(), uuid()];
      await push([ops.levelCreate(l), ops.spaceCreate(old, l), ops.levelDelete(l)]);

      await push([ops.spaceCreate(fresh, l, "Fresh")]);

      const data = await pull();
      expect(data.levels[0].deletedAt).toBeNull();
      expect(data.spaces.find((s) => s.id === old)?.deletedAt).not.toBeNull();
      expect(data.spaces.find((s) => s.id === fresh)).toMatchObject({ deletedAt: null, name: "Fresh" });
    });

    it("bumps the level seq on restore so other devices receive it", async () => {
      const { push, pull } = setup();
      const l = uuid();
      await push([ops.levelCreate(l), ops.levelDelete(l)]);
      const { cursor } = await pull();

      await push([ops.spaceCreate(uuid(), l)]);

      const changes = await pull(cursor);
      expect(changes.levels).toMatchObject([{ id: l, deletedAt: null }]);
    });

    it("ignores space.create under a level that never existed", async () => {
      const { push, pull } = setup();
      const create = ops.spaceCreate(uuid(), uuid());
      const res = await push([create]);
      expect(await res.json()).toEqual({ applied: [create.opId], skipped: [] });
      expect((await pull()).spaces).toEqual([]);
    });
  });

  describe("restore (undo)", () => {
    it("restores a deleted space", async () => {
      const { push, pull } = setup();
      const [l, s] = [uuid(), uuid()];
      await push([ops.levelCreate(l), ops.spaceCreate(s, l), ops.spaceDelete(s)]);
      const { cursor } = await pull();

      await push([ops.spaceRestore(s)]);

      expect((await pull(cursor)).spaces).toMatchObject([{ id: s, deletedAt: null }]);
    });

    it("restores a level with the spaces its delete cascaded to, not earlier deletes", async () => {
      const { push, pull } = setup();
      const [l, kept, gone] = [uuid(), uuid(), uuid()];
      // All in one batch, so a shared timestamp would wrongly bring `gone` back.
      await push([
        ops.levelCreate(l),
        ops.spaceCreate(kept, l),
        ops.spaceCreate(gone, l, "Gone", "a1"),
        ops.spaceDelete(gone),
        ops.levelDelete(l),
        ops.levelRestore(l),
      ]);

      const data = await pull();
      expect(data.levels[0].deletedAt).toBeNull();
      expect(data.spaces.find((s) => s.id === kept)?.deletedAt).toBeNull();
      expect(data.spaces.find((s) => s.id === gone)?.deletedAt).not.toBeNull();
    });

    it("bumps seq on every restored row so other devices receive them", async () => {
      const { push, pull } = setup();
      const [l, s] = [uuid(), uuid()];
      await push([ops.levelCreate(l), ops.spaceCreate(s, l), ops.levelDelete(l)]);
      const { cursor } = await pull();

      await push([ops.levelRestore(l)]);

      const changes = await pull(cursor);
      expect(changes.levels).toMatchObject([{ id: l, deletedAt: null }]);
      expect(changes.spaces).toMatchObject([{ id: s, deletedAt: null }]);
    });

    it("does not restore a space under a deleted level", async () => {
      const { push, pull } = setup();
      const [l, s] = [uuid(), uuid()];
      await push([ops.levelCreate(l), ops.spaceCreate(s, l), ops.spaceDelete(s), ops.levelDelete(l)]);
      await push([ops.spaceRestore(s)]);
      expect((await pull()).spaces[0].deletedAt).not.toBeNull();
    });

    it("treats restore of a live or unknown target as an applied no-op", async () => {
      const { push, pull } = setup();
      const [l, s] = [uuid(), uuid()];
      await push([ops.levelCreate(l), ops.spaceCreate(s, l)]);
      const before = await pull();

      const noops = [ops.levelRestore(l), ops.spaceRestore(s), ops.levelRestore(uuid()), ops.spaceRestore(uuid())];
      const res = await push(noops);

      expect(await res.json()).toEqual({ applied: noops.map((o) => o.opId), skipped: [] });
      expect(await pull()).toEqual(before);
    });
  });

  describe("invalid requests", () => {
    it("returns 400 and applies nothing when one op is invalid", async () => {
      const { push, pull } = setup();
      const res = await push([ops.levelCreate(uuid()), { type: "level.explode", payload: {} }]);
      expect(res.status).toBe(400);
      expect((await pull()).levels).toEqual([]);
    });

    it("returns 400 for a body that is not JSON", async () => {
      const { app } = setup();
      const res = await app.request("/api/sync/push", { method: "POST", body: "nope" });
      expect(res.status).toBe(400);
    });
  });
});
