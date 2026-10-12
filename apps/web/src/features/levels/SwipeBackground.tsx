import { Trash2 } from "lucide-react";

// Revealed behind a row while it slides left. The icon grows once releasing would delete.
export function SwipeBackground({ armed }: { armed: boolean }) {
  return (
    <div aria-hidden className="absolute inset-0 flex items-center justify-end bg-destructive pr-5 text-white">
      <Trash2 className={`size-5 transition-transform ${armed ? "scale-125" : "scale-90 opacity-80"}`} />
    </div>
  );
}
