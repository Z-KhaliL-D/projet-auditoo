import type { Level, Space } from "@auditoo/shared";
import { describe, expect, it } from "vitest";
import { type Move, applyMove, reflects, resolveDrop } from "./drop";
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

describe("resolveDrop for spaces", () => {
  it("moves a space down to the index of the one it was dropped on", () => {
    expect(resolveDrop(tree(), "space", "a", "c")).toEqual({ kind: "space", id: "a", levelId: "L1", index: 2 });
  });

  it("moves a space up", () => {
    expect(resolveDrop(tree(), "space", "c", "a")).toEqual({ kind: "space", id: "c", levelId: "L1", index: 0 });
  });

  it("returns null when dropped on itself, so no op is written", () => {
    expect(resolveDrop(tree(), "space", "b", "b")).toBeNull();
  });

  it("returns null when the dragged space no longer exists", () => {
    expect(resolveDrop(tree(), "space", "gone", "a")).toBeNull();
  });

  it("returns null when the drop target is not a space of the same level", () => {
    expect(resolveDrop(tree(), "space", "a", "x")).toBeNull();
    expect(resolveDrop(tree(), "space", "a", "unknown")).toBeNull();
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

  it("moves across levels, including into an empty one", () => {
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
    expect(resolveDrop(tree(), "level", "L1", "L3")).toEqual({ kind: "level", id: "L1", index: 2 });
    expect(resolveDrop(tree(), "level", "L3", "L1")).toEqual({ kind: "level", id: "L3", index: 0 });
  });

  it("returns null for the same position, a missing level, or a space as the target", () => {
    expect(resolveDrop(tree(), "level", "L2", "L2")).toBeNull();
    expect(resolveDrop(tree(), "level", "gone", "L1")).toBeNull();
    expect(resolveDrop(tree(), "level", "L1", "a")).toBeNull();
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
