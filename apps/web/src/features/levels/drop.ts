import type { LevelWithSpaces } from "./useLevelTree";

export type SpaceMove = { id: string; levelId: string; index: number };

// `index` is the final position among the destination's live spaces, which is what
// moveSpace expects. A drop that changes nothing resolves to null so no op is written.
export function resolveSpaceDrop(levels: LevelWithSpaces[], activeId: string, overId: string): SpaceMove | null {
  const level = levels.find((l) => l.spaces.some((s) => s.id === activeId));
  if (!level) return null;
  const from = level.spaces.findIndex((s) => s.id === activeId);
  const to = level.spaces.findIndex((s) => s.id === overId);
  if (to === -1 || to === from) return null;
  return { id: activeId, levelId: level.id, index: to };
}

export function applyMove(levels: LevelWithSpaces[], move: SpaceMove): LevelWithSpaces[] {
  const moved = levels.flatMap((l) => l.spaces).find((s) => s.id === move.id);
  if (!moved) return levels;
  return levels.map((level) => {
    const rest = level.spaces.filter((s) => s.id !== move.id);
    if (level.id !== move.levelId) return rest.length === level.spaces.length ? level : { ...level, spaces: rest };
    rest.splice(move.index, 0, { ...moved, levelId: level.id });
    return { ...level, spaces: rest };
  });
}

// True once the data from Dexie already shows the move.
export function reflects(levels: LevelWithSpaces[], move: SpaceMove): boolean {
  return levels.find((l) => l.id === move.levelId)?.spaces[move.index]?.id === move.id;
}
