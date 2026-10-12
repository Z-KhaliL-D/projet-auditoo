import type { Level, Space } from "@auditoo/shared";
import { describe, expect, it } from "vitest";
import { type Move, applyMove, finalSpaceMove, previewSpaceMove, reflects, resolveLevelDrop } from "./drop";
import type { LevelWithSpaces } from "./useLevelTree";

const space = (id: string, levelId: string): Space => ({
  id,
  levelId,
  name: id,
  rank: id,
  updatedAt: 1,
  deletedAt: null,
});
const level = (id: string, spaceIds: string[]): LevelWithSpaces => ({
  ...({ id, name: id, rank: id, updatedAt: 1, deletedAt: null } satisfies Level),
  spaces: spaceIds.map((s) => space(s, id)),
});
const ids = (l: LevelWithSpaces) => l.spaces.map((s) => s.id);

const tree = () => [level("L1", ["a", "b", "c"]), level("L2", ["x"]), level("L3", [])];

describe("finalSpaceMove inside a level", () => {
  const final = (active: string, over: string, below = false) => finalSpaceMove(tree(), tree(), active, over, below);

  it("moves a space down to the index of the one it was dropped on", () => {
    expect(final("a", "c")).toEqual({ kind: "space", id: "a", levelId: "L1", index: 2 });
  });

  it("moves a space up", () => {
    expect(final("c", "a")).toEqual({ kind: "space", id: "c", levelId: "L1", index: 0 });
  });

  it("returns null when dropped on itself, so no op is written", () => {
    expect(final("b", "b")).toBeNull();
  });

  it("returns null when the dragged space or the target no longer exists", () => {
    expect(final("gone", "a")).toBeNull();
    expect(final("a", "unknown")).toBeNull();
  });
});

describe("moving a space into another level", () => {
  it("previews above or below the hovered space of another level", () => {
    expect(previewSpaceMove(tree(), "a", "x", false)).toEqual({ kind: "space", id: "a", levelId: "L2", index: 0 });
    expect(previewSpaceMove(tree(), "a", "x", true)).toEqual({ kind: "space", id: "a", levelId: "L2", index: 1 });
  });

  it("previews the end of an empty or folded level when hovering the level itself", () => {
    expect(previewSpaceMove(tree(), "a", "L3", false)).toEqual({ kind: "space", id: "a", levelId: "L3", index: 0 });
    expect(previewSpaceMove(tree(), "a", "L2", true)).toEqual({ kind: "space", id: "a", levelId: "L2", index: 1 });
  });

  it("does not preview inside the current level", () => {
    expect(previewSpaceMove(tree(), "a", "c", true)).toBeNull();
    expect(previewSpaceMove(tree(), "a", "L1", true)).toBeNull();
    expect(previewSpaceMove(tree(), "a", "gone", true)).toBeNull();
  });

  it("drops into the previewed level at the index the preview showed", () => {
    const stored = tree();
    const move = previewSpaceMove(stored, "a", "x", true)!;
    const shown = applyMove(stored, move);

    // Released over the space it was dropped next to, or over itself.
    expect(finalSpaceMove(stored, shown, "a", "a", false)).toEqual({ kind: "space", id: "a", levelId: "L2", index: 1 });
    expect(finalSpaceMove(stored, shown, "a", "x", false)).toEqual({ kind: "space", id: "a", levelId: "L2", index: 0 });
  });

  it("moves into an empty level", () => {
    expect(finalSpaceMove(tree(), tree(), "a", "L3", false)).toEqual({
      kind: "space",
      id: "a",
      levelId: "L3",
      index: 0,
    });
  });

  it("leaves the source level without the space and keeps the others in order", () => {
    const after = applyMove(tree(), { kind: "space", id: "b", levelId: "L2", index: 0 });
    expect(ids(after[0])).toEqual(["a", "c"]);
    expect(ids(after[1])).toEqual(["b", "x"]);
  });

  it("writes nothing when the space is dragged out and back to where it was", () => {
    const stored = tree();
    const out = applyMove(stored, previewSpaceMove(stored, "b", "x", false)!);
    const back = previewSpaceMove(out, "b", "c", false)!;
    expect(back).toEqual({ kind: "space", id: "b", levelId: "L1", index: 1 });
    expect(finalSpaceMove(stored, applyMove(stored, back), "b", "b", false)).toBeNull();
  });

  it("writes the move when it comes back to a different position in its own level", () => {
    const stored = tree();
    const out = applyMove(stored, previewSpaceMove(stored, "b", "x", false)!);
    const back = previewSpaceMove(out, "b", "c", true)!;
    expect(finalSpaceMove(stored, applyMove(stored, back), "b", "b", false)).toEqual({
      kind: "space",
      id: "b",
      levelId: "L1",
      index: 2,
    });
  });
});

