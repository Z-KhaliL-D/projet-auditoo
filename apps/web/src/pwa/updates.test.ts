// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type UpdatableWorker, watchForUpdates } from "./updates";

type Listener = (event: { isUpdate?: boolean }) => void;

function fakeWorker() {
  const listeners: Record<string, Listener> = {};
  const worker = {
    addEventListener: (type: string, listener: Listener) => {
      listeners[type] = listener;
    },
    update: vi.fn(async () => {}),
    messageSkipWaiting: vi.fn(),
  } satisfies UpdatableWorker & Record<string, unknown>;
  return { worker, emit: (type: string, event: { isUpdate?: boolean } = {}) => listeners[type](event) };
}

let visibility: "visible" | "hidden" = "visible";
function changeVisibility(state: "visible" | "hidden") {
  visibility = state;
  document.dispatchEvent(new Event("visibilitychange"));
}

beforeEach(() => {
  visibility = "visible";
  vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);
});
afterEach(() => vi.restoreAllMocks());

const MIN = 60_000;

describe("update prompt", () => {
  it("notifies when a version is waiting, and applying it asks the worker to take over", () => {
    const { worker, emit } = fakeWorker();
    const notify = vi.fn();
    watchForUpdates({ worker, notify, reload: vi.fn() });

    emit("waiting");

    expect(notify).toHaveBeenCalledTimes(1);
    expect(worker.messageSkipWaiting).not.toHaveBeenCalled();
    notify.mock.calls[0][0]();
    expect(worker.messageSkipWaiting).toHaveBeenCalledTimes(1);
  });

  it("never switches by itself", () => {
    const { worker, emit } = fakeWorker();
    watchForUpdates({ worker, notify: vi.fn(), reload: vi.fn() });
    emit("waiting");
    expect(worker.messageSkipWaiting).not.toHaveBeenCalled();
  });
});

describe("reload after an update", () => {
  it("reloads when a new version takes control", () => {
    const { worker, emit } = fakeWorker();
    const reload = vi.fn();
    watchForUpdates({ worker, notify: vi.fn(), reload });

    emit("controlling", { isUpdate: true });

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("does not reload on the very first install", () => {
    const { worker, emit } = fakeWorker();
    const reload = vi.fn();
    watchForUpdates({ worker, notify: vi.fn(), reload });

    emit("controlling", { isUpdate: false });
    emit("controlling", {});

    expect(reload).not.toHaveBeenCalled();
  });
});

describe("checking for updates in a long-open app", () => {
  function setup() {
    const { worker } = fakeWorker();
    let time = 0;
    watchForUpdates({ worker, notify: vi.fn(), reload: vi.fn(), now: () => time });
    return { worker, advance: (ms: number) => (time += ms) };
  }

  it("checks when the page becomes visible after 15 minutes", () => {
    const { worker, advance } = setup();
    advance(15 * MIN);
    changeVisibility("visible");
    expect(worker.update).toHaveBeenCalledTimes(1);
  });

  it("does not check more often than every 15 minutes", () => {
    const { worker, advance } = setup();
    advance(15 * MIN);
    changeVisibility("visible");
    advance(14 * MIN);
    changeVisibility("visible");
    expect(worker.update).toHaveBeenCalledTimes(1);

    advance(1 * MIN);
    changeVisibility("visible");
    expect(worker.update).toHaveBeenCalledTimes(2);
  });

  it("does not check when it was checked recently at start", () => {
    const { worker, advance } = setup();
    advance(5 * MIN);
    changeVisibility("visible");
    expect(worker.update).not.toHaveBeenCalled();
  });

  it("does not check when the page is hidden", () => {
    const { worker, advance } = setup();
    advance(60 * MIN);
    changeVisibility("hidden");
    expect(worker.update).not.toHaveBeenCalled();
  });

  it("ignores a failed check, as happens offline", async () => {
    const { worker, advance } = setup();
    worker.update.mockRejectedValue(new TypeError("offline"));
    advance(15 * MIN);

    changeVisibility("visible");
    await Promise.resolve();

    expect(worker.update).toHaveBeenCalledTimes(1);
  });
});
