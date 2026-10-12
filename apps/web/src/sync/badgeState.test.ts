import { describe, expect, it } from "vitest";
import { deriveBadgeState } from "./badgeState";

const state = (over = {}) => ({ syncing: false, online: true, failed: false, ...over });

describe("deriveBadgeState", () => {
  it("is synced when idle, online and empty", () => {
    expect(deriveBadgeState(state(), 0, 0).kind).toBe("synced");
  });

  it("shows pending changes", () => {
    expect(deriveBadgeState(state(), 3, 0)).toEqual({ kind: "pending", pending: 3, rejected: 0 });
  });

  it("shows syncing over pending", () => {
    expect(deriveBadgeState(state({ syncing: true }), 3, 0).kind).toBe("syncing");
  });

  it("shows offline over syncing and keeps the pending count", () => {
    expect(deriveBadgeState(state({ online: false, syncing: true }), 2, 0)).toEqual({
      kind: "offline",
      pending: 2,
      rejected: 0,
    });
  });

  it("shows an error for a failed sync", () => {
    expect(deriveBadgeState(state({ failed: true }), 0, 0).kind).toBe("error");
  });

  it("shows an error for any rejected op, even when otherwise synced or offline", () => {
    expect(deriveBadgeState(state(), 0, 1).kind).toBe("error");
    expect(deriveBadgeState(state({ online: false }), 0, 1).kind).toBe("error");
  });
});
