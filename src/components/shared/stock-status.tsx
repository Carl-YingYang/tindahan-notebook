"use client";

import { STOCK_STATUSES, stockStatusMeta } from "@/lib/constants";
import type { StockStatus } from "@/types";
import { cn } from "@/lib/utils";

export function StockStatusBadge({
  status,
  className,
  showDot = true,
}: {
  status: string;
  className?: string;
  showDot?: boolean;
}) {
  const meta = stockStatusMeta(status);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
        meta.badge,
        className
      )}
    >
      {showDot && <span className={cn("size-1.5 rounded-full", meta.dot)} aria-hidden="true" />}
      {meta.label}
    </span>
  );
}

/** One-tap status picker — the heart of the low-friction stock system. */
export function StockStatusPicker({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (s: StockStatus) => void;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label="Stock status" className={cn("grid grid-cols-2 gap-2", className)}>
      {STOCK_STATUSES.map((s) => {
        const active = value === s.value;
        return (
          <button
            key={s.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(s.value)}
            className={cn(
              "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold min-h-[44px] transition-all touch-manipulation",
              active
                ? "border-primary bg-primary/10 text-primary ring-1 ring-primary"
                : "border-border bg-card text-muted-foreground active:scale-[0.98]"
            )}
          >
            <span className={cn("size-2.5 rounded-full", s.dot)} aria-hidden="true" />
            {s.label}
          </button>
        );
      })}
    </div>
  );
}
