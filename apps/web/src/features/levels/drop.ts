import type { LevelWithSpaces } from "./useLevelTree";

export type DragKind = "level" | "space";
export type SpaceMove = { kind: "space"; id: string; levelId: string; index: number };
export type LevelMove = { kind: "level"; id: string; index: number };
export type Move = SpaceMove | LevelMove;

// `index` is the final position among the destination's live siblings, which is what
// moveLevel and moveSpace expect. A drop that changes nothing resolves to null so no
// op is written.
export function resolveDrop(
  levels: LevelWithSpaces[],
  kind: DragKind,
  activeId: string,
  overId: string,
): Move | null {
  return kind === "level" ? resolveLevelDrop(levels, activeId, overId) : resolveSpaceDrop(levels, activeId, overId);
}

function resolveLevelDrop(levels: LevelWithSpaces[], activeId: string, overId: string): LevelMove | null {
  const from = levels.findIndex((l) => l.id === activeId);
  const to = levels.findIndex((l) => l.id === overId);
  if (from === -1 || to === -1 || to === from) return null;
  return { kind: "level", id: activeId, index: to };
}

function resolveSpaceDrop(levels: LevelWithSpaces[], activeId: string, overId: string): SpaceMove | null {
  const level = levels.find((l) => l.spaces.some((s) => s.id === activeId));
  if (!level) return null;
  const from = level.spaces.findIndex((s) => s.id === activeId);
  const to = level.spaces.findIndex((s) => s.id === overId);
  if (to === -1 || to === from) return null;
  return { kind: "space", id: activeId, levelId: level.id, index: to };
}

export function applyMove(levels: LevelWithSpaces[], move: Move): LevelWithSpaces[] {
  return move.kind === "level" ? applyLevelMove(levels, move) : applySpaceMove(levels, move);
}

function applyLevelMove(levels: LevelWithSpaces[], move: LevelMove): LevelWithSpaces[] {
  const moved = levels.find((l) => l.id === move.id);
  if (!moved) return levels;
  const rest = levels.filter((l) => l.id !== move.id);
  rest.splice(move.index, 0, moved);
  return rest;
}

function applySpaceMove(levels: LevelWithSpaces[], move: SpaceMove): LevelWithSpaces[] {
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
export function reflects(levels: LevelWithSpaces[], move: Move): boolean {
  if (move.kind === "level") return levels[move.index]?.id === move.id;
  return levels.find((l) => l.id === move.levelId)?.spaces[move.index]?.id === move.id;
}
