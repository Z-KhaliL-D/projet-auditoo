import { describe, expect, it } from "vitest";
import {
  cursorSchema,
  levelSchema,
  opSchema,
  pullResponseSchema,
  pushRequestSchema,
  pushResponseSchema,
  spaceSchema,
} from "./index";

const id = () => crypto.randomUUID();

const level = { id: id(), name: "Ground floor", rank: "a0", updatedAt: 1, deletedAt: null };

describe("levelSchema", () => {
  it("accepts a valid level", () => {
    expect(levelSchema.parse(level)).toEqual(level);
  });

  it("trims the name", () => {
    expect(levelSchema.parse({ ...level, name: "  Attic  " }).name).toBe("Attic");
  });

  it("rejects empty, blank and too long names", () => {
    expect(levelSchema.safeParse({ ...level, name: "" }).success).toBe(false);
    expect(levelSchema.safeParse({ ...level, name: "   " }).success).toBe(false);
    expect(levelSchema.safeParse({ ...level, name: "x".repeat(81) }).success).toBe(false);
    expect(levelSchema.safeParse({ ...level, name: "x".repeat(80) }).success).toBe(true);
  });

  it("rejects a non-uuid id and a missing deletedAt", () => {
    expect(levelSchema.safeParse({ ...level, id: "nope" }).success).toBe(false);
    const { deletedAt: _, ...rest } = level;
    expect(levelSchema.safeParse(rest).success).toBe(false);
  });

  it("accepts a numeric deletedAt", () => {
    expect(levelSchema.safeParse({ ...level, deletedAt: 5 }).success).toBe(true);
  });
});

describe("spaceSchema", () => {
  const space = { ...level, id: id(), levelId: id() };

  it("accepts a valid space", () => {
    expect(spaceSchema.parse(space)).toEqual(space);
  });

  it("requires a uuid levelId", () => {
    expect(spaceSchema.safeParse({ ...space, levelId: "x" }).success).toBe(false);
    const { levelId: _, ...rest } = space;
    expect(spaceSchema.safeParse(rest).success).toBe(false);
  });
});

describe("opSchema", () => {
  const meta = () => ({ opId: id(), createdAt: 1 });
  const valid = [
    { type: "level.create", payload: { id: id(), name: "L", rank: "a0" } },
    { type: "level.rename", payload: { id: id(), name: "L" } },
    { type: "level.move", payload: { id: id(), rank: "a1" } },
    { type: "level.delete", payload: { id: id() } },
    { type: "space.create", payload: { id: id(), levelId: id(), name: "S", rank: "a0" } },
    { type: "space.rename", payload: { id: id(), name: "S" } },
    { type: "space.move", payload: { id: id(), levelId: id(), rank: "a1" } },
    { type: "space.delete", payload: { id: id() } },
  ];

  it.each(valid)("accepts $type", (op) => {
    expect(opSchema.safeParse({ ...meta(), ...op }).success).toBe(true);
  });

  it("rejects an unknown type", () => {
    expect(opSchema.safeParse({ ...meta(), type: "level.explode", payload: {} }).success).toBe(false);
  });

  it("rejects a payload that does not match the type", () => {
    const op = { ...meta(), type: "space.move", payload: { id: id(), rank: "a1" } };
    expect(opSchema.safeParse(op).success).toBe(false);
  });

  it("requires opId and createdAt", () => {
    expect(opSchema.safeParse({ type: "level.delete", payload: { id: id() } }).success).toBe(false);
  });

  it("trims names inside payloads", () => {
    const parsed = opSchema.parse({ ...meta(), type: "level.rename", payload: { id: id(), name: " A " } });
    expect(parsed.type === "level.rename" && parsed.payload.name).toBe("A");
  });
});

describe("cursorSchema", () => {
  it("accepts non-negative integers only", () => {
    expect(cursorSchema.safeParse(0).success).toBe(true);
    expect(cursorSchema.safeParse(42).success).toBe(true);
    expect(cursorSchema.safeParse(-1).success).toBe(false);
    expect(cursorSchema.safeParse(1.5).success).toBe(false);
  });
});

describe("sync schemas", () => {
  it("validates a push request", () => {
    const op = { opId: id(), createdAt: 1, type: "level.delete", payload: { id: id() } };
    expect(pushRequestSchema.safeParse({ ops: [op] }).success).toBe(true);
    expect(pushRequestSchema.safeParse({ ops: [{ ...op, type: "bad" }] }).success).toBe(false);
  });

  it("validates a push response", () => {
    expect(pushResponseSchema.safeParse({ applied: [id()], skipped: [] }).success).toBe(true);
    expect(pushResponseSchema.safeParse({ applied: ["x"], skipped: [] }).success).toBe(false);
  });

  it("validates a pull response", () => {
    const space = { ...level, id: id(), levelId: level.id };
    expect(pullResponseSchema.safeParse({ levels: [level], spaces: [space], cursor: 0 }).success).toBe(true);
    expect(pullResponseSchema.safeParse({ levels: [], spaces: [] }).success).toBe(false);
  });
});
