"use client";

// ── Status filter chips for the Tinda screen ─────────────────────
// Local chip row (CategoryChips-like styling) — intentionally NOT the shared
// CategoryChips component, because that one has allowEmpty semantics and a
// string value; this one is a fixed "Lahat + 4 statuses" row with counts.

import { STOCK_STATUSES } from "@/lib/constants";
import type { StockStatus } from "@/types";
import { cn } from "@/lib/utils";

export type StatusFilter = "lahat" | StockStatus;

export type StatusCounts = Record<StatusFilter, number>;

const CHIP_BASE =
  "flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-semibold min-h-[36px] transition-all touch-manipulation active:scale-95";

export function StatusFilterChips({
  value,
  onChange,
  counts,
  className,
}: {
  value: StatusFilter;
  onChange: (v: StatusFilter) => void;
  counts: StatusCounts;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Filtrahin ayon sa stock status"
      className={cn("nice-scroll flex gap-2 overflow-x-auto pb-1", className)}
    >
      <button
        type="button"
        role="radio"
        aria-checked={value === "lahat"}
        onClick={() => onChange("lahat")}
        className={cn(
          CHIP_BASE,
          value === "lahat"
            ? "border-primary bg-primary text-primary-foreground shadow-sm"
            : "border-border bg-card text-muted-foreground"
        )}
      >
        Lahat ({counts.lahat})
      </button>
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
              CHIP_BASE,
              active
                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                : "border-border bg-card text-muted-foreground"
            )}
          >
            {s.label} ({counts[s.value]})
          </button>
        );
      })}
    </div>
  );
}
