import { liveQuery } from "dexie";
import type { AuditooDb } from "@/data/db";
import { OfflineError, type Transport } from "./http";
import { pullFromServer } from "./pull";
import { pushOutbox } from "./push";

export type SyncState = { syncing: boolean; online: boolean; failed: boolean };

type Schedule = (fn: () => void, ms: number) => () => void;

type Deps = {
  db: AuditooDb;
  transport: Transport;
  debounceMs?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  pollMs?: number;
  random?: () => number;
  schedule?: Schedule;
};

const defaultSchedule: Schedule = (fn, ms) => {
  const id = setTimeout(fn, ms);
  return () => clearTimeout(id);
};

export function createSyncEngine(deps: Deps) {
  const { db, transport, debounceMs = 1000, baseDelayMs = 2000, maxDelayMs = 60_000, pollMs = 30_000 } = deps;
  const random = deps.random ?? Math.random;
  const schedule = deps.schedule ?? defaultSchedule;

  let state: SyncState = { syncing: false, online: true, failed: false };
  const listeners = new Set<() => void>();
  let running: Promise<void> | null = null;
  let dirty = false;
  let attempts = 0;
  let cancelTimer: (() => void) | null = null;
  let pollScheduled = false;
  let teardown: (() => void)[] = [];

  function setState(patch: Partial<SyncState>) {
    state = { ...state, ...patch };
    listeners.forEach((l) => l());
  }

  function clearTimer() {
    cancelTimer?.();
    cancelTimer = null;
    pollScheduled = false;
  }

  function later(ms: number, isPoll = false) {
    clearTimer();
    pollScheduled = isPoll;
    cancelTimer = schedule(() => {
      cancelTimer = null;
      pollScheduled = false;
      void trigger();
    }, ms);
  }

  const jitter = () => 0.8 + random() * 0.4;

  function retryLater() {
    const delay = Math.min(maxDelayMs, baseDelayMs * 2 ** attempts) * jitter();
    attempts += 1;
    later(delay);
  }

  async function cycle() {
    setState({ syncing: true });
    let ok = true;
    do {
      dirty = false;
      try {
        await pushOutbox(db, transport);
        await pullFromServer(db, transport);
        attempts = 0;
        setState({ online: true, failed: false });
      } catch (err) {
        ok = false;
        // Any failed request means offline, whatever navigator.onLine says.
        setState(err instanceof OfflineError ? { online: false, failed: false } : { online: true, failed: true });
        retryLater();
        break;
      }
    } while (dirty);
    // Poll only after a success (a failure has its own backoff timer), only while the
    // page is visible, and never over a timer set meanwhile, such as a change debounce.
    if (ok && !cancelTimer && document.visibilityState === "visible") later(pollMs * jitter(), true);
    setState({ syncing: false });
  }

  // Runs now, bypassing any retry delay. A call during a run asks for one more pass.
  function trigger(): Promise<void> {
    clearTimer();
    if (running) {
      dirty = true;
      return running;
    }
    running = cycle().finally(() => {
      running = null;
    });
    return running;
  }

  function start() {
    if (teardown.length > 0) return;
    const onTrigger = () => void trigger();
    const onVisible = () => {
      if (document.visibilityState === "visible") void trigger();
      else if (pollScheduled) clearTimer();
    };
    window.addEventListener("online", onTrigger);
    window.addEventListener("focus", onTrigger);
    document.addEventListener("visibilitychange", onVisible);

    // Only a growing outbox means a new change; entries leaving it must not re-trigger.
    let previous: number | undefined;
    const subscription = liveQuery(() => db.outbox.count()).subscribe({
      next(count) {
        if (previous !== undefined && count > previous) later(debounceMs);
        previous = count;
      },
    });

    teardown = [
      () => window.removeEventListener("online", onTrigger),
      () => window.removeEventListener("focus", onTrigger),
      () => document.removeEventListener("visibilitychange", onVisible),
      () => subscription.unsubscribe(),
      clearTimer,
    ];
    void trigger();
  }

  function stop() {
    teardown.forEach((fn) => fn());
    teardown = [];
  }

  return {
    start,
    stop,
    trigger,
    idle: (): Promise<void> => running ?? Promise.resolve(),
    getSnapshot: (): SyncState => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}

export type SyncEngine = ReturnType<typeof createSyncEngine>;
