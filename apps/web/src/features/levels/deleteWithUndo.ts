import { toast } from "sonner";
import { db } from "@/data/db";
import { deleteLevel, restoreLevel } from "@/data/levels";
import { deleteSpace, restoreSpace } from "@/data/spaces";
import type { LevelWithSpaces } from "./useLevelTree";

const UNDO_MS = 6000;

// Space undo toasts per level. Once the level is deleted, restoring one of its
// spaces is a no-op, so those toasts are dismissed to avoid a dead Undo button.
const spaceToasts = new Map<string, (string | number)[]>();

export async function deleteSpaceWithUndo(levelId: string, spaceId: string, name: string) {
  await deleteSpace(db, spaceId);
  const id = toast(`${name} deleted`, {
    duration: UNDO_MS,
    action: { label: "Undo", onClick: () => restoreSpace(db, spaceId) },
  });
  spaceToasts.set(levelId, [...(spaceToasts.get(levelId) ?? []), id]);
}

export async function deleteLevelWithUndo(level: LevelWithSpaces) {
  await deleteLevel(db, level.id);
  for (const id of spaceToasts.get(level.id) ?? []) toast.dismiss(id);
  spaceToasts.delete(level.id);
  const count = level.spaces.length;
  const detail = count > 0 ? ` · ${count} ${count === 1 ? "space" : "spaces"}` : "";
  toast(`${level.name} deleted${detail}`, {
    duration: UNDO_MS,
    action: { label: "Undo", onClick: () => restoreLevel(db, level.id) },
  });
}
