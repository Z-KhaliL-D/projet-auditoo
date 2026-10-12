import { describe, expect, it } from "vitest";
import { createLevel, renameLevel } from "@/data/levels";
import { testDb } from "@/data/test-utils";
import { OfflineError, ServerError } from "./http";
import { pushOutbox } from "./push";
import { fakeTransport } from "./test-utils";

const reject = () => new ServerError(400, "HTTP 400");

describe("pushOutbox", () => {
  it("sends ops in order and empties the outbox", async () => {
    const db = testDb();
    const { id } = await createLevel(db, "A");
    await renameLevel(db, id, "B");
    const transport = fakeTransport();

    await pushOutbox(db, transport);

    expect(transport.push.mock.calls[0][0].map((o) => o.type)).toEqual(["level.create", "level.rename"]);
    expect(await db.outbox.count()).toBe(0);
  });

  it("clears ops the server reports as skipped", async () => {
    const db = testDb();
    await createLevel(db, "A");
    const transport = fakeTransport({
      push: async (ops) => ({ applied: [], skipped: ops.map((o) => o.opId) }),
    });
    await pushOutbox(db, transport);
    expect(await db.outbox.count()).toBe(0);
  });

  it("keeps the outbox when the request fails", async () => {
    const db = testDb();
    await createLevel(db, "A");
    const transport = fakeTransport({ push: async () => Promise.reject(new OfflineError("down")) });

    await expect(pushOutbox(db, transport)).rejects.toBeInstanceOf(OfflineError);

    expect(await db.outbox.count()).toBe(1);
  });

  it("keeps the outbox on a 5xx", async () => {
    const db = testDb();
    await createLevel(db, "A");
    const transport = fakeTransport({ push: async () => Promise.reject(new ServerError(500, "HTTP 500")) });
    await expect(pushOutbox(db, transport)).rejects.toBeInstanceOf(ServerError);
    expect(await db.outbox.count()).toBe(1);
  });

  it("throws instead of looping when the server acknowledges nothing", async () => {
    const db = testDb();
    await createLevel(db, "A");
    const transport = fakeTransport({ push: async () => ({ applied: [], skipped: [] }) });
    await expect(pushOutbox(db, transport)).rejects.toBeInstanceOf(ServerError);
    expect(await db.outbox.count()).toBe(1);
  });

  it("sends at most 100 ops per request", async () => {
    const db = testDb();
    for (let i = 0; i < 120; i++) {
      const op = { opId: crypto.randomUUID(), createdAt: i, type: "level.delete", payload: { id: crypto.randomUUID() } } as const;
      await db.outbox.add({ opId: op.opId, op });
    }
    const transport = fakeTransport();
    await pushOutbox(db, transport);
    expect(transport.push.mock.calls.map((c) => c[0].length)).toEqual([100, 20]);
  });

  describe("a 400", () => {
    it("quarantines only the bad op and still sends the rest", async () => {
      const db = testDb();
      const a = await createLevel(db, "A");
      const bad = (await db.outbox.toCollection().first())!;
      await renameLevel(db, a.id, "B");
      // The bad op is the create; the server refuses any batch or single op containing it.
      const transport = fakeTransport({
        push: async (ops) => {
          if (ops.some((o) => o.opId === bad.opId)) throw reject();
          return { applied: ops.map((o) => o.opId), skipped: [] };
        },
      });

      await pushOutbox(db, transport);

      expect(await db.outbox.count()).toBe(0);
      const rejected = await db.rejected.toArray();
      expect(rejected).toHaveLength(1);
      expect(rejected[0]).toMatchObject({ opId: bad.opId, reason: "HTTP 400" });
      expect(rejected[0].op).toEqual(bad.op);
      const sentAlone = transport.push.mock.calls.map((c) => c[0].map((o) => o.type));
      expect(sentAlone).toEqual([["level.create", "level.rename"], ["level.create"], ["level.rename"]]);
    });

    it("stops at a transient failure while isolating and keeps the remaining ops", async () => {
      const db = testDb();
      const a = await createLevel(db, "A");
      await renameLevel(db, a.id, "B");
      let calls = 0;
      const transport = fakeTransport({
        push: async () => {
          calls += 1;
          if (calls === 1) throw reject();
          throw new OfflineError("down");
        },
      });

      await expect(pushOutbox(db, transport)).rejects.toBeInstanceOf(OfflineError);

      expect(await db.outbox.count()).toBe(2);
      expect(await db.rejected.count()).toBe(0);
    });
  });
});
