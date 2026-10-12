import type { Space } from "@auditoo/shared";
import { useDndContext } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState } from "react";
import { db } from "@/data/db";
import { renameSpace } from "@/data/spaces";
import { deleteSpaceWithUndo } from "./deleteWithUndo";
import { DragHandle } from "./DragHandle";
import { NameInput } from "./NameInput";
import { RowMenu } from "./RowMenu";
import { SPACE_SWIPE } from "./swipe";
import { SwipeBackground } from "./SwipeBackground";
import { useSwipeToDelete } from "./useSwipeToDelete";

// Only the handle carries the drag listeners. Swiping the name area left deletes the row;
// the handle and the menu button are outside that area, so they keep their own gestures.
export function SpaceRow({ space }: { space: Space }) {
  const [editing, setEditing] = useState(false);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: space.id,
    data: { kind: "space" },
  });
  const dragActive = useDndContext().active !== null;
  const swipe = useSwipeToDelete({
    config: SPACE_SWIPE,
    enabled: !editing && !dragActive,
    onDelete: () => deleteSpaceWithUndo(space.levelId, space.id, space.name),
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`border-t ${isDragging ? "opacity-40" : ""}`}
    >
      <div ref={swipe.rowRef} className="relative overflow-hidden">
        {swipe.showBackground && <SwipeBackground armed={swipe.armed} />}
        <div style={swipe.contentStyle} className="relative flex min-h-11 items-center gap-1 bg-card pl-1">
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
              <div
                data-swipe-zone
                {...swipe.handlers}
                className="flex min-h-11 min-w-0 flex-1 touch-pan-y items-center select-none [-webkit-touch-callout:none]"
              >
                <span className="truncate text-[15px] text-foreground/85">{space.name}</span>
              </div>
              <RowMenu
                label={space.name}
                onRename={() => setEditing(true)}
                onDelete={() => deleteSpaceWithUndo(space.levelId, space.id, space.name)}
              />
            </>
          )}
        </div>
      </div>
    </li>
  );
}
