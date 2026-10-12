// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InstallNudge } from "./InstallNudge";

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const KEY = "auditoo.installNudgeDismissedAt";

function pretendIosSafari(standalone = false) {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(IPHONE_SAFARI);
  vi.spyOn(navigator, "platform", "get").mockReturnValue("iPhone");
  // jsdom does not define maxTouchPoints, so it cannot be spied on.
  Object.defineProperty(navigator, "maxTouchPoints", { configurable: true, value: 5 });
  Object.defineProperty(navigator, "standalone", { configurable: true, value: standalone });
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  Reflect.deleteProperty(navigator, "standalone");
  Reflect.deleteProperty(navigator, "maxTouchPoints");
});

describe("InstallNudge", () => {
  it("explains Share then Add to Home Screen in iOS Safari", () => {
    pretendIosSafari();
    render(<InstallNudge />);
    expect(screen.getByText(/Add to Home Screen/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Dismiss" }).className).toContain("size-11");
  });

  it("is hidden outside iOS Safari", () => {
    render(<InstallNudge />);
    expect(screen.queryByText(/Add to Home Screen/)).toBeNull();
  });

  it("is hidden when already installed", () => {
    pretendIosSafari(true);
    render(<InstallNudge />);
    expect(screen.queryByText(/Add to Home Screen/)).toBeNull();
  });

  it("hides on dismiss, remembers it, and stays hidden on the next visit", async () => {
    pretendIosSafari();
    const first = render(<InstallNudge />);

    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(screen.queryByText(/Add to Home Screen/)).toBeNull();
    expect(Number(localStorage.getItem(KEY))).toBeGreaterThan(0);

    first.unmount();
    render(<InstallNudge />);
    expect(screen.queryByText(/Add to Home Screen/)).toBeNull();
  });

  it("shows again once the dismissal is older than 3 days", () => {
    pretendIosSafari();
    localStorage.setItem(KEY, String(Date.now() - 4 * 24 * 60 * 60 * 1000));
    render(<InstallNudge />);
    expect(screen.getByText(/Add to Home Screen/)).toBeTruthy();
  });

  it("still shows when storage is unavailable", () => {
    pretendIosSafari();
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    render(<InstallNudge />);
    expect(screen.getByText(/Add to Home Screen/)).toBeTruthy();
  });
});
