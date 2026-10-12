const DISMISS_KEY = "auditoo.installNudgeDismissedAt";
const DISMISS_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

export type Environment = {
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
  standalone: boolean;
};

// Other iOS browsers and in-app web views show a different share sheet.
const NOT_SAFARI = /CriOS|FxiOS|EdgiOS|OPiOS|GSA|DuckDuckGo|FBAN|FBAV|Instagram|Line\//;

export function isIosSafari({ userAgent, platform, maxTouchPoints }: Environment): boolean {
  // iPadOS reports a Mac user agent, so touch support tells the two apart.
  const ios = /iPhone|iPad|iPod/.test(userAgent) || (platform === "MacIntel" && maxTouchPoints > 1);
  return ios && /Safari/.test(userAgent) && !NOT_SAFARI.test(userAgent);
}

// Safari erases a site's IndexedDB after about a week without use unless it is installed
// to the home screen, which would lose unsynced work.
export function shouldShowInstallNudge(env: Environment, dismissedAt: number | null, now: number): boolean {
  if (!isIosSafari(env) || env.standalone) return false;
  return dismissedAt === null || now - dismissedAt >= DISMISS_DAYS * DAY_MS;
}

export function currentEnvironment(): Environment {
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    maxTouchPoints: navigator.maxTouchPoints,
    standalone:
      (navigator as Navigator & { standalone?: boolean }).standalone === true ||
      window.matchMedia("(display-mode: standalone)").matches,
  };
}

export function readDismissedAt(): number | null {
  try {
    const value = Number(localStorage.getItem(DISMISS_KEY));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

export function writeDismissedAt(time: number): void {
  try {
    localStorage.setItem(DISMISS_KEY, String(time));
  } catch {
    // A failed write only means the banner can show again.
  }
}
