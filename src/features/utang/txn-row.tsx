"use client";

import { ArrowDownCircle, ArrowUpCircle, Trash2, CalendarClock, CalendarPlus } from "lucide-react";
import { peso, formatDayLabel, formatTime, dueInfo, DUE_TONE_CLASS } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { UtangTxn } from "@/types";

/**
 * One utang/payment entry in the customer history list.
 * utang = ArrowDownCircle (orange, +peso) · payment = ArrowUpCircle (emerald, -peso).
 * Tapping the due chip opens the due-date editor (onRequestDue); utang rows
 * without a due date show a dashed "set due" chip. The trash and due buttons
 * keep ≥44px tap areas with the p-N -m-N technique.
 */
export function UtangTxnRow({
  txn,
  onRequestDelete,
  onRequestDue,
  disabled,
}: {
  txn: UtangTxn;
  onRequestDelete: (txn: UtangTxn) => void;
  onRequestDue?: (txn: UtangTxn) => void;
  disabled?: boolean;
}) {
  const isUtang = txn.type === "utang";
  const due = isUtang ? dueInfo(txn.dueDate) : null;

  return (
    <div className="flex items-center gap-2.5 px-3 py-3">
      {isUtang ? (
        <ArrowDownCircle aria-hidden="true" className="size-5 shrink-0 text-orange-500" strokeWidth={2} />
      ) : (
        <ArrowUpCircle aria-hidden="true" className="size-5 shrink-0 text-emerald-500" strokeWidth={2} />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{txn.note?.trim() || (isUtang ? "Utang" : "Bayad")}</p>
        <p className="truncate text-xs text-muted-foreground">
          {formatDayLabel(txn.date)} · {formatTime(txn.date)}
          {due && onRequestDue ? (
            <button
              type="button"
              aria-label={`I-edit ang due date: ${due.label}`}
              disabled={disabled}
              onClick={() => onRequestDue(txn)}
              className={cn(
                "ml-1.5 inline-flex -my-1.5 items-center gap-0.5 rounded-full border p-1.5 text-[10px] font-bold leading-4 transition touch-manipulation active:scale-95 disabled:opacity-50",
                DUE_TONE_CLASS[due.tone]
              )}
            >
              <CalendarClock className="size-2.5" aria-hidden="true" />
              {due.label}
            </button>
          ) : due ? (
            <span
              className={cn(
                "ml-1.5 inline-flex items-center gap-0.5 rounded-full border px-1.5 py-px text-[10px] font-bold leading-4",
                DUE_TONE_CLASS[due.tone]
              )}
            >
              <CalendarClock className="size-2.5" aria-hidden="true" />
              {due.label}
            </span>
          ) : null}
        </p>
        {isUtang && !due && onRequestDue && (
          <button
            type="button"
            aria-label="Magtakda ng due date"
            disabled={disabled}
            onClick={() => onRequestDue(txn)}
            className="mt-0.5 -my-1 inline-flex items-center gap-1 rounded-full border border-dashed border-border p-1.5 text-[10px] font-semibold leading-4 text-muted-foreground transition touch-manipulation active:scale-95 hover:border-primary/50 hover:text-primary disabled:opacity-50"
          >
            <CalendarPlus className="size-2.5" aria-hidden="true" />
            Mag-set ng due
          </button>
        )}
      </div>
      <p
        className={cn(
          "shrink-0 text-sm font-extrabold tracking-tight",
          isUtang ? "text-orange-600 dark:text-orange-400" : "text-emerald-600 dark:text-emerald-500"
        )}
      >
        {isUtang ? `+${peso(txn.amount)}` : `-${peso(txn.amount)}`}
      </p>
      <button
        type="button"
        aria-label="Burahin ang tala"
        disabled={disabled}
        onClick={() => onRequestDelete(txn)}
        className="-m-3.5 rounded-full p-3.5 text-muted-foreground transition-colors hover:text-rose-500 disabled:pointer-events-none disabled:opacity-50"
      >
        <Trash2 aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}
