import { type Op, opSchema } from "@auditoo/shared";
import type { AuditooDb } from "./db";

type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;
export type OpInput = DistributiveOmit<Op, "opId" | "createdAt">;

// Parsing here keeps invalid ops out of the outbox, so the server never has to 400 them.
export async function appendOp(db: AuditooDb, input: OpInput, now: number): Promise<void> {
  const op = opSchema.parse({ ...input, opId: crypto.randomUUID(), createdAt: now });
  await db.outbox.add({ opId: op.opId, op });
}
