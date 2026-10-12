import {
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { db } from "@/data/db";
import { createLevel } from "@/data/levels";
import { InstallNudge } from "@/pwa/InstallNudge";
import { SyncBadge } from "@/sync/SyncBadge";
import { collideForKind } from "./collision";
import { DragPreview } from "./DragHandle";
import { type DragKind, finalSpaceMove, ghostFor, previewSpaceMove, resolveLevelDrop } from "./drop";
import { LevelSection } from "./LevelSection";
import { NameInput } from "./NameInput";
import { useCollapsed } from "./useCollapsed";
import { useFoldAnchor } from "./useFoldAnchor";
import { useLevelTree } from "./useLevelTree";
import { useOptimisticMove } from "./useOptimisticMove";

export function LevelsScreen() {
  const tree = useLevelTree();
  const { levels, commit, setPreview } = useOptimisticMove(tree);
  const { collapsed, toggle } = useCollapsed();
  const [adding, setAdding] = useState(false);
  const [active, setActive] = useState<{ id: string; kind: DragKind; height: number } | null>(null);
  const mainRef = useRef<HTMLElement>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const draggingLevel = active?.kind === "level";
  const captureAnchor = useFoldAnchor(draggingLevel, mainRef);
  const ghost = active?.kind === "space" && tree && levels ? ghostFor(tree, levels, active.id, active.height) : null;
  const activeName = (active?.kind === "level" ? levels : levels?.flatMap((l) => l.spaces))?.find(
    (item) => item.id === active?.id,
  )?.name;

  // Whether the carried item sits below the middle of what it hovers.
  function isBelow({ active: dragged, over }: Pick<DragOverEvent, "active" | "over">): boolean {
    const carried = dragged.rect.current.translated;
    return !!carried && !!over && carried.top + carried.height / 2 > over.rect.top + over.rect.height / 2;
  }

  function onDragOver(event: DragOverEvent) {
    if (active?.kind !== "space" || !event.over || !levels) return;
    const move = previewSpaceMove(levels, String(event.active.id), String(event.over.id), isBelow(event));
    if (move) setPreview(move);
  }

  function onDragEnd(event: DragEndEvent) {
    const kind = active?.kind;
    if (kind === "level") captureAnchor(String(event.active.id));
    setActive(null);
    const { over } = event;
    const [id, overId] = [String(event.active.id), String(over?.id)];
    const move =
      !kind || !over || !tree || !levels
        ? null
        : kind === "level"
          ? resolveLevelDrop(levels, id, overId)
          : finalSpaceMove(tree, levels, id, overId, isBelow(event));
    if (move) commit(move);
    else setPreview(null);
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
        collisionDetection={collideForKind}
        // Droppables are re-measured throughout the drag, because levels fold and shrink while it runs.
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        onDragStart={({ active: dragged }) => {
          const kind = dragged.data.current?.kind as DragKind;
          if (kind === "level") captureAnchor(String(dragged.id));
          setActive({ id: String(dragged.id), kind, height: dragged.rect.current.initial?.height ?? 0 });
        }}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={({ active: dragged }) => {
          if (dragged.data.current?.kind === "level") captureAnchor(String(dragged.id));
          setActive(null);
          setPreview(null);
        }}
      >
        <main ref={mainRef} className="flex-1 space-y-3 px-3 pt-3 pb-28">
          <InstallNudge />
          {levels === undefined ? null : levels.length === 0 && !adding ? (
            <div className="px-4 py-16 text-center">
              <p className="text-base font-medium">No levels yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Add the floors of the building, then the spaces on each one.
              </p>
            </div>
          ) : (
            <SortableContext items={levels.map((l) => l.id)} strategy={verticalListSortingStrategy}>
              {levels.map((level) => (
                <LevelSection
                  key={level.id}
                  level={level}
                  // While a level is carried every level folds, so the list is short enough to drag through.
                  collapsed={draggingLevel || collapsed.has(level.id)}
                  draggingSpace={active?.kind === "space"}
                  ghost={ghost?.levelId === level.id ? ghost : null}
                  onToggle={() => toggle(level.id)}
                />
              ))}
            </SortableContext>
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
        {/* No drop animation: it would aim at a position measured before the layout settles. */}
        <DragOverlay dropAnimation={null}>{activeName ? <DragPreview name={activeName} bold={draggingLevel} /> : null}</DragOverlay>
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
