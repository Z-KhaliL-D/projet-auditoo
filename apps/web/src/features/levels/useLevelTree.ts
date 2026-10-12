import { type Level, type Space, compareByRank } from "@auditoo/shared";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/data/db";

export type LevelWithSpaces = Level & { spaces: Space[] };

// undefined while the first read is in flight, so the UI can avoid flashing the empty state.
export function useLevelTree(): LevelWithSpaces[] | undefined {
  return useLiveQuery(async () => {
    const [levels, spaces] = await Promise.all([
      db.levels.filter((l) => l.deletedAt === null).toArray(),
      db.spaces.filter((s) => s.deletedAt === null).toArray(),
    ]);
    return levels.sort(compareByRank).map((level) => ({
      ...level,
      spaces: spaces.filter((s) => s.levelId === level.id).sort(compareByRank),
    }));
  }, []);
}
