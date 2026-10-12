import { type RefObject, useLayoutEffect, useRef } from "react";

type Snapshot = { top: number; scrollHeight: number };

// Folding every level shortens the page under the finger. To keep the carried level where
// it was on screen, the page keeps its length with extra bottom padding (so the scroll
// position stays reachable) and scrolls by however far the level moved.
export function foldAdjustment(before: Snapshot, after: Snapshot): { padding: number; scroll: number } {
  return { padding: Math.max(0, before.scrollHeight - after.scrollHeight), scroll: after.top - before.top };
}

const levelElement = (id: string) => document.querySelector<HTMLElement>(`[data-level-id="${CSS.escape(id)}"]`);

// `capture(id)` must run in the event handler, before the state change that folds or
// unfolds the levels. The layout effect then measures again and corrects.
export function useFoldAnchor(folded: boolean, mainRef: RefObject<HTMLElement | null>) {
  const before = useRef<(Snapshot & { id: string }) | null>(null);

  function capture(id: string) {
    const el = levelElement(id);
    if (el) before.current = { id, top: el.getBoundingClientRect().top, scrollHeight: document.documentElement.scrollHeight };
  }

  useLayoutEffect(() => {
    const snapshot = before.current;
    before.current = null;
    const main = mainRef.current;
    if (main) main.style.paddingBottom = "";
    const el = snapshot && levelElement(snapshot.id);
    if (!snapshot || !el) return;
    const { padding, scroll } = foldAdjustment(snapshot, {
      top: el.getBoundingClientRect().top,
      scrollHeight: document.documentElement.scrollHeight,
    });
    if (folded && padding > 0 && main) main.style.paddingBottom = `calc(7rem + ${padding}px)`;
    if (scroll !== 0) window.scrollBy(0, scroll);
  }, [folded, mainRef]);

  return capture;
}
