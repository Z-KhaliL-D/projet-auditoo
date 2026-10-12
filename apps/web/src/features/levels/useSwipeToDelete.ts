import { type CSSProperties, type PointerEvent, useEffect, useRef, useState } from "react";
import { IDLE, type SwipeConfig, type SwipeState, endSwipe, isArmed, moveSwipe, startSwipe } from "./swipe";

const LEAVE_MS = 150;

type Options = { config: SwipeConfig; enabled: boolean; onDelete: () => unknown };

// Attach `handlers` to the part of the row that starts a swipe (touch-action: pan-y keeps
// vertical scrolling with the browser), `rowRef` to the element whose width sets the
// thresholds, and apply `contentStyle` to the part that slides.
export function useSwipeToDelete({ config, enabled, onDelete }: Options) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<SwipeState>(IDLE);
  const [leaving, setLeaving] = useState(false);
  const width = useRef(0);
  const swiped = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const swiping = state.phase === "swiping";
  const reduceMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function leave() {
    setLeaving(true);
    timer.current = setTimeout(
      () => {
        // If the delete fails the row comes back; on success the live query removes it.
        Promise.resolve(onDelete()).catch(() => setLeaving(false));
      },
      reduceMotion ? 0 : LEAVE_MS,
    );
  }

  const handlers = {
    onPointerDown(e: PointerEvent<HTMLElement>) {
      if (!enabled || leaving || (e.pointerType === "mouse" && e.button !== 0)) return;
      width.current = rowRef.current?.getBoundingClientRect().width ?? 0;
      swiped.current = false;
      setState(startSwipe(e.clientX, e.clientY));
    },
    onPointerMove(e: PointerEvent<HTMLElement>) {
      const next = moveSwipe(state, { x: e.clientX, y: e.clientY, time: e.timeStamp }, width.current);
      if (next === state) return;
      if (state.phase === "pending" && next.phase === "swiping") {
        e.currentTarget.setPointerCapture(e.pointerId);
        swiped.current = true;
      }
      setState(next);
    },
    onPointerUp(e: PointerEvent<HTMLElement>) {
      const decision = endSwipe(state, width.current, config, e.timeStamp);
      if (swiping) e.currentTarget.releasePointerCapture(e.pointerId);
      setState(IDLE);
      if (decision === "delete") leave();
    },
    // The browser takes over for scrolling: let go and spring back.
    onPointerCancel() {
      setState(IDLE);
    },
    // A swipe must not also count as a tap, for example on the level's collapse button.
    onClickCapture(e: React.MouseEvent) {
      if (!swiped.current) return;
      e.preventDefault();
      e.stopPropagation();
      swiped.current = false;
    },
  };

  const offset = leaving ? -width.current : swiping ? state.offset : 0;
  const contentStyle: CSSProperties = {
    transform: offset === 0 ? undefined : `translateX(${offset}px)`,
    transition: swiping || reduceMotion ? "none" : `transform ${LEAVE_MS}ms ease-out`,
  };

  return {
    rowRef,
    handlers,
    contentStyle,
    showBackground: swiping || leaving,
    armed: leaving || isArmed(state, width.current, config),
  };
}
