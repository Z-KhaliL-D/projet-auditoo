import type { Level, Op, Space } from "@auditoo/shared";
import Dexie, { type Table } from "dexie";

export type OutboxEntry = { key?: number; opId: string; op: Op };
export type MetaEntry = { key: string; value: number };

export class AuditooDb extends Dexie {
  levels!: Table<Level, string>;
  spaces!: Table<Space, string>;
  outbox!: Table<OutboxEntry, number>;
  meta!: Table<MetaEntry, string>;

  constructor(name = "auditoo") {
    super(name);
    // deletedAt is not indexed: null is not a valid IndexedDB key.
    this.version(1).stores({
      levels: "id, rank",
      spaces: "id, levelId, rank",
      outbox: "++key, opId",
      meta: "key",
    });
  }
}

export const db = new AuditooDb();
