import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { db } from "@/data/db";
import { renameLevel } from "@/data/levels";
import { createSpace } from "@/data/spaces";
import { deleteLevelWithUndo } from "./deleteWithUndo";
import { NameInput } from "./NameInput";
import { RowMenu } from "./RowMenu";
import { SpaceRow } from "./SpaceRow";
import type { LevelWithSpaces } from "./useLevelTree";

type Props = { level: LevelWithSpaces; collapsed: boolean; onToggle: () => void };

export function LevelSection({ level, collapsed, onToggle }: Props) {
  const [renaming, setRenaming] = useState(false);
  const [adding, setAdding] = useState(false);
  const count = level.spaces.length;

  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <div className="flex min-h-14 items-center gap-1 pl-4">
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
              className="flex min-h-14 min-w-0 flex-1 items-center gap-2 text-left outline-none focus-visible:underline"
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

      {!collapsed && (
        <div>
          {count === 0 && !adding && (
            <p className="border-t px-4 py-3 text-sm text-muted-foreground">No spaces yet</p>
          )}
          <SortableContext items={level.spaces.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <ul>
              {level.spaces.map((space) => (
                <SpaceRow key={space.id} space={space} />
              ))}
            </ul>
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
