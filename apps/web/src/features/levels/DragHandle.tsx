import { GripVertical } from "lucide-react";
import type { ComponentProps, Ref } from "react";

type Props = { label: string; ref: Ref<HTMLButtonElement> } & ComponentProps<"button">;

// The only element that starts a drag. touch-action: none lets it capture the finger
// without scrolling; the rest of the row keeps normal scrolling and is free for swipes.
export function DragHandle({ label, ref, ...props }: Props) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={`Reorder ${label}`}
      className="flex size-11 shrink-0 cursor-grab touch-none items-center justify-center text-muted-foreground select-none [-webkit-touch-callout:none] active:cursor-grabbing"
      {...props}
    >
      <GripVertical className="size-5" />
    </button>
  );
}

export function DragPreview({ name, bold }: { name: string; bold?: boolean }) {
  return (
    <div
      className={`flex items-center gap-1 rounded-lg border bg-card pr-4 shadow-lg ring-1 ring-foreground/10 ${bold ? "min-h-14" : "min-h-11"}`}
    >
      <div className="flex size-11 items-center justify-center text-muted-foreground">
        <GripVertical className="size-5" />
      </div>
      <span className={bold ? "truncate text-base font-semibold" : "truncate text-[15px]"}>{name}</span>
    </div>
  );
}
