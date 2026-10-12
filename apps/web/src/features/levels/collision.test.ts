import type { CollisionDetection } from "@dnd-kit/core";
import { describe, expect, it } from "vitest";
import { collideForKind } from "./collision";

type Args = Parameters<CollisionDetection>[0];

const rect = (top: number, height: number) => ({ top, left: 0, bottom: top + height, right: 300, width: 300, height });
const container = (id: string, data: Record<string, unknown>, top: number, height: number) =>
  ({ id, data: { current: data }, rect: { current: rect(top, height) } }) as unknown as Args["droppableContainers"][number];

// L1 shows space "a"; L2 is empty; L3 is folded; L4 shows space "x".
const containers = () => [
  container("L1", { kind: "level", acceptsSpaces: false }, 0, 120),
  container("a", { kind: "space" }, 60, 44),
  container("L2", { kind: "level", acceptsSpaces: true }, 130, 100),
  container("L3", { kind: "level", acceptsSpaces: true }, 240, 56),
  container("L4", { kind: "level", acceptsSpaces: false }, 306, 120),
  container("x", { kind: "space" }, 366, 44),
];

function args(activeKind: string, activeId: string, collision: ReturnType<typeof rect>): Args {
  const list = containers();
  return {
    active: { id: activeId, data: { current: { kind: activeKind } }, rect: { current: { initial: null, translated: null } } },
    collisionRect: { ...collision, ...rect(collision.top, collision.height) },
    droppableRects: new Map(list.map((c) => [c.id, c.rect.current!])),
    droppableContainers: list,
    pointerCoordinates: null,
  } as unknown as Args;
}

const ids = (hits: { id: unknown }[]) => hits.map((h) => String(h.id));

describe("collideForKind", () => {
  it("lets a level collide only with levels, even when a space is closer", () => {
    const hits = ids(collideForKind(args("level", "L4", rect(60, 44))));
    expect(hits).not.toContain("a");
    expect(hits).not.toContain("x");
    expect(hits[0]).toBe("L1");
  });

  it("lets a space collide with spaces", () => {
    const hits = collideForKind(args("space", "x", rect(60, 44)));
    expect(String(hits[0].id)).toBe("a");
  });

  it("lets a space collide with an empty level", () => {
    const hits = collideForKind(args("space", "a", rect(150, 44)));
    expect(String(hits[0].id)).toBe("L2");
  });

  it("lets a space collide with a folded level", () => {
    const hits = collideForKind(args("space", "a", rect(250, 36)));
    expect(String(hits[0].id)).toBe("L3");
  });

  it("ignores a level that shows spaces, so its nearest space decides", () => {
    const hits = ids(collideForKind(args("space", "a", rect(0, 20))));
    expect(hits).not.toContain("L1");
    expect(hits).not.toContain("L4");
  });
});
