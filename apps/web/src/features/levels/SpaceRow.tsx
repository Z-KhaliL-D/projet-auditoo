import type { Space } from "@auditoo/shared";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState } from "react";
import { db } from "@/data/db";
import { renameSpace } from "@/data/spaces";
import { deleteSpaceWithUndo } from "./deleteWithUndo";
import { DragHandle } from "./DragHandle";
import { NameInput } from "./NameInput";
import { RowMenu } from "./RowMenu";

// Only the handle carries the drag listeners, so the row body stays free for scrolling
// and for swipe-to-delete.
export function SpaceRow({ space }: { space: Space }) {
  const [editing, setEditing] = useState(false);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: space.id,
    data: { kind: "space" },
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`flex min-h-11 items-center gap-1 border-t pl-1 ${isDragging ? "opacity-40" : ""}`}
    >
      <DragHandle ref={setActivatorNodeRef} label={space.name} {...attributes} {...listeners} />
      {editing ? (
        <div className="flex-1 py-1 pr-3">
          <NameInput
            label={`Rename ${space.name}`}
            initialValue={space.name}
            onSubmit={(name) => renameSpace(db, space.id, name)}
            onClose={() => setEditing(false)}
          />
        </div>
      ) : (
        <>
          <span className="flex-1 truncate py-2 text-[15px] text-foreground/85">{space.name}</span>
          <RowMenu
            label={space.name}
            onRename={() => setEditing(true)}
            onDelete={() => deleteSpaceWithUndo(space.levelId, space.id, space.name)}
          />
        </>
      )}
    </li>
  );
}
