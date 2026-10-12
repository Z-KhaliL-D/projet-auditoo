import { describe, expect, it } from "vitest";
import { type Environment, isIosSafari, shouldShowInstallNudge } from "./iosInstall";

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_000_000_000_000;

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const IPHONE_CHROME =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0 Mobile/15E148 Safari/604.1";
const IPAD_AS_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36";

const env = (over: Partial<Environment> = {}): Environment => ({
  userAgent: IPHONE_SAFARI,
  platform: "iPhone",
  maxTouchPoints: 5,
  standalone: false,
  ...over,
});

describe("isIosSafari", () => {
  it("recognizes Safari on iPhone", () => {
    expect(isIosSafari(env())).toBe(true);
  });

  it("recognizes Safari on iPadOS, which reports a Mac user agent", () => {
    expect(isIosSafari(env({ userAgent: IPAD_AS_MAC, platform: "MacIntel", maxTouchPoints: 5 }))).toBe(true);
  });

  it("does not match Safari on a Mac without a touch screen", () => {
    expect(isIosSafari(env({ userAgent: IPAD_AS_MAC, platform: "MacIntel", maxTouchPoints: 0 }))).toBe(false);
  });

  it("does not match other iOS browsers or Android", () => {
    expect(isIosSafari(env({ userAgent: IPHONE_CHROME }))).toBe(false);
    expect(isIosSafari(env({ userAgent: ANDROID_CHROME, platform: "Linux armv8l" }))).toBe(false);
  });
});

describe("shouldShowInstallNudge", () => {
  it("shows in iOS Safari when not installed and never dismissed", () => {
    expect(shouldShowInstallNudge(env(), null, NOW)).toBe(true);
  });

  it("does not show once installed to the home screen", () => {
    expect(shouldShowInstallNudge(env({ standalone: true }), null, NOW)).toBe(false);
  });

  it("does not show outside iOS Safari", () => {
    expect(shouldShowInstallNudge(env({ userAgent: ANDROID_CHROME, platform: "Linux armv8l" }), null, NOW)).toBe(false);
  });

  it("stays hidden for 3 days after a dismissal, then shows again", () => {
    expect(shouldShowInstallNudge(env(), NOW - 1 * DAY, NOW)).toBe(false);
    expect(shouldShowInstallNudge(env(), NOW - (3 * DAY - 1), NOW)).toBe(false);
    expect(shouldShowInstallNudge(env(), NOW - 3 * DAY, NOW)).toBe(true);
  });
});
