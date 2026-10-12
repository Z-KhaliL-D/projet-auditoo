import { type CollisionDetection, closestCenter } from "@dnd-kit/core";

// Levels and spaces share one DndContext. A level only collides with levels. A space
// collides with other spaces and with levels that show no spaces (empty or folded),
// since those have no row to drop onto. For a level that does show spaces, the nearest
// space decides, so dropping near its header or its "Add space" row still lands sensibly.
export const collideForKind: CollisionDetection = (args) => {
  const kind = args.active.data.current?.kind;
  return closestCenter({
    ...args,
    droppableContainers: args.droppableContainers.filter((c) => {
      const data = c.data.current;
      if (kind === "level") return data?.kind === "level";
      return data?.kind === "space" || (data?.kind === "level" && data.acceptsSpaces === true);
    }),
  });
};
