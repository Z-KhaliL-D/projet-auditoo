import { Share, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { currentEnvironment, readDismissedAt, shouldShowInstallNudge, writeDismissedAt } from "./iosInstall";

export function InstallNudge() {
  const [visible, setVisible] = useState(() => shouldShowInstallNudge(currentEnvironment(), readDismissedAt(), Date.now()));
  if (!visible) return null;

  return (
    <aside className="flex items-start gap-3 rounded-xl border bg-card p-3 pl-4" aria-label="Install Auditoo">
      <div className="min-w-0 flex-1 py-1 text-sm">
        <p className="font-medium">Install Auditoo to keep your work safe offline</p>
        <p className="mt-1 text-muted-foreground">
          Tap <Share className="inline size-4 align-text-bottom" aria-label="Share" /> then{" "}
          <span className="font-medium text-foreground">Add to Home Screen</span>. Without it, Safari can erase unsynced
          data after about a week.
        </p>
      </div>
      <Button
        variant="ghost"
        className="size-11 shrink-0 text-muted-foreground"
        aria-label="Dismiss"
        onClick={() => {
          writeDismissedAt(Date.now());
          setVisible(false);
        }}
      >
        <X className="size-5" />
      </Button>
    </aside>
  );
}
