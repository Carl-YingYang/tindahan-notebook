"use client";

import { ChevronRight, CalendarClock, StickyNote } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { peso, formatDayLabel, dueInfo, DUE_TONE_CLASS, avatarTone } from "@/lib/format";
import type { CustomerSummary } from "@/types";
import { cn } from "@/lib/utils";

/**
 * One suki row in the utang list — a big tappable card.
 * Balance is shown big + orange when may utang, otherwise an emerald "Bayad na" chip.
 */
export function CustomerCard({
  customer,
  onOpen,
}: {
  customer: CustomerSummary;
  onOpen: (customer: CustomerSummary) => void;
}) {
  const hasBalance = customer.balance > 0;
  const due = hasBalance ? dueInfo(customer.dueDate) : null;
  const initial = (customer.name.trim()[0] ?? "?").toUpperCase();

  return (
    <button
      type="button"
      onClick={() => onOpen(customer)}
      className="w-full touch-manipulation rounded-2xl border border-border bg-card p-4 text-left transition-all active:scale-[0.99]"
    >
      <span className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-full font-bold",
            avatarTone(customer.name),
            due?.tone === "late" && "ring-2 ring-rose-400/60 ring-offset-2 ring-offset-card"
          )}
        >
          {initial}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate font-bold">{customer.name}</span>
            {due && (due.tone === "late" || due.tone === "today") && (
              <span
                aria-label={due.label}
                className={cn(
                  "inline-flex shrink-0 items-center gap-0.5 rounded-full border px-1.5 py-px text-[10px] font-bold leading-4",
                  DUE_TONE_CLASS[due.tone]
                )}
              >
                <CalendarClock className="size-2.5" aria-hidden="true" />
                {due.tone === "late" ? "Late" : "Due ngayon"}
              </span>
            )}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {due ? `${due.label} · ` : ""}
            {customer.lastActivityAt
              ? `Huling tala: ${formatDayLabel(customer.lastActivityAt)}`
              : "Walang tala pa"}
          </span>
          {(customer.note || customer.notes) && (
            <span className="mt-0.5 flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
              <StickyNote className="size-3 shrink-0" aria-hidden="true" />
              <span className="truncate">
                {customer.note?.trim() || customer.notes}
              </span>
            </span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          {hasBalance ? (
            <span className="text-lg font-extrabold tracking-tight text-orange-600 dark:text-orange-400">
              {peso(customer.balance)}
            </span>
          ) : (
            <Badge className="border-transparent bg-emerald-100 text-emerald-700 dark:border-transparent dark:bg-emerald-500/15 dark:text-emerald-400">
              Bayad na
            </Badge>
          )}
          <ChevronRight aria-hidden="true" className="size-4 text-muted-foreground" />
        </span>
      </span>
    </button>
  );
}
