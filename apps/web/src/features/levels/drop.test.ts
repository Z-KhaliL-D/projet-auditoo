import type { Level, Space } from "@auditoo/shared";
import { describe, expect, it } from "vitest";
import { applyMove, reflects, resolveSpaceDrop } from "./drop";
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

describe("resolveSpaceDrop", () => {
  it("moves a space down to the index of the one it was dropped on", () => {
    expect(resolveSpaceDrop(tree(), "a", "c")).toEqual({ id: "a", levelId: "L1", index: 2 });
  });

  it("moves a space up", () => {
    expect(resolveSpaceDrop(tree(), "c", "a")).toEqual({ id: "c", levelId: "L1", index: 0 });
  });

  it("returns null when dropped on itself, so no op is written", () => {
    expect(resolveSpaceDrop(tree(), "b", "b")).toBeNull();
  });

  it("returns null when the dragged space no longer exists", () => {
    expect(resolveSpaceDrop(tree(), "gone", "a")).toBeNull();
  });

  it("returns null when the drop target is not a space of the same level", () => {
    expect(resolveSpaceDrop(tree(), "a", "x")).toBeNull();
    expect(resolveSpaceDrop(tree(), "a", "unknown")).toBeNull();
  });
});

describe("applyMove", () => {
  it("reorders inside a level without touching other levels", () => {
    const before = tree();
    const after = applyMove(before, { id: "a", levelId: "L1", index: 2 });
    expect(ids(after[0])).toEqual(["b", "c", "a"]);
    expect(after[1]).toBe(before[1]);
    expect(after[2]).toBe(before[2]);
  });

  it("moves up", () => {
    expect(ids(applyMove(tree(), { id: "c", levelId: "L1", index: 0 })[0])).toEqual(["c", "a", "b"]);
  });

  it("moves across levels, including into an empty one", () => {
    const after = applyMove(tree(), { id: "b", levelId: "L3", index: 0 });
    expect(ids(after[0])).toEqual(["a", "c"]);
    expect(ids(after[2])).toEqual(["b"]);
    expect(after[2].spaces[0].levelId).toBe("L3");
  });

  it("does nothing for an unknown space", () => {
    const before = tree();
    expect(applyMove(before, { id: "nope", levelId: "L1", index: 0 })).toBe(before);
  });
});

describe("reflects", () => {
  it("is true once the data shows the space at the target index", () => {
    const move = { id: "a", levelId: "L1", index: 2 };
    expect(reflects(tree(), move)).toBe(false);
    expect(reflects(applyMove(tree(), move), move)).toBe(true);
  });

  it("is false when the level is missing", () => {
    expect(reflects(tree(), { id: "a", levelId: "nope", index: 0 })).toBe(false);
  });
});
