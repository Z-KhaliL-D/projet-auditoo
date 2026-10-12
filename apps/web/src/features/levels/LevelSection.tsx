import { useDndContext } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { db } from "@/data/db";
import { renameLevel } from "@/data/levels";
import { createSpace } from "@/data/spaces";
import { deleteLevelWithUndo } from "./deleteWithUndo";
import { DragHandle } from "./DragHandle";
import type { Ghost } from "./drop";
import { NameInput } from "./NameInput";
import { RowMenu } from "./RowMenu";
import { SpaceRow } from "./SpaceRow";
import { LEVEL_SWIPE } from "./swipe";
import { SwipeBackground } from "./SwipeBackground";
import { useSwipeToDelete } from "./useSwipeToDelete";
import type { LevelWithSpaces } from "./useLevelTree";

type Props = {
  level: LevelWithSpaces;
  collapsed: boolean;
  draggingSpace: boolean;
  ghost: Ghost | null;
  onToggle: () => void;
};

export function LevelSection({ level, collapsed, draggingSpace, ghost, onToggle }: Props) {
  const [renaming, setRenaming] = useState(false);
  const [adding, setAdding] = useState(false);
  const count = level.spaces.length;
  // A level with no visible spaces has no row to drop onto, so it becomes the drop target itself.
  const acceptsSpaces = collapsed || count === 0;
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging, isOver } =
    useSortable({ id: level.id, data: { kind: "level", acceptsSpaces } });
  const dropTarget = draggingSpace && acceptsSpaces && isOver;
  const dragActive = useDndContext().active !== null;
  const swipe = useSwipeToDelete({
    config: LEVEL_SWIPE,
    enabled: !renaming && !dragActive,
    onDelete: () => deleteLevelWithUndo(level),
  });
  const rows = level.spaces.map((space) => <SpaceRow key={space.id} space={space} />);
  if (ghost) rows.splice(Math.min(ghost.index, rows.length), 0, <li key="ghost" aria-hidden style={{ height: ghost.height }} />);

  return (
    <section
      ref={setNodeRef}
      data-level-id={level.id}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`overflow-hidden rounded-xl border bg-card ${isDragging ? "opacity-40" : ""} ${dropTarget ? "ring-2 ring-primary" : ""}`}
    >
      <div ref={swipe.rowRef} className="relative overflow-hidden">
        {swipe.showBackground && <SwipeBackground armed={swipe.armed} />}
        <div style={swipe.contentStyle} className="relative flex min-h-14 items-center gap-1 bg-card pl-1">
          <DragHandle ref={setActivatorNodeRef} label={level.name} {...attributes} {...listeners} />
          {renaming ? (
            <div className="flex-1 py-1 pr-3">
              <NameInput
                label={`Rename ${level.name}`}
                initialValue={level.name}
                onSubmit={(name) => renameLevel(db, level.id, name)}
                onClose={() => setRenaming(false)}
              />
            </div>
          ) : (
            <>
              <button
                type="button"
                aria-expanded={!collapsed}
                onClick={onToggle}
                {...swipe.handlers}
                className="flex min-h-14 min-w-0 flex-1 touch-pan-y items-center gap-2 text-left outline-none select-none [-webkit-touch-callout:none] focus-visible:underline"
              >
                {collapsed ? (
                  <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronDown className="size-5 shrink-0 text-muted-foreground" />
                )}
                <span className="truncate text-base font-semibold">{level.name}</span>
                <span className="shrink-0 text-sm text-muted-foreground">{count}</span>
              </button>
              <RowMenu
                label={level.name}
                onRename={() => setRenaming(true)}
                onDelete={() => deleteLevelWithUndo(level)}
              />
            </>
          )}
        </div>
      </div>

      {!collapsed && (
        <div>
          {count === 0 && !adding && !ghost && (
            <p className="border-t px-4 py-3 text-sm text-muted-foreground">No spaces yet</p>
          )}
          <SortableContext items={level.spaces.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <ul>{rows}</ul>
          </SortableContext>
          <div className="border-t">
            {adding ? (
              <div className="px-3 py-1">
                <NameInput
                  keepOpen
                  label={`New space in ${level.name}`}
                  placeholder="Space name"
                  onSubmit={(name) => createSpace(db, level.id, name)}
                  onClose={() => setAdding(false)}
                />
              </div>
            ) : (
              <Button
                variant="ghost"
                className="h-11 w-full justify-start gap-2 rounded-none px-4 text-base font-medium text-primary"
                onClick={() => setAdding(true)}
              >
                <Plus className="size-5" /> Add space
              </Button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
