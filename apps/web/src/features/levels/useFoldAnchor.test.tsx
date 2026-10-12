// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { type RefObject, createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { foldAdjustment, useFoldAnchor } from "./useFoldAnchor";

describe("foldAdjustment", () => {
  it("scrolls by how far the level moved and pads by the height that was lost", () => {
    expect(foldAdjustment({ top: 400, scrollHeight: 2000 }, { top: 150, scrollHeight: 900 })).toEqual({
      padding: 1100,
      scroll: -250,
    });
  });

  it("needs no padding when the page did not shrink, and no scroll when the level stayed put", () => {
    expect(foldAdjustment({ top: 100, scrollHeight: 900 }, { top: 100, scrollHeight: 1200 })).toEqual({
      padding: 0,
      scroll: 0,
    });
  });
});

// jsdom has no layout, so geometry is stubbed: `geometry` is what the next measurement returns.
let geometry = { top: 0, scrollHeight: 0 };
let capture: (id: string) => void;

function Harness({ folded, mainRef }: { folded: boolean; mainRef: RefObject<HTMLElement | null> }) {
  capture = useFoldAnchor(folded, mainRef);
  return (
    <main ref={mainRef}>
      <section data-level-id="L1" />
    </main>
  );
}

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    () => ({ top: geometry.top }) as DOMRect,
  );
  vi.spyOn(document.documentElement, "scrollHeight", "get").mockImplementation(() => geometry.scrollHeight);
  window.scrollBy = vi.fn() as unknown as typeof window.scrollBy;
  (CSS as unknown as { escape: (v: string) => string }).escape ??= (v) => v;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("useFoldAnchor", () => {
  it("keeps the carried level in place when levels fold, and restores the page when they unfold", () => {
    const mainRef = createRef<HTMLElement>();
    geometry = { top: 400, scrollHeight: 2000 };
    const { rerender } = render(<Harness folded={false} mainRef={mainRef} />);

    capture("L1");
    geometry = { top: 150, scrollHeight: 900 };
    rerender(<Harness folded mainRef={mainRef} />);

    expect(window.scrollBy).toHaveBeenLastCalledWith(0, -250);
    expect(mainRef.current?.style.paddingBottom).toContain("1100px");

    capture("L1");
    geometry = { top: 100, scrollHeight: 2000 };
    rerender(<Harness folded={false} mainRef={mainRef} />);

    expect(window.scrollBy).toHaveBeenLastCalledWith(0, -50);
    expect(mainRef.current?.style.paddingBottom).toBe("");
  });

  it("does nothing when nothing was captured", () => {
    const mainRef = createRef<HTMLElement>();
    geometry = { top: 400, scrollHeight: 2000 };
    const { rerender } = render(<Harness folded={false} mainRef={mainRef} />);

    rerender(<Harness folded mainRef={mainRef} />);

    expect(window.scrollBy).not.toHaveBeenCalled();
    expect(mainRef.current?.style.paddingBottom).toBe("");
  });

  it("does nothing when the captured level is gone", () => {
    const mainRef = createRef<HTMLElement>();
    geometry = { top: 400, scrollHeight: 2000 };
    const { rerender } = render(<Harness folded={false} mainRef={mainRef} />);

    capture("missing");
    rerender(<Harness folded mainRef={mainRef} />);

    expect(window.scrollBy).not.toHaveBeenCalled();
  });
});
