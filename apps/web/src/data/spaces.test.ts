import { opSchema } from "@auditoo/shared";
import { describe, expect, it, vi } from "vitest";
import { createLevel, deleteLevel } from "./levels";
import { createSpace, deleteSpace, moveSpace, renameSpace, restoreSpace } from "./spaces";
import { outboxTypes, spaceNames, testDb } from "./test-utils";

async function withLevel() {
  const db = testDb();
  const level = await createLevel(db, "L");
  return { db, level };
}

describe("createSpace", () => {
  it("adds the space and a valid space.create op", async () => {
    const { db, level } = await withLevel();
    const space = await createSpace(db, level.id, " Kitchen ");

    expect(space).toMatchObject({ levelId: level.id, name: "Kitchen", deletedAt: null });
    expect(await db.spaces.get(space!.id)).toEqual(space);
    const last = (await db.outbox.orderBy("key").last())!;
    expect(last.op).toMatchObject({ type: "space.create", payload: { id: space!.id, levelId: level.id } });
    expect(opSchema.safeParse(last.op).success).toBe(true);
  });

  it("appends at the end by default and inserts at an index", async () => {
    const { db, level } = await withLevel();
    await createSpace(db, level.id, "A");
    await createSpace(db, level.id, "C");
    await createSpace(db, level.id, "B", 1);
    expect(await spaceNames(db, level.id)).toEqual(["A", "B", "C"]);
  });

  it("is a no-op under a missing or deleted level", async () => {
    const { db, level } = await withLevel();
    await deleteLevel(db, level.id);
    const before = await db.outbox.count();

    expect(await createSpace(db, level.id, "S")).toBeUndefined();
    expect(await createSpace(db, crypto.randomUUID(), "S")).toBeUndefined();

    expect(await db.spaces.count()).toBe(0);
    expect(await db.outbox.count()).toBe(before);
  });

  it("rejects an invalid name without writing", async () => {
    const { db, level } = await withLevel();
    await expect(createSpace(db, level.id, " ")).rejects.toThrow();
    expect(await db.spaces.count()).toBe(0);
  });

  it("rolls back the space when the outbox write fails", async () => {
    const { db, level } = await withLevel();
    vi.spyOn(db.outbox, "add").mockRejectedValue(new Error("boom"));
    await expect(createSpace(db, level.id, "S")).rejects.toThrow("boom");
    expect(await db.spaces.count()).toBe(0);
  });
});

describe("renameSpace", () => {
  it("renames and appends space.rename", async () => {
    const { db, level } = await withLevel();
    const space = (await createSpace(db, level.id, "A"))!;
    await renameSpace(db, space.id, "B");
    expect((await db.spaces.get(space.id))?.name).toBe("B");
    expect((await outboxTypes(db)).at(-1)).toBe("space.rename");
  });

  it("is a no-op on a deleted space", async () => {
    const { db, level } = await withLevel();
    const space = (await createSpace(db, level.id, "A"))!;
    await deleteSpace(db, space.id);
    const before = await db.outbox.count();
    await renameSpace(db, space.id, "X");
    expect((await db.spaces.get(space.id))?.name).toBe("A");
    expect(await db.outbox.count()).toBe(before);
  });
});

describe("moveSpace", () => {
  it("reorders inside a level and changes only the moved space", async () => {
    const { db, level } = await withLevel();
    const a = (await createSpace(db, level.id, "A"))!;
    await createSpace(db, level.id, "B");
    const c = (await createSpace(db, level.id, "C"))!;

    await moveSpace(db, c.id, level.id, 0);

    expect(await spaceNames(db, level.id)).toEqual(["C", "A", "B"]);
    expect((await db.spaces.get(a.id))?.rank).toBe(a.rank);
  });

  it("moves to another level at an index", async () => {
    const { db, level } = await withLevel();
    const other = await createLevel(db, "M");
    const s = (await createSpace(db, level.id, "S"))!;
    await createSpace(db, other.id, "X");
    await createSpace(db, other.id, "Y");

    await moveSpace(db, s.id, other.id, 1);

    expect((await db.spaces.get(s.id))?.levelId).toBe(other.id);
    expect(await spaceNames(db, other.id)).toEqual(["X", "S", "Y"]);
    expect(await spaceNames(db, level.id)).toEqual([]);
    const last = (await db.outbox.orderBy("key").last())!;
    expect(last.op).toMatchObject({ type: "space.move", payload: { id: s.id, levelId: other.id } });
  });

  it("is a no-op into a deleted level or for a deleted space", async () => {
    const { db, level } = await withLevel();
    const other = await createLevel(db, "M");
    const s = (await createSpace(db, level.id, "S"))!;
    await deleteLevel(db, other.id);
    const before = await db.outbox.count();

    await moveSpace(db, s.id, other.id, 0);
    await deleteSpace(db, s.id);
    await moveSpace(db, s.id, level.id, 0);

    expect((await db.spaces.get(s.id))?.levelId).toBe(level.id);
    expect(await db.outbox.count()).toBe(before + 1);
  });
});

describe("deleteSpace", () => {
  it("soft-deletes and appends space.delete once", async () => {
    const { db, level } = await withLevel();
    const s = (await createSpace(db, level.id, "S"))!;
    await deleteSpace(db, s.id);
    await deleteSpace(db, s.id);
    expect((await db.spaces.get(s.id))?.deletedAt).not.toBeNull();
    expect((await outboxTypes(db)).filter((t) => t === "space.delete")).toHaveLength(1);
  });
});

describe("restoreSpace", () => {
  it("revives a deleted space and appends space.restore", async () => {
    const { db, level } = await withLevel();
    const s = (await createSpace(db, level.id, "S"))!;
    await deleteSpace(db, s.id);
    await restoreSpace(db, s.id);
    expect((await db.spaces.get(s.id))?.deletedAt).toBeNull();
    expect((await outboxTypes(db)).at(-1)).toBe("space.restore");
  });

  it("is a no-op for a live space, a missing space, or a deleted level", async () => {
    const { db, level } = await withLevel();
    const s = (await createSpace(db, level.id, "S"))!;
    await restoreSpace(db, s.id);
    await restoreSpace(db, crypto.randomUUID());
    await deleteSpace(db, s.id);
    await deleteLevel(db, level.id);
    const before = await db.outbox.count();

    await restoreSpace(db, s.id);

    expect((await db.spaces.get(s.id))?.deletedAt).not.toBeNull();
    expect(await db.outbox.count()).toBe(before);
  });
});
