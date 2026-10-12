import { AlertTriangle, Check, CloudUpload, Loader2, WifiOff } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { BadgeState } from "./badgeState";
import { syncEngine } from "./instance";
import { useBadgeState } from "./useBadgeState";

function describe(state: BadgeState): { icon: ReactNode; label: string } {
  const { kind, pending, rejected } = state;
  switch (kind) {
    case "error":
      return {
        icon: <AlertTriangle className="size-4" />,
        label: rejected > 0 ? `${rejected} not accepted` : "Sync error",
      };
    case "offline":
      return { icon: <WifiOff className="size-4" />, label: pending > 0 ? `Offline · ${pending}` : "Offline" };
    case "syncing":
      return { icon: <Loader2 className="size-4 animate-spin" />, label: "Syncing" };
    case "pending":
      return { icon: <CloudUpload className="size-4" />, label: `${pending} pending` };
    case "synced":
      return { icon: <Check className="size-4 text-primary" />, label: "Synced" };
  }
}

export function SyncBadgeView({ state, onClick }: { state: BadgeState; onClick: () => void }) {
  const { icon, label } = describe(state);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-live="polite"
      aria-label={`${label}. Tap to sync now`}
      className={cn(
        "-mr-2 flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        state.kind === "error" && "text-destructive",
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

export function SyncBadge() {
  return <SyncBadgeView state={useBadgeState()} onClick={() => void syncEngine.trigger()} />;
}
