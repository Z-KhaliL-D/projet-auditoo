import { describe, expect, it } from "vitest";
import {
  IDLE,
  LEVEL_SWIPE,
  SPACE_SWIPE,
  type SwipeState,
  endSwipe,
  isArmed,
  moveSwipe,
  startSwipe,
} from "./swipe";

const W = 300;
const at = (x: number, y: number, time = 0) => ({ x, y, time });

// Walks a finger through the given points, starting at the first one.
function drag(points: [number, number, number][], width = W): SwipeState {
  let state = startSwipe(points[0][0], points[0][1]);
  for (const [x, y, time] of points.slice(1)) state = moveSwipe(state, at(x, y, time), width);
  return state;
}

describe("axis lock", () => {
  it("waits until the finger has moved 10px", () => {
    expect(drag([[200, 50, 0], [195, 50, 10]]).phase).toBe("pending");
  });

  it("starts a swipe on a clearly horizontal move to the left", () => {
    expect(drag([[200, 50, 0], [185, 52, 10]]).phase).toBe("swiping");
  });

  it("leaves a vertical move to scrolling, for the rest of the gesture", () => {
    const state = drag([[200, 50, 0], [198, 70, 10], [100, 70, 20]]);
    expect(state.phase).toBe("ignored");
  });

  it("lets scrolling win when the move is diagonal", () => {
    expect(drag([[200, 50, 0], [180, 65, 10]]).phase).toBe("ignored");
    expect(drag([[200, 50, 0], [170, 65, 10]]).phase).toBe("swiping");
  });

  it("ignores a move to the right", () => {
    expect(drag([[100, 50, 0], [130, 50, 10]]).phase).toBe("ignored");
  });

  it("does nothing before a gesture starts", () => {
    expect(moveSwipe(IDLE, at(10, 10), W)).toBe(IDLE);
  });
});

describe("offset", () => {
  it("follows the finger from where the swipe started", () => {
    const state = drag([[250, 50, 0], [235, 50, 10], [185, 50, 20]]);
    expect(state).toMatchObject({ phase: "swiping", offset: -50 });
  });

  it("never goes right of rest or past the row width", () => {
    expect(drag([[250, 50, 0], [235, 50, 10], [300, 50, 20]])).toMatchObject({ offset: 0 });
    expect(drag([[400, 50, 0], [385, 50, 10], [-500, 50, 20]])).toMatchObject({ offset: -W });
  });
});

describe("releasing", () => {
  const swipeTo = (travel: number, time = 20) => drag([[250, 50, 0], [235, 50, 10], [235 - travel, 50, time]]);
  // A slow swipe (2 seconds), so only the distance can decide.
  const slowSwipeTo = (travel: number) => swipeTo(travel, 2000);

  it("deletes a space past 40 percent of the width", () => {
    expect(endSwipe(slowSwipeTo(119), W, SPACE_SWIPE, 2005)).toBe("cancel");
    expect(endSwipe(slowSwipeTo(120), W, SPACE_SWIPE, 2005)).toBe("delete");
  });

  it("needs 60 percent for a level", () => {
    expect(endSwipe(slowSwipeTo(150), W, LEVEL_SWIPE, 2005)).toBe("cancel");
    expect(endSwipe(slowSwipeTo(179), W, LEVEL_SWIPE, 2005)).toBe("cancel");
    expect(endSwipe(slowSwipeTo(180), W, LEVEL_SWIPE, 2005)).toBe("delete");
  });

  it("lets a fast flick delete a space with only a short swipe", () => {
    // 60px in 10ms is 6 px/ms, well over the flick speed.
    expect(endSwipe(swipeTo(60, 20), W, SPACE_SWIPE, 25)).toBe("delete");
  });

  it("does not let a flick delete a level", () => {
    expect(endSwipe(swipeTo(60, 20), W, LEVEL_SWIPE, 25)).toBe("cancel");
  });

  it("ignores a flick that is too short or too slow", () => {
    expect(endSwipe(swipeTo(30, 20), W, SPACE_SWIPE, 25)).toBe("cancel");
    expect(endSwipe(drag([[250, 50, 0], [235, 50, 10], [175, 50, 400]]), W, SPACE_SWIPE, 405)).toBe("cancel");
  });

  it("ignores a flick when the finger rested before lifting", () => {
    expect(endSwipe(swipeTo(60, 20), W, SPACE_SWIPE, 500)).toBe("cancel");
  });

  it("cancels when there was no swipe or the width is unknown", () => {
    expect(endSwipe(IDLE, W, SPACE_SWIPE, 0)).toBe("cancel");
    expect(endSwipe(startSwipe(1, 1), W, SPACE_SWIPE, 0)).toBe("cancel");
    expect(endSwipe(drag([[200, 50, 0], [100, 150, 10]]), W, SPACE_SWIPE, 20)).toBe("cancel");
    expect(endSwipe(swipeTo(200), 0, SPACE_SWIPE, 25)).toBe("cancel");
  });
});

describe("isArmed", () => {
  it("is true exactly when releasing would delete by distance", () => {
    const state = drag([[250, 50, 0], [235, 50, 10], [115, 50, 20]]);
    expect(isArmed(state, W, SPACE_SWIPE)).toBe(true);
    expect(isArmed(state, W, LEVEL_SWIPE)).toBe(false);
    expect(isArmed(IDLE, W, SPACE_SWIPE)).toBe(false);
    expect(isArmed(state, 0, SPACE_SWIPE)).toBe(false);
  });
});
