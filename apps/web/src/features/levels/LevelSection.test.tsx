// @vitest-environment jsdom
import type { Space } from "@auditoo/shared";
import { DndContext } from "@dnd-kit/core";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LevelSection } from "./LevelSection";
import type { LevelWithSpaces } from "./useLevelTree";

afterEach(cleanup);

const space = (id: string): Space => ({ id, levelId: "L", name: id, rank: id, updatedAt: 1, deletedAt: null });
const level = (ids: string[]): LevelWithSpaces => ({
  id: "L",
  name: "Ground",
  rank: "a",
  updatedAt: 1,
  deletedAt: null,
  spaces: ids.map(space),
});

function show(l: LevelWithSpaces, ghost: { index: number; height: number } | null) {
  return render(
    <DndContext>
      <LevelSection
        level={l}
        collapsed={false}
        draggingSpace
        ghost={ghost && { levelId: "L", ...ghost }}
        onToggle={() => {}}
      />
    </DndContext>,
  );
}

describe("LevelSection ghost row", () => {
  it("renders an empty row of the given height at the given index", () => {
    const { container } = show(level(["a", "b", "c"]), { index: 1, height: 45 });
    const rows = [...container.querySelectorAll("ul > li")];
    expect(rows).toHaveLength(4);
    expect(rows[1].getAttribute("aria-hidden")).toBe("true");
    expect((rows[1] as HTMLElement).style.height).toBe("45px");
    expect(rows[0].textContent).toBe("a");
    expect(rows[2].textContent).toBe("b");
  });

  it("keeps the level from showing the empty state while a ghost holds its place", () => {
    show(level([]), { index: 0, height: 45 });
    expect(screen.queryByText("No spaces yet")).toBeNull();
  });

  it("shows the empty state without a ghost", () => {
    show(level([]), null);
    expect(screen.getByText("No spaces yet")).toBeTruthy();
  });

  it("marks the section so the fold anchor can find it", () => {
    const { container } = show(level(["a"]), null);
    expect(container.querySelector('[data-level-id="L"]')).toBeTruthy();
  });
});
