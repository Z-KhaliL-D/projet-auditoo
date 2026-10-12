import { Serwist } from "@serwist/window";
import { toast } from "sonner";
import { type UpdatableWorker, watchForUpdates } from "./updates";

export async function registerServiceWorker(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const worker = new Serwist("/sw.js", { scope: "/", type: "classic" });
  watchForUpdates({
    worker: worker as unknown as UpdatableWorker,
    notify: (apply) =>
      toast("A new version is available", {
        id: "update-available",
        duration: Number.POSITIVE_INFINITY,
        action: { label: "Reload", onClick: apply },
      }),
    reload: () => window.location.reload(),
  });
  await worker.register();
}
