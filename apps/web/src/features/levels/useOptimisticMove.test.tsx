// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import type { Space } from "@auditoo/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { moveLevel } from "@/data/levels";
import { moveSpace } from "@/data/spaces";
import { type Move, applyMove } from "./drop";
import type { LevelWithSpaces } from "./useLevelTree";
import { useOptimisticMove } from "./useOptimisticMove";

vi.mock("@/data/spaces", () => ({ moveSpace: vi.fn() }));
vi.mock("@/data/levels", () => ({ moveLevel: vi.fn() }));

const space = (id: string): Space => ({ id, levelId: "L", name: id, rank: id, updatedAt: 1, deletedAt: null });
const level = (ids: string[]): LevelWithSpaces[] => [
  { id: "L", name: "L", rank: "a", updatedAt: 1, deletedAt: null, spaces: ids.map(space) },
];
const order = (levels: LevelWithSpaces[] | undefined) => levels?.[0].spaces.map((s) => s.id);

const move: Move = { kind: "space", id: "a", levelId: "L", index: 2 };

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(moveSpace).mockResolvedValue(undefined);
  vi.mocked(moveLevel).mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("useOptimisticMove", () => {
  it("passes data through untouched when nothing is pending", () => {
    const data = level(["a", "b", "c"]);
    const { result } = renderHook(({ d }) => useOptimisticMove(d), { initialProps: { d: data } });
    expect(result.current.levels).toBe(data);
  });

  it("returns undefined while loading", () => {
    const { result } = renderHook(() => useOptimisticMove(undefined));
    expect(result.current.levels).toBeUndefined();
  });

  it("shows the dropped order at once and writes through moveSpace", async () => {
    const { result } = renderHook(({ d }) => useOptimisticMove(d), { initialProps: { d: level(["a", "b", "c"]) } });

    await act(async () => result.current.commit(move));

    expect(order(result.current.levels)).toEqual(["b", "c", "a"]);
    expect(moveSpace).toHaveBeenCalledWith(expect.anything(), "a", "L", 2);
  });

  it("hands over to the data as soon as it reflects the move", async () => {
    const before = level(["a", "b", "c"]);
    const { result, rerender } = renderHook(({ d }) => useOptimisticMove(d), { initialProps: { d: before } });
    await act(async () => result.current.commit(move));

    const fresh = applyMove(before, move);
    rerender({ d: fresh });

    expect(result.current.levels).toBe(fresh);
  });

  it("keeps the override while the data is stale, then gives up shortly after the write", async () => {
    const before = level(["a", "b", "c"]);
    const { result } = renderHook(({ d }) => useOptimisticMove(d), { initialProps: { d: before } });
    await act(async () => result.current.commit(move));
    expect(order(result.current.levels)).toEqual(["b", "c", "a"]);

    await act(async () => {
      vi.advanceTimersByTime(499);
    });
    expect(order(result.current.levels)).toEqual(["b", "c", "a"]);

    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.levels).toBe(before);
  });

  it("does not give up before the write has finished", async () => {
    let finish!: () => void;
    vi.mocked(moveSpace).mockReturnValue(new Promise((resolve) => (finish = () => resolve(undefined))));
    const before = level(["a", "b", "c"]);
    const { result } = renderHook(({ d }) => useOptimisticMove(d), { initialProps: { d: before } });
    await act(async () => result.current.commit(move));

    await act(async () => {
      vi.advanceTimersByTime(5_000);
    });
    expect(order(result.current.levels)).toEqual(["b", "c", "a"]);

    await act(async () => finish());
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current.levels).toBe(before);
  });

  it("writes a level move through moveLevel and shows the new level order", async () => {
    const two: LevelWithSpaces[] = [
      { id: "L1", name: "L1", rank: "a", updatedAt: 1, deletedAt: null, spaces: [] },
      { id: "L2", name: "L2", rank: "b", updatedAt: 1, deletedAt: null, spaces: [] },
    ];
    const { result } = renderHook(({ d }) => useOptimisticMove(d), { initialProps: { d: two } });

    await act(async () => result.current.commit({ kind: "level", id: "L1", index: 1 }));

    expect(result.current.levels?.map((l) => l.id)).toEqual(["L2", "L1"]);
    expect(moveLevel).toHaveBeenCalledWith(expect.anything(), "L1", 1);
    expect(moveSpace).not.toHaveBeenCalled();
  });
});
