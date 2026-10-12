import { opSchema } from "@auditoo/shared";
import { describe, expect, it, vi } from "vitest";
import { createLevel, deleteLevel, moveLevel, renameLevel, restoreLevel } from "./levels";
import { createSpace, deleteSpace } from "./spaces";
import { levelNames, outboxTypes, testDb } from "./test-utils";

describe("createLevel", () => {
  it("adds the level and a level.create op in one go", async () => {
    const db = testDb();
    const level = await createLevel(db, "  Ground  ");

    expect(level).toMatchObject({ name: "Ground", deletedAt: null });
    expect(await db.levels.get(level.id)).toEqual(level);
    const [entry] = await db.outbox.toArray();
    expect(entry.op).toMatchObject({
      type: "level.create",
      payload: { id: level.id, name: "Ground", rank: level.rank },
    });
    expect(opSchema.safeParse(entry.op).success).toBe(true);
    expect(entry.opId).toBe(entry.op.opId);
  });

  it("appends at the end by default and inserts at an index", async () => {
    const db = testDb();
    await createLevel(db, "A");
    await createLevel(db, "C");
    await createLevel(db, "B", 1);
    await createLevel(db, "First", 0);
    expect(await levelNames(db)).toEqual(["First", "A", "B", "C"]);
  });

  it("rejects an invalid name and writes nothing", async () => {
    const db = testDb();
    await expect(createLevel(db, "   ")).rejects.toThrow();
    await expect(createLevel(db, "x".repeat(81))).rejects.toThrow();
    expect(await db.levels.count()).toBe(0);
    expect(await db.outbox.count()).toBe(0);
  });

  it("rolls back the level when the outbox write fails", async () => {
    const db = testDb();
    vi.spyOn(db.outbox, "add").mockRejectedValue(new Error("boom"));
    await expect(createLevel(db, "A")).rejects.toThrow("boom");
    expect(await db.levels.count()).toBe(0);
  });
});

describe("renameLevel", () => {
  it("renames and appends level.rename", async () => {
    const db = testDb();
    const { id } = await createLevel(db, "A");
    await renameLevel(db, id, " B ");
    expect((await db.levels.get(id))?.name).toBe("B");
    expect(await outboxTypes(db)).toEqual(["level.create", "level.rename"]);
  });

  it("is a no-op on a missing or deleted level", async () => {
    const db = testDb();
    const { id } = await createLevel(db, "A");
    await deleteLevel(db, id);
    const before = await db.outbox.count();

    await renameLevel(db, id, "X");
    await renameLevel(db, crypto.randomUUID(), "X");

    expect((await db.levels.get(id))?.name).toBe("A");
    expect(await db.outbox.count()).toBe(before);
  });

  it("rejects an invalid name without writing", async () => {
    const db = testDb();
    const { id } = await createLevel(db, "A");
    await expect(renameLevel(db, id, "")).rejects.toThrow();
    expect(await outboxTypes(db)).toEqual(["level.create"]);
  });
});

describe("moveLevel", () => {
  it("reorders and changes only the moved level", async () => {
    const db = testDb();
    const a = await createLevel(db, "A");
    const b = await createLevel(db, "B");
    const c = await createLevel(db, "C");

    await moveLevel(db, c.id, 0);
    expect(await levelNames(db)).toEqual(["C", "A", "B"]);
    expect((await db.levels.get(a.id))?.rank).toBe(a.rank);
    expect((await db.levels.get(b.id))?.rank).toBe(b.rank);

    await moveLevel(db, c.id, 2);
    expect(await levelNames(db)).toEqual(["A", "B", "C"]);
    expect(await outboxTypes(db)).toEqual([...Array(3).fill("level.create"), "level.move", "level.move"]);
  });

  it("is a no-op on a deleted level", async () => {
    const db = testDb();
    const { id } = await createLevel(db, "A");
    await deleteLevel(db, id);
    const before = await db.outbox.count();
    await moveLevel(db, id, 0);
    expect(await db.outbox.count()).toBe(before);
  });
});

describe("deleteLevel", () => {
  it("soft-deletes the level and its spaces with a single op", async () => {
    const db = testDb();
    const level = await createLevel(db, "A");
    const space = await createSpace(db, level.id, "S");
    const other = await createLevel(db, "B");
    const otherSpace = await createSpace(db, other.id, "T");

    await deleteLevel(db, level.id);

    expect((await db.levels.get(level.id))?.deletedAt).not.toBeNull();
    expect((await db.spaces.get(space!.id))?.deletedAt).not.toBeNull();
    expect((await db.levels.get(other.id))?.deletedAt).toBeNull();
    expect((await db.spaces.get(otherSpace!.id))?.deletedAt).toBeNull();
    const types = await outboxTypes(db);
    expect(types.filter((t) => t.endsWith(".delete"))).toEqual(["level.delete"]);
  });

  it("is a no-op when already deleted", async () => {
    const db = testDb();
    const { id } = await createLevel(db, "A");
    await deleteLevel(db, id);
    await deleteLevel(db, id);
    expect((await outboxTypes(db)).filter((t) => t === "level.delete")).toHaveLength(1);
  });
});

describe("restoreLevel", () => {
  it("revives the level and the spaces its delete cascaded to, with one op", async () => {
    const db = testDb();
    const level = await createLevel(db, "A");
    const kept = (await createSpace(db, level.id, "Kept"))!;
    const gone = (await createSpace(db, level.id, "Gone"))!;
    await deleteSpace(db, gone.id);
    await deleteLevel(db, level.id);

    await restoreLevel(db, level.id);

    expect((await db.levels.get(level.id))?.deletedAt).toBeNull();
    expect((await db.spaces.get(kept.id))?.deletedAt).toBeNull();
    expect((await db.spaces.get(gone.id))?.deletedAt).not.toBeNull();
    const types = await outboxTypes(db);
    expect(types.filter((t) => t.endsWith(".restore"))).toEqual(["level.restore"]);
  });

  it("is a no-op on a live or missing level", async () => {
    const db = testDb();
    const { id } = await createLevel(db, "A");
    const before = await db.outbox.count();
    await restoreLevel(db, id);
    await restoreLevel(db, crypto.randomUUID());
    expect(await db.outbox.count()).toBe(before);
  });
});

describe("outbox ordering", () => {
  it("keeps ops in mutation order", async () => {
    const db = testDb();
    const { id } = await createLevel(db, "A");
    await renameLevel(db, id, "B");
    await createLevel(db, "C");
    await deleteLevel(db, id);
    expect(await outboxTypes(db)).toEqual(["level.create", "level.rename", "level.create", "level.delete"]);
  });
});
