import { nameSchema } from "@auditoo/shared";
import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";

type Props = {
  initialValue?: string;
  placeholder?: string;
  label: string;
  // Keeps the field open and empty after Enter, for adding several items in a row.
  keepOpen?: boolean;
  onSubmit: (name: string) => unknown;
  onClose: () => void;
};

// Enter saves, Escape cancels. Blur saves typed text so it is never lost, and
// closes quietly when the field is empty or unchanged.
export function NameInput({ initialValue = "", placeholder, label, keepOpen, onSubmit, onClose }: Props) {
  const [value, setValue] = useState(initialValue);
  const finished = useRef(false);

  // The field is cleared before onSubmit runs, so characters typed right after
  // Enter are never wiped by a late state update.
  function commit(close: boolean) {
    const parsed = nameSchema.safeParse(value);
    if (close) {
      finished.current = true;
      onClose();
    } else {
      setValue("");
    }
    if (parsed.success && parsed.data !== initialValue) void onSubmit(parsed.data);
  }

  return (
    <Input
      autoFocus
      aria-label={label}
      className="h-11 text-base"
      maxLength={80}
      placeholder={placeholder}
      enterKeyHint="done"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit(!keepOpen);
        } else if (e.key === "Escape") {
          finished.current = true;
          onClose();
        }
      }}
      onBlur={() => {
        if (!finished.current) commit(true);
      }}
    />
  );
}
