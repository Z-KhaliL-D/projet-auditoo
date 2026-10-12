import type { CollisionDetection } from "@dnd-kit/core";
import { describe, expect, it } from "vitest";
import { collideWithSameKind } from "./collision";

type Args = Parameters<CollisionDetection>[0];

const rect = (top: number, height: number) => ({ top, left: 0, bottom: top + height, right: 300, width: 300, height });
const container = (id: string, kind: string, top: number, height: number) =>
  ({ id, data: { current: { kind } }, rect: { current: rect(top, height) } }) as unknown as Args["droppableContainers"][number];

function args(activeKind: string, activeId: string, collision: ReturnType<typeof rect>): Args {
  const containers = [
    container("L1", "level", 0, 200),
    container("a", "space", 60, 44),
    container("L2", "level", 220, 200),
    container("x", "space", 280, 44),
  ];
  return {
    active: { id: activeId, data: { current: { kind: activeKind } }, rect: { current: { initial: null, translated: null } } },
    collisionRect: { ...collision, ...rect(collision.top, collision.height) },
    droppableRects: new Map(containers.map((c) => [c.id, c.rect.current!])),
    droppableContainers: containers,
    pointerCoordinates: null,
  } as unknown as Args;
}

describe("collideWithSameKind", () => {
  it("lets a level collide only with levels, even when a space is closer", () => {
    // Centered on space "a", which is closest, but a level is being dragged.
    const hits = collideWithSameKind(args("level", "L2", rect(60, 44)));
    expect(hits.map((h) => h.id)).not.toContain("a");
    expect(hits[0].id).toBe("L1");
  });

  it("lets a space collide only with spaces", () => {
    const hits = collideWithSameKind(args("space", "x", rect(0, 200)));
    expect(hits.map((h) => h.id).sort()).toEqual(["a", "x"]);
    expect(hits[0].id).toBe("a");
  });
});
