import type { Op, PushResponse } from "@auditoo/shared";
import { type Db, nextTimestamp } from "../db";
import { applyOp } from "./apply";

export function pushOps(db: Db, ops: Op[]): PushResponse {
  const isProcessed = db.prepare("SELECT 1 FROM processed_ops WHERE op_id = ?");
  const markProcessed = db.prepare("INSERT INTO processed_ops (op_id) VALUES (?)");

  return db.transaction(() => {
    const result: PushResponse = { applied: [], skipped: [] };
    for (const op of ops) {
      if (isProcessed.get(op.opId)) {
        result.skipped.push(op.opId);
        continue;
      }
      applyOp(db, op, nextTimestamp(db));
      markProcessed.run(op.opId);
      result.applied.push(op.opId);
    }
    return result;
  })();
}
