import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { db } from "@/data/db";
import { createLevel } from "@/data/levels";
import { SyncBadge } from "@/sync/SyncBadge";
import { DragPreview } from "./DragHandle";
import { resolveSpaceDrop } from "./drop";
import { LevelSection } from "./LevelSection";
import { NameInput } from "./NameInput";
import { useCollapsed } from "./useCollapsed";
import { useLevelTree } from "./useLevelTree";
import { useOptimisticMove } from "./useOptimisticMove";

export function LevelsScreen() {
  const { levels, commit } = useOptimisticMove(useLevelTree());
  const { collapsed, toggle } = useCollapsed();
  const [adding, setAdding] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const activeSpace = levels?.flatMap((l) => l.spaces).find((s) => s.id === activeId);

  function onDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    const move = over && levels ? resolveSpaceDrop(levels, String(active.id), String(over.id)) : null;
    if (move) commit(move);
  }
  const addRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (adding) addRef.current?.scrollIntoView?.({ block: "center" });
  }, [adding]);

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col">
      <header className="sticky top-0 z-10 flex min-h-14 items-center justify-between border-b bg-background/95 px-4 pt-[env(safe-area-inset-top)] backdrop-blur">
        <h1 className="text-lg font-semibold">Auditoo</h1>
        <SyncBadge />
      </header>

      <DndContext
        sensors={sensors}
        onDragStart={({ active }) => setActiveId(String(active.id))}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <main className="flex-1 space-y-3 px-3 pt-3 pb-28">
          {levels === undefined ? null : levels.length === 0 && !adding ? (
            <div className="px-4 py-16 text-center">
              <p className="text-base font-medium">No levels yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Add the floors of the building, then the spaces on each one.
              </p>
            </div>
          ) : (
            levels.map((level) => (
              <LevelSection
                key={level.id}
                level={level}
                collapsed={collapsed.has(level.id)}
                onToggle={() => toggle(level.id)}
              />
            ))
          )}
          {adding && (
            <div ref={addRef} className="rounded-xl border bg-card p-2">
              <NameInput
                keepOpen
                label="New level"
                placeholder="Level name"
                onSubmit={(name) => createLevel(db, name)}
                onClose={() => setAdding(false)}
              />
            </div>
          )}
        </main>
        <DragOverlay>{activeSpace ? <DragPreview name={activeSpace.name} /> : null}</DragOverlay>
      </DndContext>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t bg-background/95 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto max-w-2xl">
          <Button className="h-12 w-full gap-2 text-base" onClick={() => setAdding(true)}>
            <Plus className="size-5" /> Add level
          </Button>
        </div>
      </div>

      <Toaster position="bottom-center" offset={{ bottom: "calc(5.5rem + env(safe-area-inset-bottom))" }} />
    </div>
  );
}
