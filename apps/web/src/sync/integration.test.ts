// @vitest-environment jsdom
// Two devices talking to the real API app (in-memory SQLite) through the real sync engine.
import { describe, expect, it } from "vitest";
import { createLevel, deleteLevel, renameLevel, restoreLevel } from "@/data/levels";
import { createSpace, deleteSpace } from "@/data/spaces";
import { testDb } from "@/data/test-utils";
import { createSyncEngine } from "./engine";
import { OfflineError, httpTransport, type Transport } from "./http";
import { device, server } from "./test-server";

describe("two devices through the real API", () => {
  it("converge on identical rows after syncing", async () => {
    const transport = server();
    const a = device(transport);
    const b = device(transport);
    const level = await createLevel(a.db, "Ground");
    await createSpace(a.db, level.id, "Kitchen");

    await a.sync();
    await b.sync();
    await a.sync();

    expect(await b.db.levels.toArray()).toEqual(await a.db.levels.toArray());
    expect(await b.db.spaces.toArray()).toEqual(await a.db.spaces.toArray());
    expect(await b.db.spaces.count()).toBe(1);
  });

  it("undo on another device matches the cascade through deletedAt", async () => {
    const transport = server();
    const a = device(transport);
    const b = device(transport);
    const level = await createLevel(a.db, "Ground");
    const kept = (await createSpace(a.db, level.id, "Kept"))!;
    const gone = (await createSpace(a.db, level.id, "Gone"))!;
    await deleteSpace(a.db, gone.id);
    await deleteLevel(a.db, level.id);
    await a.sync();

    await b.sync();
    const deletedLevel = (await b.db.levels.get(level.id))!;
    expect((await b.db.spaces.get(kept.id))?.deletedAt).toBe(deletedLevel.deletedAt);
    expect((await b.db.spaces.get(gone.id))?.deletedAt).not.toBe(deletedLevel.deletedAt);

    await restoreLevel(b.db, level.id);
    expect((await b.db.spaces.get(kept.id))?.deletedAt).toBeNull();
    expect((await b.db.spaces.get(gone.id))?.deletedAt).not.toBeNull();
    await b.sync();
    await a.sync();

    expect((await a.db.levels.get(level.id))?.deletedAt).toBeNull();
    expect((await a.db.spaces.get(kept.id))?.deletedAt).toBeNull();
    expect((await a.db.spaces.get(gone.id))?.deletedAt).not.toBeNull();
  });

  it("a pull never overwrites a pending change, and the device still converges", async () => {
    const transport = server();
    const a = device(transport);
    const b = device(transport);
    const level = await createLevel(a.db, "Ground");
    await a.sync();
    await b.sync();

    // A deletes the level. B renames it offline, then syncs.
    await deleteLevel(a.db, level.id);
    await a.sync();
    await renameLevel(b.db, level.id, "Mine");
    const offline = httpTransport((async () => Promise.reject(new TypeError("down"))) as typeof fetch);
    const bOffline = createSyncEngine({ db: b.db, transport: offline, schedule: () => () => {} });
    await bOffline.trigger();
    expect((await b.db.levels.get(level.id))?.name).toBe("Mine");

    await b.sync();

    // The rename was a no-op on the server (delete wins), and B received the delete.
    const final = (await b.db.levels.get(level.id))!;
    expect(final.deletedAt).not.toBeNull();
    expect(final.name).toBe("Ground");
    expect(await b.db.outbox.count()).toBe(0);
  });

  it("keeps a pending edit during the first pull, which does not advance the cursor", async () => {
    const transport = server();
    const a = device(transport);
    const b = device(transport);
    const level = await createLevel(a.db, "Ground");
    await a.sync();
    await b.sync();
    await renameLevel(a.db, level.id, "Theirs");
    await a.sync();

    await renameLevel(b.db, level.id, "Mine");
    const pullOnly: Transport = { push: async () => Promise.reject(new OfflineError("down")), pull: transport.pull };
    await createSyncEngine({ db: b.db, transport: pullOnly, schedule: () => () => {} }).trigger();

    expect((await b.db.levels.get(level.id))?.name).toBe("Mine");
  });

  it("quarantines a refused op and still delivers the rest", async () => {
    const transport = server();
    const a = device(transport);
    const b = device(transport);
    await addBadOp(a.db);
    const level = await createLevel(a.db, "Ground");

    await a.sync();

    expect(await a.db.outbox.count()).toBe(0);
    expect(await a.db.rejected.count()).toBe(1);
    await b.sync();
    expect((await b.db.levels.get(level.id))?.name).toBe("Ground");
  });

  it("re-sends ops after a lost response without duplicating them", async () => {
    const real = server();
    let dropNext = true;
    const flaky: Transport = {
      pull: real.pull,
      push: async (ops) => {
        const res = await real.push(ops);
        if (dropNext) {
          dropNext = false;
          throw new OfflineError("response lost");
        }
        return res;
      },
    };
    const a = device(flaky);
    const b = device(real);
    const level = await createLevel(a.db, "Ground");

    await a.sync();
    expect(await a.db.outbox.count()).toBe(1);
    await a.sync();

    expect(await a.db.outbox.count()).toBe(0);
    await b.sync();
    expect(await b.db.levels.count()).toBe(1);
    expect((await b.db.levels.get(level.id))?.name).toBe("Ground");
  });
});

// Ops are validated before they enter the outbox, so a bad one has to be forced in.
async function addBadOp(db: ReturnType<typeof testDb>) {
  const opId = crypto.randomUUID();
  await db.outbox.add({ opId, op: { opId, createdAt: 1, type: "level.explode", payload: {} } as never });
}
