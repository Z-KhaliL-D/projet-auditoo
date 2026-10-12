import { describe, expect, it } from "vitest";
import { tick } from "./clock";

describe("tick", () => {
  it("never returns the same value twice", () => {
    const values = Array.from({ length: 1000 }, () => tick());
    expect(new Set(values).size).toBe(1000);
    expect([...values].sort((a, b) => a - b)).toEqual(values);
  });
});
