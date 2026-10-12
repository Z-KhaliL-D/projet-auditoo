// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BadgeState } from "./badgeState";
import { SyncBadgeView } from "./SyncBadge";

afterEach(cleanup);

const show = (kind: BadgeState["kind"], pending = 0, rejected = 0) =>
  render(<SyncBadgeView state={{ kind, pending, rejected }} onClick={() => {}} />);

describe("SyncBadgeView", () => {
  it.each([
    ["synced", 0, 0, "Synced"],
    ["syncing", 2, 0, "Syncing"],
    ["pending", 3, 0, "3 pending"],
    ["offline", 0, 0, "Offline"],
    ["offline", 4, 0, "Offline · 4"],
    ["error", 0, 0, "Sync error"],
    ["error", 0, 2, "2 not accepted"],
  ] as const)("%s with %i pending and %i rejected reads %s", (kind, pending, rejected, label) => {
    show(kind, pending, rejected);
    expect(screen.getByText(label)).toBeTruthy();
  });

  it("syncs when tapped", async () => {
    const onClick = vi.fn();
    render(<SyncBadgeView state={{ kind: "synced", pending: 0, rejected: 0 }} onClick={onClick} />);
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
