import type { Space } from "@auditoo/shared";
import { useState } from "react";
import { db } from "@/data/db";
import { renameSpace } from "@/data/spaces";
import { deleteSpaceWithUndo } from "./deleteWithUndo";
import { NameInput } from "./NameInput";
import { RowMenu } from "./RowMenu";

// The row body is left free for swipe-to-delete, and the space before the name is
// where the drag handle will go.
export function SpaceRow({ space }: { space: Space }) {
  const [editing, setEditing] = useState(false);

  return (
    <li className="flex min-h-11 items-center gap-1 border-t pl-4">
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