describe("applyMove", () => {
  it("reorders inside a level without touching other levels", () => {
    const before = tree();
    const after = applyMove(before, { kind: "space", id: "a", levelId: "L1", index: 2 });
    expect(ids(after[0])).toEqual(["b", "c", "a"]);
    expect(after[1]).toBe(before[1]);
    expect(after[2]).toBe(before[2]);
  });

  it("moves up", () => {
    expect(ids(applyMove(tree(), { kind: "space", id: "c", levelId: "L1", index: 0 })[0])).toEqual(["c", "a", "b"]);
  });

  it("moves across levels, including into an empty one, updating levelId", () => {
    const after = applyMove(tree(), { kind: "space", id: "b", levelId: "L3", index: 0 });
    expect(ids(after[0])).toEqual(["a", "c"]);
    expect(ids(after[2])).toEqual(["b"]);
    expect(after[2].spaces[0].levelId).toBe("L3");
  });

  it("does nothing for an unknown space", () => {
    const before = tree();
    expect(applyMove(before, { kind: "space", id: "nope", levelId: "L1", index: 0 })).toBe(before);
  });
});

describe("reflects", () => {
  it("is true once the data shows the space at the target index", () => {
    const move: Move = { kind: "space", id: "a", levelId: "L1", index: 2 };
    expect(reflects(tree(), move)).toBe(false);
    expect(reflects(applyMove(tree(), move), move)).toBe(true);
  });

  it("is false when the level is missing", () => {
    expect(reflects(tree(), { kind: "space", id: "a", levelId: "nope", index: 0 })).toBe(false);
  });
});

describe("level moves", () => {
  const order = (levels: LevelWithSpaces[]) => levels.map((l) => l.id);

  it("resolves a drop to the index of the level it landed on", () => {
    expect(resolveLevelDrop(tree(), "L1", "L3")).toEqual({ kind: "level", id: "L1", index: 2 });
    expect(resolveLevelDrop(tree(), "L3", "L1")).toEqual({ kind: "level", id: "L3", index: 0 });
  });

  it("returns null for the same position, a missing level, or a space as the target", () => {
    expect(resolveLevelDrop(tree(), "L2", "L2")).toBeNull();
    expect(resolveLevelDrop(tree(), "gone", "L1")).toBeNull();
    expect(resolveLevelDrop(tree(), "L1", "a")).toBeNull();
  });

  it("reorders levels and keeps their spaces", () => {
    const after = applyMove(tree(), { kind: "level", id: "L1", index: 2 });
    expect(order(after)).toEqual(["L2", "L3", "L1"]);
    expect(ids(after[2])).toEqual(["a", "b", "c"]);
  });

  it("does nothing for an unknown level", () => {
    const before = tree();
    expect(applyMove(before, { kind: "level", id: "nope", index: 0 })).toBe(before);
  });

  it("reflects once the level sits at the target index", () => {
    const move: Move = { kind: "level", id: "L1", index: 2 };
    expect(reflects(tree(), move)).toBe(false);
    expect(reflects(applyMove(tree(), move), move)).toBe(true);
  });
});
