import { Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { db } from "@/data/db";
import { createLevel } from "@/data/levels";
import { LevelSection } from "./LevelSection";
import { NameInput } from "./NameInput";
import { useCollapsed } from "./useCollapsed";
import { useLevelTree } from "./useLevelTree";

export function LevelsScreen() {
  const levels = useLevelTree();
  const { collapsed, toggle } = useCollapsed();
  const [adding, setAdding] = useState(false);
  const addRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (adding) addRef.current?.scrollIntoView?.({ block: "center" });
  }, [adding]);

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col">
      <header className="sticky top-0 z-10 flex min-h-14 items-center justify-between border-b bg-background/95 px-4 pt-[env(safe-area-inset-top)] backdrop-blur">
        <h1 className="text-lg font-semibold">Auditoo</h1>
        {/* Right side of the header is reserved for the sync badge. */}
        <div data-slot="header-actions" />
      </header>

      <main className="flex-1 space-y-3 px-3 pt-3 pb-28">
        {levels === undefined ? null : levels.length === 0 && !adding ? (
          <div className="px-4 py-16 text-center">
            <p className="text-base font-medium">No levels yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add the floors of the building, then the spaces on each one.
            </p>
          </div>
        ) : (
          levels.map((level) => (
            <LevelSection
              key={level.id}
              level={level}
              collapsed={collapsed.has(level.id)}
              onToggle={() => toggle(level.id)}
            />
          ))
        )}
        {adding && (
          <div ref={addRef} className="rounded-xl border bg-card p-2">
            <NameInput
              keepOpen
              label="New level"
              placeholder="Level name"
              onSubmit={(name) => createLevel(db, name)}
              onClose={() => setAdding(false)}
            />
          </div>
        )}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t bg-background/95 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto max-w-2xl">
          <Button className="h-12 w-full gap-2 text-base" onClick={() => setAdding(true)}>
            <Plus className="size-5" /> Add level
          </Button>
        </div>
      </div>

      <Toaster position="bottom-center" offset={{ bottom: "calc(5.5rem + env(safe-area-inset-bottom))" }} />
    </div>
  );
}
