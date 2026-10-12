// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/data/db";
import { LevelsScreen } from "./LevelsScreen";

const WIDTH = 300;

beforeEach(async () => {
  await Promise.all([db.levels.clear(), db.spaces.clear(), db.outbox.clear()]);
  localStorage.clear();
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({ width: WIDTH, height: 44 } as DOMRect);
});

afterEach(() => {
  toast.dismiss();
  cleanup();
  vi.restoreAllMocks();
});

type User = ReturnType<typeof userEvent.setup>;

async function seed(user: User) {
  render(<LevelsScreen />);
  await user.click(await screen.findByRole("button", { name: /add level/i }));
  await user.type(screen.getByLabelText("New level"), "Ground{Enter}{Escape}");
  await user.click(await screen.findByRole("button", { name: /add space/i }));
  await user.type(screen.getByLabelText("New space in Ground"), "Kitchen{Enter}{Escape}");
  await screen.findByText("Kitchen", { selector: "li span" });
}

const spaceZone = () => screen.getByText("Kitchen", { selector: "li span" }).closest("[data-swipe-zone]") as HTMLElement;
const levelZone = () => screen.getByRole("button", { name: /^Ground/ });

// Presses at x = 250, locks the axis, then slides `travel` px to the left and lets go.
function swipeLeft(el: Element, travel: number, { release = true, dy = 0 } = {}) {
  const pointer = { pointerId: 1, pointerType: "touch", button: 0 };
  fireEvent.pointerDown(el, { ...pointer, clientX: 250, clientY: 20 });
  fireEvent.pointerMove(el, { ...pointer, clientX: 235, clientY: 20 + dy });
  fireEvent.pointerMove(el, { ...pointer, clientX: 235 - travel, clientY: 20 + dy });
  if (release) fireEvent.pointerUp(el, { ...pointer, clientX: 235 - travel, clientY: 20 + dy });
}

const isDeleted = async (table: "levels" | "spaces") => (await db[table].toArray())[0]?.deletedAt !== null;

describe("swipe to delete a space", () => {
  it("deletes at once with the undo toast when swiped past the threshold, and undo brings it back", async () => {
    const user = userEvent.setup();
    await seed(user);

    swipeLeft(spaceZone(), 140);

    await waitFor(async () => expect(await isDeleted("spaces")).toBe(true));
    await waitFor(() => expect(screen.queryByText("Kitchen", { selector: "li span" })).toBeNull());
    await user.click(await screen.findByRole("button", { name: "Undo" }));
    expect(await screen.findByText("Kitchen", { selector: "li span" })).toBeTruthy();
    expect(await isDeleted("spaces")).toBe(false);
  });

  it("springs back and deletes nothing when released early", async () => {
    const user = userEvent.setup();
    await seed(user);

    // Under 15 percent, so neither the distance nor the flick shortcut applies.
    swipeLeft(spaceZone(), 40);
    await new Promise((r) => setTimeout(r, 250));

    expect(await isDeleted("spaces")).toBe(false);
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
    expect(spaceZone().closest("li")?.querySelector<HTMLElement>(".relative.flex")?.style.transform).toBe("");
  });

  it("follows the finger while swiping and shows the delete background", async () => {
    const user = userEvent.setup();
    await seed(user);

    swipeLeft(spaceZone(), 90, { release: false });

    const content = spaceZone().closest("li")!.querySelector<HTMLElement>(".relative.flex")!;
    expect(content.style.transform).toBe("translateX(-90px)");
    expect(spaceZone().closest("li")!.querySelector("[aria-hidden]")).toBeTruthy();
  });

  it("leaves vertical moves to scrolling", async () => {
    const user = userEvent.setup();
    await seed(user);

    swipeLeft(spaceZone(), 200, { dy: 60 });
    await new Promise((r) => setTimeout(r, 250));

    expect(await isDeleted("spaces")).toBe(false);
  });

  it("gives up when the browser cancels the gesture to scroll", async () => {
    const user = userEvent.setup();
    await seed(user);

    swipeLeft(spaceZone(), 200, { release: false });
    fireEvent.pointerCancel(spaceZone(), { pointerId: 1 });
    await new Promise((r) => setTimeout(r, 250));

    expect(await isDeleted("spaces")).toBe(false);
    expect(spaceZone().closest("li")!.querySelector<HTMLElement>(".relative.flex")!.style.transform).toBe("");
  });

  it("ignores the secondary mouse button", async () => {
    const user = userEvent.setup();
    await seed(user);

    fireEvent.pointerDown(spaceZone(), { pointerId: 1, pointerType: "mouse", button: 2, clientX: 250, clientY: 20 });
    fireEvent.pointerMove(spaceZone(), { pointerId: 1, pointerType: "mouse", clientX: 235, clientY: 20 });
    fireEvent.pointerMove(spaceZone(), { pointerId: 1, pointerType: "mouse", clientX: 50, clientY: 20 });
    fireEvent.pointerUp(spaceZone(), { pointerId: 1, pointerType: "mouse", clientX: 50, clientY: 20 });
    await new Promise((r) => setTimeout(r, 250));

    expect(await isDeleted("spaces")).toBe(false);
  });

  it("keeps the drag handle and the menu button out of the swipe area", async () => {
    const user = userEvent.setup();
    await seed(user);

    expect(screen.getByRole("button", { name: "Reorder Kitchen" }).closest("[data-swipe-zone]")).toBeNull();
    expect(screen.getByRole("button", { name: "Actions for Kitchen" }).closest("[data-swipe-zone]")).toBeNull();
  });

  it("has no swipe area while the name is being edited", async () => {
    const user = userEvent.setup();
    await seed(user);

    await user.click(screen.getByRole("button", { name: "Actions for Kitchen" }));
    await user.click(await screen.findByRole("menuitem", { name: /rename/i }));

    expect(screen.getByLabelText("Rename Kitchen")).toBeTruthy();
    expect(document.querySelector("li [data-swipe-zone]")).toBeNull();
  });
});

describe("swipe to delete a level", () => {
  it("needs a longer swipe than a space, and a short one does not toggle the level", async () => {
    const user = userEvent.setup();
    await seed(user);

    swipeLeft(levelZone(), 130);
    // The click that follows a swipe must not toggle the level.
    fireEvent.click(levelZone());
    await new Promise((r) => setTimeout(r, 250));

    expect(await isDeleted("levels")).toBe(false);
    expect(levelZone().getAttribute("aria-expanded")).toBe("true");
  });

  it("deletes the level and its spaces with the undo toast past 60 percent, and undo restores both", async () => {
    const user = userEvent.setup();
    await seed(user);

    swipeLeft(levelZone(), 200);

    expect(await screen.findByText("Ground deleted · 1 space")).toBeTruthy();
    expect(await isDeleted("levels")).toBe(true);
    expect(await isDeleted("spaces")).toBe(true);
    await user.click(screen.getByRole("button", { name: "Undo" }));
    expect(await screen.findByText("Kitchen", { selector: "li span" })).toBeTruthy();
    expect(await isDeleted("levels")).toBe(false);
  });

  it("still collapses on a plain tap", async () => {
    const user = userEvent.setup();
    await seed(user);

    await user.click(levelZone());

    expect(levelZone().getAttribute("aria-expanded")).toBe("false");
  });
});
