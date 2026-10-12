import { type Level, compareByRank, nameSchema } from "@auditoo/shared";
import type { AuditooDb } from "./db";
import { appendOp } from "./outbox";
import { rankAt } from "./ranking";

async function liveLevels(db: AuditooDb, exceptId?: string): Promise<Level[]> {
  const levels = await db.levels
    .filter((l) => l.deletedAt === null && l.id !== exceptId)
    .toArray();
  return levels.sort(compareByRank);
}

export async function createLevel(db: AuditooDb, name: string, index?: number): Promise<Level> {
  const trimmed = nameSchema.parse(name);
  const now = Date.now();
  return db.transaction("rw", db.levels, db.outbox, async () => {
    const rank = rankAt(await liveLevels(db), index);
    const level: Level = { id: crypto.randomUUID(), name: trimmed, rank, updatedAt: now, deletedAt: null };
    await db.levels.add(level);
    await appendOp(db, { type: "level.create", payload: { id: level.id, name: trimmed, rank } }, now);
    return level;
  });
}

export async function renameLevel(db: AuditooDb, id: string, name: string): Promise<void> {
  const trimmed = nameSchema.parse(name);
  const now = Date.now();
  await db.transaction("rw", db.levels, db.outbox, async () => {
    const level = await db.levels.get(id);
    if (!level || level.deletedAt !== null) return;
    await db.levels.update(id, { name: trimmed, updatedAt: now });
    await appendOp(db, { type: "level.rename", payload: { id, name: trimmed } }, now);
  });
}

export async function moveLevel(db: AuditooDb, id: string, index: number): Promise<void> {
  const now = Date.now();
  await db.transaction("rw", db.levels, db.outbox, async () => {
    const level = await db.levels.get(id);
    if (!level || level.deletedAt !== null) return;
    const rank = rankAt(await liveLevels(db, id), index);
    await db.levels.update(id, { rank, updatedAt: now });
    await appendOp(db, { type: "level.move", payload: { id, rank } }, now);
  });
}

// One op only: the server cascades to the spaces, the local copy cascades here.
export async function deleteLevel(db: AuditooDb, id: string): Promise<void> {
  const now = Date.now();
  await db.transaction("rw", db.levels, db.spaces, db.outbox, async () => {
    const level = await db.levels.get(id);
    if (!level || level.deletedAt !== null) return;
    await db.levels.update(id, { deletedAt: now, updatedAt: now });
    await db.spaces
      .where("levelId")
      .equals(id)
      .filter((s) => s.deletedAt === null)
      .modify({ deletedAt: now, updatedAt: now });
    await appendOp(db, { type: "level.delete", payload: { id } }, now);
  });
}
