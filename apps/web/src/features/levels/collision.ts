import { type CollisionDetection, closestCenter } from "@dnd-kit/core";

// Levels and spaces share one DndContext, so a dragged item may only collide with
// items of its own kind. Otherwise a level could "land" on one of its spaces.
export const collideWithSameKind: CollisionDetection = (args) => {
  const kind = args.active.data.current?.kind;
  return closestCenter({
    ...args,
    droppableContainers: args.droppableContainers.filter((c) => c.data.current?.kind === kind),
  });
};
