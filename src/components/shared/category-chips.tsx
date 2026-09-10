"use client";

import { cn } from "@/lib/utils";

/** Low-friction category picker — tap a pill, done. */
export function CategoryChips({
  options,
  value,
  onChange,
  allowEmpty = false,
  emptyLabel = "Walang category",
  className,
}: {
  options: readonly string[];
  value: string;
  onChange: (v: string) => void;
  allowEmpty?: boolean;
  emptyLabel?: string;
  className?: string;
}) {
  const all = allowEmpty ? ["", ...options] : [...options];
  return (
    <div className={cn("flex flex-wrap gap-2", className)} role="radiogroup">
      {all.map((opt) => {
        const active = value === opt;
        return (
          <button
            key={opt || "__none"}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-[13px] font-semibold min-h-[36px] transition-all touch-manipulation active:scale-95",
              active
                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                : "border-border bg-card text-muted-foreground"
            )}
          >
            {opt === "" ? emptyLabel : opt}
          </button>
        );
      })}
    </div>
  );
}
