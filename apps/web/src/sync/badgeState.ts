import type { SyncState } from "./engine";

export type BadgeState = {
  kind: "error" | "offline" | "syncing" | "pending" | "synced";
  pending: number;
  rejected: number;
};

// Error beats offline, then syncing, then pending. Any rejected op is an error
// because its dependent ops may exist on this device only.
export function deriveBadgeState(state: SyncState, pending: number, rejected: number): BadgeState {
  const kind =
    rejected > 0 || state.failed
      ? "error"
      : !state.online
        ? "offline"
        : state.syncing
          ? "syncing"
          : pending > 0
            ? "pending"
            : "synced";
  return { kind, pending, rejected };
}
