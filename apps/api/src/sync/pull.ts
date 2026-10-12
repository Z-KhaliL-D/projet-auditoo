import type { Level, PullResponse, Space } from "@auditoo/shared";
import { type Db, currentSeq } from "../db";

type LevelRow = {
  id: string;
  name: string;
  rank: string;
  updated_at: number;
  deleted_at: number | null;
};
type SpaceRow = LevelRow & { level_id: string };

const toLevel = (r: LevelRow): Level => ({
  id: r.id,
  name: r.name,
  rank: r.rank,
  updatedAt: r.updated_at,
  deletedAt: r.deleted_at,
});

const toSpace = (r: SpaceRow): Space => ({ ...toLevel(r), levelId: r.level_id });

// Rows and cursor are read in one transaction so the cursor never skips a change.
export function pullChanges(db: Db, since: number): PullResponse {
  return db.transaction(() => {
    const levels = db.prepare("SELECT * FROM levels WHERE seq > ? ORDER BY seq").all(since) as LevelRow[];
    const spaces = db.prepare("SELECT * FROM spaces WHERE seq > ? ORDER BY seq").all(since) as SpaceRow[];
    return {
      levels: levels.map(toLevel),
      spaces: spaces.map(toSpace),
      cursor: currentSeq(db),
    };
  })();
}
