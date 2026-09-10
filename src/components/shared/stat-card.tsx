"use client";

import { Card } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "benta" | "gastos" | "net" | "neutral" | "warning" | "danger";

const TONES: Record<Tone, { icon: string; value: string; accent: string }> = {
  benta: { icon: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400", value: "text-emerald-600 dark:text-emerald-400", accent: "via-emerald-400/80" },
  gastos: { icon: "bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400", value: "text-rose-600 dark:text-rose-400", accent: "via-rose-400/80" },
  net: { icon: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400", value: "text-foreground", accent: "via-amber-400/80" },
  neutral: { icon: "bg-muted text-muted-foreground", value: "text-foreground", accent: "via-muted-foreground/40" },
  warning: { icon: "bg-orange-100 text-orange-600 dark:bg-orange-500/15 dark:text-orange-400", value: "text-orange-600 dark:text-orange-400", accent: "via-orange-400/80" },
  danger: { icon: "bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400", value: "text-rose-600 dark:text-rose-400", accent: "via-rose-400/80" },
};

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "neutral",
  className,
  onClick,
  loading,
  sub,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: Tone;
  className?: string;
  onClick?: () => void;
  loading?: boolean;
  /** Tiny helper line under the value (e.g. trend vs yesterday) */
  sub?: React.ReactNode;
}) {
  const t = TONES[tone];
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className={cn(
        "card-surface relative flex items-center gap-3 overflow-hidden rounded-2xl border border-border bg-card p-3 text-left",
        onClick && "active:scale-[0.98] transition-transform touch-manipulation",
        className
      )}
    >
      {/* Top accent hairline — a tiny touch of color per money tone */}
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent to-transparent",
          t.accent
        )}
      />
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", t.icon)}>
        <Icon className="size-[18px]" />
      </span>
      <span className="min-w-0">
        <span className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
        <span className={cn("block truncate text-lg font-bold leading-tight tabular", t.value)}>
          {loading ? "…" : value}
        </span>
        {sub && <span className="mt-0.5 flex items-center gap-0.5 text-[10px] font-medium leading-none text-muted-foreground">{sub}</span>}
      </span>
    </Comp>
  );
}
