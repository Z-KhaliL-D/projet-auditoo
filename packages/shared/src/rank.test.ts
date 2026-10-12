import { describe, expect, it } from "vitest";
import { compareByRank } from "./rank";

describe("compareByRank", () => {
  it("sorts by rank first", () => {
    const items = [
      { id: "a", rank: "b" },
      { id: "z", rank: "a" },
    ];
    expect(items.sort(compareByRank).map((i) => i.id)).toEqual(["z", "a"]);
  });

  it("breaks rank ties by id", () => {
    const items = [
      { id: "b", rank: "a0" },
      { id: "a", rank: "a0" },
    ];
    expect(items.sort(compareByRank).map((i) => i.id)).toEqual(["a", "b"]);
  });

  it("compares by code unit so uppercase sorts before lowercase", () => {
    expect(compareByRank({ id: "1", rank: "Zz" }, { id: "2", rank: "a0" })).toBeLessThan(0);
  });

  it("returns 0 for identical items", () => {
    const item = { id: "a", rank: "a0" };
    expect(compareByRank(item, { ...item })).toBe(0);
  });
});
