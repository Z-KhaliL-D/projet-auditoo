import type { Op } from "@auditoo/shared";
import { type Db, nextSeq } from "../db";

type Table = "levels" | "spaces";
type Columns = Record<string, string | number | null>;

function isLive(db: Db, table: Table, id: string): boolean {
  return db.prepare(`SELECT 1 FROM ${table} WHERE id = ? AND deleted_at IS NULL`).get(id) !== undefined;
}

function exists(db: Db, table: Table, id: string): boolean {
  return db.prepare(`SELECT 1 FROM ${table} WHERE id = ?`).get(id) !== undefined;
}

// Column names come from literals in this file, never from client input.
function update(db: Db, table: Table, id: string, now: number, columns: Columns): void {
  const sets = Object.keys(columns).map((c) => `${c} = @${c}`).join(", ");
  db.prepare(`UPDATE ${table} SET ${sets}, updated_at = @updatedAt, seq = @seq WHERE id = @id`).run({
    ...columns,
    updatedAt: now,
    seq: nextSeq(db),
    id,
  });
}

// Deletes win over edits: an edit on a missing or deleted target is a no-op.
// New data wins over deletes: space.create restores a deleted parent level.
export function applyOp(db: Db, op: Op, now: number): void {
  switch (op.type) {
    case "level.create": {
      const { id, name, rank } = op.payload;
      if (exists(db, "levels", id)) return;
      db.prepare(
        "INSERT INTO levels (id, name, rank, updated_at, deleted_at, seq) VALUES (?, ?, ?, ?, NULL, ?)",
      ).run(id, name, rank, now, nextSeq(db));
      return;
    }
    case "level.rename": {
      const { id, name } = op.payload;
      if (isLive(db, "levels", id)) update(db, "levels", id, now, { name });
      return;
    }
    case "level.move": {
      const { id, rank } = op.payload;
      if (isLive(db, "levels", id)) update(db, "levels", id, now, { rank });
      return;
    }
    case "level.delete": {
      const { id } = op.payload;
      if (!isLive(db, "levels", id)) return;
      update(db, "levels", id, now, { deleted_at: now });
      const spaces = db
        .prepare("SELECT id FROM spaces WHERE level_id = ? AND deleted_at IS NULL")
        .all(id) as { id: string }[];
      for (const space of spaces) update(db, "spaces", space.id, now, { deleted_at: now });
      return;
    }
    case "space.create": {
      const { id, levelId, name, rank } = op.payload;
      if (exists(db, "spaces", id) || !exists(db, "levels", levelId)) return;
      if (!isLive(db, "levels", levelId)) update(db, "levels", levelId, now, { deleted_at: null });
      db.prepare(
        "INSERT INTO spaces (id, level_id, name, rank, updated_at, deleted_at, seq) VALUES (?, ?, ?, ?, ?, NULL, ?)",
      ).run(id, levelId, name, rank, now, nextSeq(db));
      return;
    }
    case "space.rename": {
      const { id, name } = op.payload;
      if (isLive(db, "spaces", id)) update(db, "spaces", id, now, { name });
      return;
    }
    case "space.move": {
      const { id, levelId, rank } = op.payload;
      if (isLive(db, "spaces", id) && isLive(db, "levels", levelId)) {
        update(db, "spaces", id, now, { level_id: levelId, rank });
      }
      return;
    }
    case "space.delete": {
      const { id } = op.payload;
      if (isLive(db, "spaces", id)) update(db, "spaces", id, now, { deleted_at: now });
      return;
    }
  }
}
