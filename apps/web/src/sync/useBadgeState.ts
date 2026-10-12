import { useLiveQuery } from "dexie-react-hooks";
import { useSyncExternalStore } from "react";
import { db } from "@/data/db";
import { type BadgeState, deriveBadgeState } from "./badgeState";
import { syncEngine } from "./instance";

export function useBadgeState(): BadgeState {
  const state = useSyncExternalStore(syncEngine.subscribe, syncEngine.getSnapshot);
  const pending = useLiveQuery(() => db.outbox.count(), [], 0);
  const rejected = useLiveQuery(() => db.rejected.count(), [], 0);
  return deriveBadgeState(state, pending, rejected);
}
