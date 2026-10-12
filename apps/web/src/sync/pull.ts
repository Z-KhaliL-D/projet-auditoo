import type { Op, PullResponse } from "@auditoo/shared";
import type { AuditooDb } from "@/data/db";
import { getCursor, setCursor } from "@/data/meta";
import type { Transport } from "./http";

type Pending = { levels: Set<string>; spaces: Set<string>; cascadeLevels: Set<string> };

// A pending level.delete or level.restore also changed that level's spaces locally
// without ops of their own, so those spaces are protected too.
function pendingEntities(ops: Op[]): Pending {
  const pending: Pending = { levels: new Set(), spaces: new Set(), cascadeLevels: new Set() };
  for (const op of ops) {
    const { id } = op.payload;
    if (op.type.startsWith("level.")) {
      pending.levels.add(id);
      if (op.type === "level.delete" || op.type === "level.restore") pending.cascadeLevels.add(id);
    } else {
      pending.spaces.add(id);
    }
  }
  return pending;
}

// Everything happens in one transaction: the pending check sees the same outbox the
// writes do, and the cursor can never advance without its rows.
// Rows are copied exactly as the server sent them (restore matches cascades by deletedAt).
// If any row was skipped the cursor stays put, so the next pull fetches it again once
// its pending op is gone. Otherwise a skipped row whose op was a no-op on the server
// would never be delivered.
export function applyPull(db: AuditooDb, res: PullResponse): Promise<{ skipped: number }> {
  return db.transaction("rw", db.levels, db.spaces, db.outbox, db.meta, async () => {
    const pending = pendingEntities((await db.outbox.toArray()).map((e) => e.op));
    const levels = res.levels.filter((l) => !pending.levels.has(l.id));
    const spaces = res.spaces.filter((s) => !pending.spaces.has(s.id) && !pending.cascadeLevels.has(s.levelId));
    const skipped = res.levels.length - levels.length + (res.spaces.length - spaces.length);
    await db.levels.bulkPut(levels);
    await db.spaces.bulkPut(spaces);
    if (skipped === 0) await setCursor(db, res.cursor);
    return { skipped };
  });
}

export async function pullFromServer(db: AuditooDb, transport: Transport): Promise<void> {
  await applyPull(db, await transport.pull(await getCursor(db)));
}
