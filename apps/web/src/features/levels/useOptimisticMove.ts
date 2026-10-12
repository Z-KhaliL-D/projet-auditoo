import { useEffect, useMemo, useRef, useState } from "react";
import { db } from "@/data/db";
import { moveLevel } from "@/data/levels";
import { moveSpace } from "@/data/spaces";
import { type Move, applyMove, reflects } from "./drop";
import type { LevelWithSpaces } from "./useLevelTree";

type Pending = { move: Move; token: number; settled: boolean };

const GIVE_UP_MS = 500;

const sameMove = (a: Move | null, b: Move | null) => JSON.stringify(a) === JSON.stringify(b);

// Two layers on top of the stored data. `preview` follows a drag in progress, so a space
// shows up in the level it hovers. `pending` holds the dropped order until Dexie delivers
// it a moment later, so the row does not snap back for a frame. If the write turns out to
// change nothing, `pending` is dropped shortly after the write finishes.
export function useOptimisticMove(levels: LevelWithSpaces[] | undefined) {
  const [preview, setPreviewState] = useState<Move | null>(null);
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

  const shown = useMemo(() => {
    const move = preview ?? pending?.move;
    return levels && move ? applyMove(levels, move) : levels;
  }, [levels, preview, pending]);

  function setPreview(move: Move | null) {
    setPreviewState((current) => (sameMove(current, move) ? current : move));
  }

  function commit(move: Move) {
    const token = ++counter.current;
    setPreviewState(null);
    setPending({ move, token, settled: false });
    const write = move.kind === "level" ? moveLevel(db, move.id, move.index) : moveSpace(db, move.id, move.levelId, move.index);
    void write.finally(() =>
      setPending((p) => (p?.token === token ? { ...p, settled: true } : p)),
    );
  }

  return { levels: shown, commit, setPreview };
}
