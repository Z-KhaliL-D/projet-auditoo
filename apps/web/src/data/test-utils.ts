import { compareByRank } from "@auditoo/shared";
import { AuditooDb } from "./db";

export const testDb = () => new AuditooDb(`test-${crypto.randomUUID()}`);

export async function levelNames(db: AuditooDb): Promise<string[]> {
  const levels = await db.levels.filter((l) => l.deletedAt === null).toArray();
  return levels.sort(compareByRank).map((l) => l.name);
}

export async function spaceNames(db: AuditooDb, levelId: string): Promise<string[]> {
  const spaces = await db.spaces
    .where("levelId")
    .equals(levelId)
    .filter((s) => s.deletedAt === null)
    .toArray();
  return spaces.sort(compareByRank).map((s) => s.name);
}

export async function outboxTypes(db: AuditooDb): Promise<string[]> {
  return (await db.outbox.orderBy("key").toArray()).map((e) => e.op.type);
}
