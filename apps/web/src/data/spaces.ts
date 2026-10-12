import { type Space, compareByRank, nameSchema } from "@auditoo/shared";
import type { AuditooDb } from "./db";
import { tick } from "./clock";
import { appendOp } from "./outbox";
import { rankAt } from "./ranking";

async function liveSpaces(db: AuditooDb, levelId: string, exceptId?: string): Promise<Space[]> {
  const spaces = await db.spaces
    .where("levelId")
    .equals(levelId)
    .filter((s) => s.deletedAt === null && s.id !== exceptId)
    .toArray();
  return spaces.sort(compareByRank);
}

async function isLiveLevel(db: AuditooDb, id: string): Promise<boolean> {
  const level = await db.levels.get(id);
  return level !== undefined && level.deletedAt === null;
}

export async function createSpace(
  db: AuditooDb,
  levelId: string,
  name: string,
  index?: number,
): Promise<Space | undefined> {
  const trimmed = nameSchema.parse(name);
  const now = tick();
  return db.transaction("rw", db.levels, db.spaces, db.outbox, async () => {
    if (!(await isLiveLevel(db, levelId))) return undefined;
    const rank = rankAt(await liveSpaces(db, levelId), index);
    const space: Space = { id: crypto.randomUUID(), levelId, name: trimmed, rank, updatedAt: now, deletedAt: null };
    await db.spaces.add(space);
    await appendOp(db, { type: "space.create", payload: { id: space.id, levelId, name: trimmed, rank } }, now);
    return space;
  });
}

export async function renameSpace(db: AuditooDb, id: string, name: string): Promise<void> {
  const trimmed = nameSchema.parse(name);
  const now = tick();
  await db.transaction("rw", db.spaces, db.outbox, async () => {
    const space = await db.spaces.get(id);
    if (!space || space.deletedAt !== null) return;
    await db.spaces.update(id, { name: trimmed, updatedAt: now });
    await appendOp(db, { type: "space.rename", payload: { id, name: trimmed } }, now);
  });
}

export async function moveSpace(
  db: AuditooDb,
  id: string,
  levelId: string,
  index: number,
): Promise<void> {
  const now = tick();
  await db.transaction("rw", db.levels, db.spaces, db.outbox, async () => {
    const space = await db.spaces.get(id);
    if (!space || space.deletedAt !== null || !(await isLiveLevel(db, levelId))) return;
    const rank = rankAt(await liveSpaces(db, levelId, id), index);
    await db.spaces.update(id, { levelId, rank, updatedAt: now });
    await appendOp(db, { type: "space.move", payload: { id, levelId, rank } }, now);
  });
}

export async function deleteSpace(db: AuditooDb, id: string): Promise<void> {
  const now = tick();
  await db.transaction("rw", db.spaces, db.outbox, async () => {
    const space = await db.spaces.get(id);
    if (!space || space.deletedAt !== null) return;
    await db.spaces.update(id, { deletedAt: now, updatedAt: now });
    await appendOp(db, { type: "space.delete", payload: { id } }, now);
  });
}

export async function restoreSpace(db: AuditooDb, id: string): Promise<void> {
  const now = tick();
  await db.transaction("rw", db.levels, db.spaces, db.outbox, async () => {
    const space = await db.spaces.get(id);
    if (!space || space.deletedAt === null || !(await isLiveLevel(db, space.levelId))) return;
    await db.spaces.update(id, { deletedAt: null, updatedAt: now });
    await appendOp(db, { type: "space.restore", payload: { id } }, now);
  });
}
