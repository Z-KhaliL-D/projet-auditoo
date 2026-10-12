import { describe, expect, it } from "vitest";
import { getCursor, setCursor } from "./meta";
import { testDb } from "./test-utils";

describe("cursor", () => {
  it("defaults to 0", async () => {
    expect(await getCursor(testDb())).toBe(0);
  });

  it("stores and overwrites the cursor", async () => {
    const db = testDb();
    await setCursor(db, 5);
    await setCursor(db, 9);
    expect(await getCursor(db)).toBe(9);
  });
});
