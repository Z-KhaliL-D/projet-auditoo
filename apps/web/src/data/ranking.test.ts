import { describe, expect, it } from "vitest";
import { rankAt } from "./ranking";

describe("rankAt", () => {
  it("returns a rank for an empty list", () => {
    expect(rankAt([])).toBe("a0");
  });

  it("appends at the end by default", () => {
    const rank = rankAt([{ id: "1", rank: "a0" }]);
    expect(rank > "a0").toBe(true);
  });

  it("places between two siblings", () => {
    const siblings = [{ id: "1", rank: "a0" }, { id: "2", rank: "a1" }];
    const rank = rankAt(siblings, 1);
    expect(rank > "a0" && rank < "a1").toBe(true);
  });

  it("places at the start", () => {
    const rank = rankAt([{ id: "1", rank: "a0" }], 0);
    expect(rank < "a0").toBe(true);
  });

  it("clamps an out-of-range index", () => {
    const siblings = [{ id: "1", rank: "a0" }];
    expect(rankAt(siblings, 99) > "a0").toBe(true);
    expect(rankAt(siblings, -5) < "a0").toBe(true);
  });

  it("does not throw when siblings share a rank", () => {
    const siblings = [{ id: "1", rank: "a0" }, { id: "2", rank: "a0" }, { id: "3", rank: "a1" }];
    const rank = rankAt(siblings, 1);
    expect(rank > "a0" && rank < "a1").toBe(true);
  });
});
