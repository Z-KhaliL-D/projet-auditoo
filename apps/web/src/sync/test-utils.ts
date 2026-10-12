import type { PullResponse, PushResponse } from "@auditoo/shared";
import { vi } from "vitest";
import type { Transport } from "./http";

// Every method stays a vi.fn, so tests can assert on calls even when it is overridden.
export function fakeTransport(overrides: Partial<Transport> = {}) {
  return {
    push: vi.fn<Transport["push"]>(
      overrides.push ?? (async (ops): Promise<PushResponse> => ({ applied: ops.map((o) => o.opId), skipped: [] })),
    ),
    pull: vi.fn<Transport["pull"]>(
      overrides.pull ?? (async (): Promise<PullResponse> => ({ levels: [], spaces: [], cursor: 0 })),
    ),
  };
}

// Timers the test advances by hand. Vitest fake timers would also freeze fake-indexeddb.
export function manualScheduler() {
  let now = 0;
  let nextId = 0;
  let tasks: { id: number; at: number; fn: () => void }[] = [];
  return {
    schedule(fn: () => void, ms: number) {
      const id = ++nextId;
      tasks.push({ id, at: now + ms, fn });
      return () => {
        tasks = tasks.filter((t) => t.id !== id);
      };
    },
    advance(ms: number) {
      const end = now + ms;
      for (;;) {
        const due = tasks.filter((t) => t.at <= end).sort((a, b) => a.at - b.at)[0];
        if (!due) break;
        tasks = tasks.filter((t) => t !== due);
        now = due.at;
        due.fn();
      }
      now = end;
    },
    pending: () => tasks.length,
  };
}
