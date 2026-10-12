// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createLevel } from "@/data/levels";
import { testDb } from "@/data/test-utils";
import { type SyncEngine, createSyncEngine } from "./engine";
import { OfflineError, ServerError } from "./http";
import { fakeTransport, manualScheduler } from "./test-utils";

let engine: SyncEngine | undefined;
afterEach(() => {
  engine?.stop();
  Reflect.deleteProperty(document, "visibilityState");
});

function setup(transport = fakeTransport(), random = () => 0.5) {
  const db = testDb();
  const scheduler = manualScheduler();
  engine = createSyncEngine({ db, transport, schedule: scheduler.schedule, random });
  return { db, scheduler, transport, engine };
}

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("sync engine", () => {
  it("syncs once on start", async () => {
    const { engine, transport } = setup();
    engine.start();
    await engine.idle();
    expect(transport.pull).toHaveBeenCalledTimes(1);
    expect(engine.getSnapshot()).toEqual({ syncing: false, online: true, failed: false });
  });

  it("syncs shortly after a change, once for a burst", async () => {
    const { db, engine, scheduler, transport } = setup();
    engine.start();
    await engine.idle();
    transport.push.mockClear();

    await createLevel(db, "A");
    await createLevel(db, "B");
    await vi.waitFor(() => expect(scheduler.pending()).toBe(1));
    scheduler.advance(999);
    expect(transport.push).not.toHaveBeenCalled();
    scheduler.advance(1);
    await engine.idle();

    expect(transport.push).toHaveBeenCalledTimes(1);
    expect(transport.push.mock.calls[0][0]).toHaveLength(2);
  });

  it("does not re-trigger when entries leave the outbox", async () => {
    const { db, engine, scheduler, transport } = setup();
    await createLevel(db, "A");
    engine.start();
    await engine.idle();
    await new Promise((r) => setTimeout(r, 20));
    const calls = transport.pull.mock.calls.length;

    scheduler.advance(29_999);
    await engine.idle();

    expect(transport.pull.mock.calls.length).toBe(calls);
    expect(scheduler.pending()).toBe(1);
  });

  it.each(["online", "focus"])("syncs on the window %s event", async (name) => {
    const { engine, transport } = setup();
    engine.start();
    await engine.idle();
    transport.pull.mockClear();

    window.dispatchEvent(new Event(name));
    await engine.idle();

    expect(transport.pull).toHaveBeenCalledTimes(1);
  });

  it("syncs when the page becomes visible", async () => {
    const { engine, transport } = setup();
    engine.start();
    await engine.idle();
    transport.pull.mockClear();

    document.dispatchEvent(new Event("visibilitychange"));
    await engine.idle();

    expect(transport.pull).toHaveBeenCalledTimes(1);
  });

  it("marks a request failure as offline and retries with growing delays", async () => {
    const { db, engine, scheduler, transport } = setup();
    await createLevel(db, "A");
    transport.push.mockRejectedValue(new OfflineError("down"));

    engine.start();
    await engine.idle();
    expect(engine.getSnapshot()).toEqual({ syncing: false, online: false, failed: false });
    expect(transport.push).toHaveBeenCalledTimes(1);

    scheduler.advance(1_999);
    expect(transport.push).toHaveBeenCalledTimes(1);
    scheduler.advance(1);
    await engine.idle();
    expect(transport.push).toHaveBeenCalledTimes(2);

    scheduler.advance(3_999);
    expect(transport.push).toHaveBeenCalledTimes(2);
    scheduler.advance(1);
    await engine.idle();
    expect(transport.push).toHaveBeenCalledTimes(3);

    scheduler.advance(8_000);
    await engine.idle();
    expect(transport.push).toHaveBeenCalledTimes(4);
  });

  it("caps the retry delay at 60 seconds", async () => {
    const { db, engine, scheduler, transport } = setup();
    await createLevel(db, "A");
    transport.push.mockRejectedValue(new OfflineError("down"));
    engine.start();
    await engine.idle();
    for (let i = 0; i < 8; i++) {
      scheduler.advance(60_000);
      await engine.idle();
    }
    const calls = transport.push.mock.calls.length;
    scheduler.advance(60_000);
    await engine.idle();
    expect(transport.push.mock.calls.length).toBe(calls + 1);
  });

  it("resets the delay and the status after a success", async () => {
    const { db, engine, scheduler, transport } = setup();
    await createLevel(db, "A");
    transport.push.mockRejectedValueOnce(new OfflineError("down"));
    engine.start();
    await engine.idle();
    scheduler.advance(2_000);
    await engine.idle();

    expect(engine.getSnapshot()).toEqual({ syncing: false, online: true, failed: false });
    expect(scheduler.pending()).toBe(1);
    scheduler.advance(2_000);
    await engine.idle();
    expect(transport.push).toHaveBeenCalledTimes(2);
  });

  it("reports a server error as failed, not offline, and retries", async () => {
    const { engine, scheduler, transport } = setup();
    transport.pull.mockRejectedValueOnce(new ServerError(500, "HTTP 500"));
    engine.start();
    await engine.idle();

    expect(engine.getSnapshot()).toEqual({ syncing: false, online: true, failed: true });
    scheduler.advance(2_000);
    await engine.idle();
    expect(engine.getSnapshot().failed).toBe(false);
  });

  it("a manual trigger bypasses the retry delay", async () => {
    const { db, engine, scheduler, transport } = setup();
    await createLevel(db, "A");
    transport.push.mockRejectedValueOnce(new OfflineError("down"));
    engine.start();
    await engine.idle();
    expect(scheduler.pending()).toBe(1);

    await engine.trigger();

    expect(transport.push).toHaveBeenCalledTimes(2);
    expect(engine.getSnapshot().online).toBe(true);
    expect(scheduler.pending()).toBe(1);
    scheduler.advance(1_999);
    await engine.idle();
    expect(transport.push).toHaveBeenCalledTimes(2);
  });

  it("runs one sync at a time and does one more pass for triggers during a run", async () => {
    const { engine, transport } = setup();
    let release!: () => void;
    transport.pull.mockImplementationOnce(
      () => new Promise((resolve) => (release = () => resolve({ levels: [], spaces: [], cursor: 0 }))),
    );

    const first = engine.trigger();
    await vi.waitFor(() => expect(release).toBeTypeOf("function"));
    void engine.trigger();
    void engine.trigger();
    expect(engine.getSnapshot().syncing).toBe(true);
    release();
    await first;

    expect(transport.pull).toHaveBeenCalledTimes(2);
  });

  it("stop removes the listeners", async () => {
    const { engine, transport } = setup();
    engine.start();
    await engine.idle();
    engine.stop();
    transport.pull.mockClear();

    window.dispatchEvent(new Event("online"));
    await engine.idle();

    expect(transport.pull).not.toHaveBeenCalled();
  });

  describe("periodic pull", () => {
    it("polls 30 seconds after a successful sync, and keeps polling", async () => {
      const { engine, scheduler, transport } = setup();
      engine.start();
      await engine.idle();
      transport.pull.mockClear();

      scheduler.advance(29_999);
      expect(transport.pull).not.toHaveBeenCalled();
      scheduler.advance(1);
      await engine.idle();
      expect(transport.pull).toHaveBeenCalledTimes(1);

      scheduler.advance(30_000);
      await engine.idle();
      expect(transport.pull).toHaveBeenCalledTimes(2);
    });

    it.each([
      [0, 24_000],
      [1, 36_000],
    ])("jitters the interval within 20 percent (random %i gives %i ms)", async (random, ms) => {
      const { engine, scheduler, transport } = setup(fakeTransport(), () => random);
      engine.start();
      await engine.idle();
      transport.pull.mockClear();

      scheduler.advance(ms - 1);
      expect(transport.pull).not.toHaveBeenCalled();
      // 2 ms of slack: 0.8 + 0.4 is not exactly 1.2 in floating point.
      scheduler.advance(2);
      await engine.idle();
      expect(transport.pull).toHaveBeenCalledTimes(1);
    });

    it("does not poll while the page is hidden, and resumes with an immediate sync", async () => {
      const { engine, scheduler, transport } = setup();
      setVisibility("hidden");
      engine.start();
      await engine.idle();
      expect(scheduler.pending()).toBe(0);
      transport.pull.mockClear();

      setVisibility("visible");
      await engine.idle();

      expect(transport.pull).toHaveBeenCalledTimes(1);
      expect(scheduler.pending()).toBe(1);
    });

    it("cancels a scheduled poll when the page becomes hidden", async () => {
      const { engine, scheduler, transport } = setup();
      engine.start();
      await engine.idle();
      expect(scheduler.pending()).toBe(1);
      transport.pull.mockClear();

      setVisibility("hidden");
      scheduler.advance(60_000);
      await engine.idle();

      expect(scheduler.pending()).toBe(0);
      expect(transport.pull).not.toHaveBeenCalled();
    });

    it("hands over to the backoff after a failure instead of polling", async () => {
      const { engine, scheduler, transport } = setup();
      transport.pull.mockRejectedValueOnce(new OfflineError("down"));
      engine.start();
      await engine.idle();
      expect(scheduler.pending()).toBe(1);
      transport.pull.mockClear();

      scheduler.advance(2_000);
      await engine.idle();

      expect(transport.pull).toHaveBeenCalledTimes(1);
    });

    it("keeps the change debounce when a change arrives during a sync", async () => {
      const { db, engine, scheduler, transport } = setup();
      engine.start();
      await engine.idle();
      let release!: () => void;
      transport.pull.mockImplementationOnce(
        () => new Promise((resolve) => (release = () => resolve({ levels: [], spaces: [], cursor: 0 }))),
      );
      const run = engine.trigger();
      await vi.waitFor(() => expect(release).toBeTypeOf("function"));
      await createLevel(db, "During");
      await vi.waitFor(() => expect(scheduler.pending()).toBe(1));
      release();
      await run;
      transport.push.mockClear();

      scheduler.advance(1_000);
      await engine.idle();

      expect(transport.push).toHaveBeenCalledTimes(1);
    });
  });
});
