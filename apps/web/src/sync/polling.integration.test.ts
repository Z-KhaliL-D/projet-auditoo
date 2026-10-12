// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import { createLevel } from "@/data/levels";
import { testDb } from "@/data/test-utils";
import { type SyncEngine, createSyncEngine } from "./engine";
import { device, server } from "./test-server";
import { manualScheduler } from "./test-utils";

let engine: SyncEngine | undefined;
afterEach(() => engine?.stop());

it("an idle device receives another device's change without any local action", async () => {
  const transport = server();
  const scheduler = manualScheduler();
  const idle = { db: testDb() };
  engine = createSyncEngine({ db: idle.db, transport, schedule: scheduler.schedule, random: () => 0.5 });
  engine.start();
  await engine.idle();
  expect(await idle.db.levels.count()).toBe(0);

  const other = device(transport);
  await createLevel(other.db, "From the other device");
  await other.sync();

  scheduler.advance(30_000);
  await engine.idle();

  expect((await idle.db.levels.toArray()).map((l) => l.name)).toEqual(["From the other device"]);
});
