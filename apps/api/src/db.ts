import Database from "better-sqlite3";

export type Db = Database.Database;

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS levels (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    rank TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    deleted_at INTEGER,
    seq INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS spaces (
    id TEXT PRIMARY KEY,
    level_id TEXT NOT NULL REFERENCES levels(id),
    name TEXT NOT NULL,
    rank TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    deleted_at INTEGER,
    seq INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS processed_ops (op_id TEXT PRIMARY KEY);
  CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value INTEGER NOT NULL);
  CREATE INDEX IF NOT EXISTS levels_seq ON levels(seq);
  CREATE INDEX IF NOT EXISTS spaces_seq ON spaces(seq);
  CREATE INDEX IF NOT EXISTS spaces_level ON spaces(level_id);
  INSERT OR IGNORE INTO meta (key, value) VALUES ('seq', 0);
`;

export function createDb(path: string): Db {
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  return db;
}

export function currentSeq(db: Db): number {
  const row = db.prepare("SELECT value FROM meta WHERE key = 'seq'").get() as { value: number };
  return row.value;
}

export function nextSeq(db: Db): number {
  const row = db
    .prepare("UPDATE meta SET value = value + 1 WHERE key = 'seq' RETURNING value")
    .get() as { value: number };
  return row.value;
}
