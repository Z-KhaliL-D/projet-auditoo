const CHECK_INTERVAL_MS = 15 * 60 * 1000;

export type UpdatableWorker = {
  addEventListener(type: "waiting" | "controlling", listener: (event: { isUpdate?: boolean }) => void): void;
  update(): Promise<void>;
  messageSkipWaiting(): void;
};

type Options = {
  worker: UpdatableWorker;
  // Called when a new version is installed and waiting. `apply` switches to it.
  notify: (apply: () => void) => void;
  reload: () => void;
  now?: () => number;
  intervalMs?: number;
};

// A new version never takes over by itself, so an open page never runs old code against
// new files. The inspector chooses when to apply it; if they ignore the prompt, it
// applies at the next cold start. Once it does take over, every open tab reloads, because
// an old tab asking for old hashed files would fail.
export function watchForUpdates({ worker, notify, reload, now = Date.now, intervalMs = CHECK_INTERVAL_MS }: Options) {
  worker.addEventListener("waiting", () => notify(() => worker.messageSkipWaiting()));
  // The first install also takes control, but that is not an update and needs no reload.
  worker.addEventListener("controlling", (event) => {
    if (event.isUpdate) reload();
  });

  // Browsers only look for a new worker on navigation, which a long-open app rarely does.
  let lastCheck = now();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible" || now() - lastCheck < intervalMs) return;
    lastCheck = now();
    // Offline, there is nothing to check; the next visit tries again.
    worker.update().catch(() => {});
  });
}
