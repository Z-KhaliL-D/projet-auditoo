import type { AuditooDb } from "./db";

const CURSOR_KEY = "cursor";

export async function getCursor(db: AuditooDb): Promise<number> {
  return (await db.meta.get(CURSOR_KEY))?.value ?? 0;
}

export async function setCursor(db: AuditooDb, cursor: number): Promise<void> {
  await db.meta.put({ key: CURSOR_KEY, value: cursor });
}
