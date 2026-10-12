import { useEffect, useMemo, useRef, useState } from "react";
import { db } from "@/data/db";
import { moveSpace } from "@/data/spaces";
import { type SpaceMove, applyMove, reflects } from "./drop";
import type { LevelWithSpaces } from "./useLevelTree";

type Pending = { move: SpaceMove; token: number; settled: boolean };

const GIVE_UP_MS = 500;

// Dexie delivers the new order a moment after the drop. Until it does, the dropped
// order is shown so the row does not snap back for a frame. If the write turns out to
// change nothing, the override is dropped shortly after the write finishes.
export function useOptimisticMove(levels: LevelWithSpaces[] | undefined) {
  const [pending, setPending] = useState<Pending | null>(null);
  const counter = useRef(0);

  useEffect(() => {
    if (!pending || !levels) return;
    if (reflects(levels, pending.move)) {
      setPending(null);
      return;
    }
    if (!pending.settled) return;
    const timer = setTimeout(() => setPending(null), GIVE_UP_MS);
    return () => clearTimeout(timer);
  }, [levels, pending]);

  const shown = useMemo(
    () => (levels && pending ? applyMove(levels, pending.move) : levels),
    [levels, pending],
  );

  function commit(move: SpaceMove) {
    const token = ++counter.current;
    setPending({ move, token, settled: false });
    void moveSpace(db, move.id, move.levelId, move.index).finally(() =>
      setPending((p) => (p?.token === token ? { ...p, settled: true } : p)),
    );
  }

  return { levels: shown, commit };
}
