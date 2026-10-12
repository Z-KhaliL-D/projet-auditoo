// The swipe-to-delete gesture as a pure state machine, so thresholds and axis locking
// can be tested without a browser.

const LOCK_DISTANCE = 10;
const AXIS_RATIO = 1.5;
const FLICK_VELOCITY = 0.5; // px per ms, leftward
const FLICK_MIN_TRAVEL = 0.15;
const STALE_MS = 100;

export type SwipeConfig = { threshold: number; flick: boolean };
export const SPACE_SWIPE: SwipeConfig = { threshold: 0.4, flick: true };
// A level takes its spaces with it, so it needs a longer, deliberate swipe.
export const LEVEL_SWIPE: SwipeConfig = { threshold: 0.6, flick: false };

export type SwipeState =
  | { phase: "idle" }
  | { phase: "pending"; x: number; y: number }
  | { phase: "ignored" }
  | { phase: "swiping"; originX: number; offset: number; lastX: number; lastTime: number; velocity: number };

export const IDLE: SwipeState = { phase: "idle" };

export const startSwipe = (x: number, y: number): SwipeState => ({ phase: "pending", x, y });

type Point = { x: number; y: number; time: number };

// Scrolling wins every ambiguous case: only a clearly horizontal, leftward move starts a
// swipe. Anything else is ignored until the finger lifts, and the browser scrolls.
export function moveSwipe(state: SwipeState, p: Point, width: number): SwipeState {
  if (state.phase === "pending") {
    const dx = p.x - state.x;
    const dy = p.y - state.y;
    if (Math.hypot(dx, dy) < LOCK_DISTANCE) return state;
    if (dx < 0 && Math.abs(dx) >= AXIS_RATIO * Math.abs(dy)) {
      return { phase: "swiping", originX: p.x, offset: 0, lastX: p.x, lastTime: p.time, velocity: 0 };
    }
    return { phase: "ignored" };
  }
  if (state.phase !== "swiping") return state;
  const dt = p.time - state.lastTime;
  return {
    ...state,
    offset: Math.min(0, Math.max(-width, p.x - state.originX)),
    lastX: p.x,
    lastTime: p.time,
    velocity: dt > 0 ? (p.x - state.lastX) / dt : state.velocity,
  };
}

const travelOf = (state: SwipeState) => (state.phase === "swiping" ? -state.offset : 0);

// True once releasing would delete, so the UI can show "release to delete".
export function isArmed(state: SwipeState, width: number, config: SwipeConfig): boolean {
  return width > 0 && travelOf(state) >= width * config.threshold;
}

export function endSwipe(state: SwipeState, width: number, config: SwipeConfig, time: number): "delete" | "cancel" {
  if (state.phase !== "swiping" || width <= 0) return "cancel";
  if (isArmed(state, width, config)) return "delete";
  // A flick that was already stopped before the finger lifted does not count.
  const velocity = time - state.lastTime > STALE_MS ? 0 : state.velocity;
  const flicked = config.flick && travelOf(state) >= width * FLICK_MIN_TRAVEL && velocity <= -FLICK_VELOCITY;
  return flicked ? "delete" : "cancel";
}
