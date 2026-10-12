// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/data/db";
import { LevelsScreen } from "./LevelsScreen";

beforeEach(async () => {
  await Promise.all([db.levels.clear(), db.spaces.clear(), db.outbox.clear()]);
  localStorage.clear();
});

afterEach(() => {
  toast.dismiss();
  cleanup();
});

async function addLevel(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole("button", { name: /add level/i }));
  await user.type(screen.getByLabelText("New level"), `${name}{Enter}`);
}

async function chooseAction(user: ReturnType<typeof userEvent.setup>, row: string, action: RegExp) {
  await user.click(await screen.findByRole("button", { name: `Actions for ${row}` }));
  await user.click(await screen.findByRole("menuitem", { name: action }));
}

describe("LevelsScreen", () => {
  it("shows the empty state, then the first level", async () => {
    const user = userEvent.setup();
    render(<LevelsScreen />);
    expect(await screen.findByText("No levels yet")).toBeTruthy();

    await addLevel(user, "Ground floor");

    expect(await screen.findByText("Ground floor")).toBeTruthy();
    expect(screen.queryByText("No levels yet")).toBeNull();
    expect(await db.outbox.count()).toBe(1);
  });

  it("keeps the level input open for the next level and closes on Escape", async () => {
    const user = userEvent.setup();
    render(<LevelsScreen />);
    await addLevel(user, "A");
    await user.type(screen.getByLabelText("New level"), "B{Enter}");
    expect(await screen.findByText("B")).toBeTruthy();

    await user.keyboard("{Escape}");
    expect(screen.queryByLabelText("New level")).toBeNull();
  });

  it("shows an empty level, then adds several spaces in a row", async () => {
    const user = userEvent.setup();
    render(<LevelsScreen />);
    await addLevel(user, "Ground");
    await user.keyboard("{Escape}");
    expect(await screen.findByText("No spaces yet")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /add space/i }));
    await user.type(screen.getByLabelText("New space in Ground"), "Kitchen{Enter}Bathroom{Enter}");

    expect(await screen.findByText("Kitchen")).toBeTruthy();
    expect(await screen.findByText("Bathroom")).toBeTruthy();
    expect(screen.queryByText("No spaces yet")).toBeNull();
  });

  it("saves typed text on blur instead of losing it", async () => {
    const user = userEvent.setup();
    render(<LevelsScreen />);
    await addLevel(user, "Ground");
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: /add space/i }));
    await user.type(screen.getByLabelText("New space in Ground"), "Garage");

    await user.click(document.body);

    expect(await screen.findByText("Garage")).toBeTruthy();
  });

  it("ignores an empty name and writes nothing", async () => {
    const user = userEvent.setup();
    render(<LevelsScreen />);
    await user.click(await screen.findByRole("button", { name: /add level/i }));
    await user.type(screen.getByLabelText("New level"), "   {Enter}");
    expect(await db.levels.count()).toBe(0);
  });

  it("renames a level in place", async () => {
    const user = userEvent.setup();
    render(<LevelsScreen />);
    await addLevel(user, "Ground");
    await user.keyboard("{Escape}");

    await chooseAction(user, "Ground", /rename/i);
    const input = screen.getByLabelText("Rename Ground");
    await user.clear(input);
    await user.type(input, "Basement{Enter}");

    expect(await screen.findByText("Basement")).toBeTruthy();
    expect(screen.queryByText("Ground")).toBeNull();
  });

  it("deletes a space and undoes it", async () => {
    const user = userEvent.setup();
    render(<LevelsScreen />);
    await addLevel(user, "Ground");
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: /add space/i }));
    await user.type(screen.getByLabelText("New space in Ground"), "Kitchen{Enter}{Escape}");
    await screen.findByText("Kitchen");

    await chooseAction(user, "Kitchen", /delete/i);
    await waitFor(() => expect(screen.queryByText("Kitchen", { selector: "li span" })).toBeNull());

    await user.click(await screen.findByRole("button", { name: "Undo" }));
    expect(await screen.findByText("Kitchen", { selector: "li span" })).toBeTruthy();
  });

  it("deletes a level with its spaces and undoes it with one tap", async () => {
    const user = userEvent.setup();
    render(<LevelsScreen />);
    await addLevel(user, "Ground");
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: /add space/i }));
    await user.type(screen.getByLabelText("New space in Ground"), "Kitchen{Enter}Hall{Enter}{Escape}");
    await screen.findByText("Hall");

    await chooseAction(user, "Ground", /delete/i);
    expect(await screen.findByText("Ground deleted · 2 spaces")).toBeTruthy();
    await waitFor(() => expect(screen.queryByText("Kitchen")).toBeNull());
    expect(await screen.findByText("No levels yet")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Undo" }));

    const section = (await screen.findByText("Ground", { selector: "section span" })).closest("section")!;
    expect(within(section).getByText("Kitchen")).toBeTruthy();
    expect(within(section).getByText("Hall")).toBeTruthy();
  });

  it("collapses a level and remembers it", async () => {
    const user = userEvent.setup();
    const first = render(<LevelsScreen />);
    await addLevel(user, "Ground");
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: /add space/i }));
    await user.type(screen.getByLabelText("New space in Ground"), "Kitchen{Enter}{Escape}");
    await screen.findByText("Kitchen");

    await user.click(screen.getByRole("button", { name: /^Ground/ }));
    expect(screen.queryByText("Kitchen")).toBeNull();

    first.unmount();
    render(<LevelsScreen />);
    expect(await screen.findByText("Ground")).toBeTruthy();
    expect(screen.queryByText("Kitchen")).toBeNull();
  });

  it("gives every space a 44px drag handle and keeps the row body free of drag listeners", async () => {
    const user = userEvent.setup();
    render(<LevelsScreen />);
    await addLevel(user, "Ground");
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: /add space/i }));
    await user.type(screen.getByLabelText("New space in Ground"), "Kitchen{Enter}{Escape}");
    const name = await screen.findByText("Kitchen", { selector: "li span" });

    const handle = screen.getByRole("button", { name: "Reorder Kitchen" });
    expect(handle.className).toContain("size-11");
    expect(handle.className).toContain("touch-none");
    expect(handle.closest("li")).toBe(name.closest("li"));
    expect(name.getAttribute("role")).toBeNull();
    expect(name.getAttribute("tabindex")).toBeNull();
  });

  it("gives every level a 44px drag handle", async () => {
    const user = userEvent.setup();
    render(<LevelsScreen />);
    await addLevel(user, "Ground");
    await user.keyboard("{Escape}");

    const handle = await screen.findByRole("button", { name: "Reorder Ground" });

    expect(handle.className).toContain("size-11");
    expect(handle.className).toContain("touch-none");
  });
});
