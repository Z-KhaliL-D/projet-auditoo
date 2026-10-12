import type { PushResponse } from "@auditoo/shared";
import type { AuditooDb, OutboxEntry } from "@/data/db";
import { ServerError, type Transport } from "./http";

const CHUNK = 100;

const isRejection = (err: unknown): err is ServerError => err instanceof ServerError && err.status === 400;

// Sends the outbox in order until it is empty. An entry leaves the outbox only after
// the server lists it as applied or skipped.
export async function pushOutbox(db: AuditooDb, transport: Transport): Promise<void> {
  for (;;) {
    const entries = await db.outbox.orderBy("key").limit(CHUNK).toArray();
    if (entries.length === 0) return;
    try {
      await acknowledge(db, entries, await transport.push(entries.map((e) => e.op)));
    } catch (err) {
      if (!isRejection(err)) throw err;
      await pushOneByOne(db, transport, entries);
    }
  }
}

async function acknowledge(db: AuditooDb, entries: OutboxEntry[], res: PushResponse): Promise<void> {
  const done = new Set([...res.applied, ...res.skipped]);
  const keys = entries.filter((e) => done.has(e.opId)).map((e) => e.key!);
  // Without progress the caller would loop forever.
  if (keys.length === 0) throw new ServerError(0, "push acknowledged no ops");
  await db.outbox.bulkDelete(keys);
}

// A 400 rejects the whole batch, so find the culprit by sending ops alone. Rejected
// ops move to `rejected` and the rest of the outbox keeps flowing.
async function pushOneByOne(db: AuditooDb, transport: Transport, entries: OutboxEntry[]): Promise<void> {
  for (const entry of entries) {
    try {
      await acknowledge(db, [entry], await transport.push([entry.op]));
    } catch (err) {
      if (!isRejection(err)) throw err;
      await db.transaction("rw", db.outbox, db.rejected, async () => {
        await db.rejected.add({ opId: entry.opId, op: entry.op, reason: err.message, rejectedAt: Date.now() });
        await db.outbox.delete(entry.key!);
      });
    }
  }
}
