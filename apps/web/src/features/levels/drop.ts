import type { LevelWithSpaces } from "./useLevelTree";

export type DragKind = "level" | "space";
export type SpaceMove = { kind: "space"; id: string; levelId: string; index: number };
export type LevelMove = { kind: "level"; id: string; index: number };
export type Move = SpaceMove | LevelMove;

// `index` is always the final position among the destination's live siblings, which is
// what moveLevel and moveSpace expect. A drop that changes nothing resolves to null so no
// op is written.

export function resolveLevelDrop(levels: LevelWithSpaces[], activeId: string, overId: string): LevelMove | null {
  const from = levels.findIndex((l) => l.id === activeId);
  const to = levels.findIndex((l) => l.id === overId);
  if (from === -1 || to === -1 || to === from) return null;
  return { kind: "level", id: activeId, index: to };
}

type Location = { levelId: string; index: number };

function locateSpace(levels: LevelWithSpaces[], id: string): Location | null {
  for (const level of levels) {
    const index = level.spaces.findIndex((s) => s.id === id);
    if (index !== -1) return { levelId: level.id, index };
  }
  return null;
}

// Where the dragged space ends up when released over `overId`, which is either another
// space or a level that has no visible spaces (empty or folded). `isBelow` says whether
// the dragged item sits below the middle of the target, which decides before or after it
// when entering another level.
function spaceTarget(levels: LevelWithSpaces[], activeId: string, overId: string, isBelow: boolean): Location | null {
  const current = locateSpace(levels, activeId);
  if (!current) return null;
  const overSpace = locateSpace(levels, overId);
  if (overSpace) {
    if (overSpace.levelId === current.levelId) return overSpace;
    return { levelId: overSpace.levelId, index: overSpace.index + (isBelow ? 1 : 0) };
  }
  const overLevel = levels.find((l) => l.id === overId);
  if (!overLevel) return null;
  return overLevel.id === current.levelId ? current : { levelId: overLevel.id, index: overLevel.spaces.length };
}

// While dragging: only crossing into another level changes the layout. Inside a level
// the sortable list displaces rows by itself.
export function previewSpaceMove(
  levels: LevelWithSpaces[],
  activeId: string,
  overId: string,
  isBelow: boolean,
): SpaceMove | null {
  const current = locateSpace(levels, activeId);
  const target = spaceTarget(levels, activeId, overId, isBelow);
  if (!current || !target || target.levelId === current.levelId) return null;
  return { kind: "space", id: activeId, ...target };
}

// On release: `shown` includes any preview, `tree` is the stored data. The move is
// measured against the stored position, so dragging out and back writes nothing.
export function finalSpaceMove(
  tree: LevelWithSpaces[],
  shown: LevelWithSpaces[],
  activeId: string,
  overId: string,
  isBelow: boolean,
): SpaceMove | null {
  const target = spaceTarget(shown, activeId, overId, isBelow);
  const original = locateSpace(tree, activeId);
  if (!target || !original) return null;
  if (target.levelId === original.levelId && target.index === original.index) return null;
  return { kind: "space", id: activeId, ...target };
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
