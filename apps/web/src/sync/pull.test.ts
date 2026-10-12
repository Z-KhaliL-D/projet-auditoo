import type { Level, Space } from "@auditoo/shared";
import { describe, expect, it } from "vitest";
import { getCursor, setCursor } from "@/data/meta";
import { createLevel, deleteLevel, renameLevel } from "@/data/levels";
import { createSpace, renameSpace } from "@/data/spaces";
import { testDb } from "@/data/test-utils";
import { applyPull } from "./pull";

const level = (over: Partial<Level> = {}): Level => ({
  id: crypto.randomUUID(),
  name: "Server",
  rank: "a0",
  updatedAt: 1_000,
  deletedAt: null,
  ...over,
});
const space = (levelId: string, over: Partial<Space> = {}): Space => ({ ...level(), levelId, ...over });

describe("applyPull", () => {
  it("copies rows exactly, including deletedAt, and advances the cursor", async () => {
    const db = testDb();
    const l = level({ deletedAt: 5_000, updatedAt: 5_000 });
    const s = space(l.id, { deletedAt: 5_000, updatedAt: 5_000 });

    const { skipped } = await applyPull(db, { levels: [l], spaces: [s], cursor: 9 });

    expect(skipped).toBe(0);
    expect(await db.levels.get(l.id)).toEqual(l);
    expect(await db.spaces.get(s.id)).toEqual(s);
    expect(await getCursor(db)).toBe(9);
  });

  it("overwrites a local row that has no pending op", async () => {
    const db = testDb();
    const local = await createLevel(db, "Local");
    await db.outbox.clear();

    await applyPull(db, { levels: [level({ id: local.id, name: "Server" })], spaces: [], cursor: 2 });

    expect((await db.levels.get(local.id))?.name).toBe("Server");
  });

  it("keeps rows with pending ops and does not advance the cursor", async () => {
    const db = testDb();
    const local = await createLevel(db, "Local");
    await renameLevel(db, local.id, "Mine");
    const other = level();
    await setCursor(db, 3);

    const { skipped } = await applyPull(db, {
      levels: [level({ id: local.id, name: "Theirs" }), other],
      spaces: [],
      cursor: 8,
    });

    expect(skipped).toBe(1);
    expect((await db.levels.get(local.id))?.name).toBe("Mine");
    expect(await db.levels.get(other.id)).toEqual(other);
    expect(await getCursor(db)).toBe(3);
  });

  it("protects a space with a pending op", async () => {
    const db = testDb();
    const l = await createLevel(db, "L");
    const s = (await createSpace(db, l.id, "Mine"))!;
    await db.outbox.clear();
    await renameSpace(db, s.id, "Mine 2");

    await applyPull(db, { levels: [], spaces: [space(l.id, { id: s.id, name: "Theirs" })], cursor: 4 });

    expect((await db.spaces.get(s.id))?.name).toBe("Mine 2");
  });

  it("protects the spaces of a level with a pending delete", async () => {
    const db = testDb();
    const l = await createLevel(db, "L");
    const s = (await createSpace(db, l.id, "S"))!;
    await db.outbox.clear();
    await deleteLevel(db, l.id);
    const localSpace = (await db.spaces.get(s.id))!;

    await applyPull(db, { levels: [], spaces: [space(l.id, { id: s.id, name: "Theirs" })], cursor: 6 });

    expect(await db.spaces.get(s.id)).toEqual(localSpace);
  });

  it("applies the skipped row on the next pull once its op is gone", async () => {
    const db = testDb();
    const local = await createLevel(db, "Local");
    const remote = level({ id: local.id, name: "Theirs", deletedAt: 7_000 });
    await applyPull(db, { levels: [remote], spaces: [], cursor: 5 });
    expect((await db.levels.get(local.id))?.deletedAt).toBeNull();

    await db.outbox.clear();
    await applyPull(db, { levels: [remote], spaces: [], cursor: 5 });

    expect(await db.levels.get(local.id)).toEqual(remote);
    expect(await getCursor(db)).toBe(5);
  });
});
