import { useState } from "react";

const KEY = "auditoo.collapsedLevels";

function read(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

// Collapsed sections are a per-device convenience, so storage failures are ignored.
export function useCollapsed() {
  const [collapsed, setCollapsed] = useState(read);

  function toggle(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      try {
        localStorage.setItem(KEY, JSON.stringify([...next]));
      } catch {
        // storage unavailable
      }
      return next;
    });
  }

  return { collapsed, toggle };
}
