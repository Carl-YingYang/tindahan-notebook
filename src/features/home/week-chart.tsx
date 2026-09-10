"use client";

// ── "Nitong Linggo" — 7-day stacked mini bar chart (no chart libs) ──
// One thin column per Manila day: emerald portion = benta, rose portion = gastos.
// Heights are proportional to the busiest day of the week. Tap a column to see
// that day's benta / gastos / net; tap again to clear. Bars animate in.

import { useState } from "react";
import { motion } from "framer-motion";
import { ListCollapse } from "lucide-react";

import { cn } from "@/lib/utils";
import { peso } from "@/lib/format";
import type { DailyBucket } from "@/types";

const BENTA_BAR = "bg-emerald-400 dark:bg-emerald-500/70";
const GASTOS_BAR = "bg-rose-300 dark:bg-rose-500/50";

export function WeekChart({
  daily,
  onViewDay,
}: {
  daily: DailyBucket[];
  /** Opens the day-detail sheet (benta/gastos list) for the selected Manila date */
  onViewDay?: (date: string, label: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  const hasData = daily.some((d) => d.benta > 0 || d.gastos > 0);

  if (!hasData) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Wala pang tala nitong linggo.
      </p>
    );
  }

  // Tallest combined day defines the 100% height.
  const max = Math.max(1, ...daily.map((d) => d.benta + d.gastos));
  const sel = daily.find((d) => d.date === selected) ?? null;

  return (
    <div>
      {/* Detail slot — fixed height so the layout never jumps */}
      <div className="mb-1 flex h-5 items-center justify-between gap-2">
        {sel ? (
          <motion.p
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15 }}
            className="truncate text-[11px] font-semibold"
          >
            <span className="text-muted-foreground">{sel.label}</span>
            {sel.benta > 0 && <span className="ml-1.5 text-emerald-600 dark:text-emerald-400">₱{sel.benta.toLocaleString("en-PH")}</span>}
            {sel.gastos > 0 && <span className="ml-1 text-rose-500">-₱{sel.gastos.toLocaleString("en-PH")}</span>}
            <span className="ml-1 text-muted-foreground">
              = {sel.benta - sel.gastos >= 0 ? "+" : "-"}₱{Math.abs(sel.benta - sel.gastos).toLocaleString("en-PH")}
            </span>
          </motion.p>
        ) : (
          <p className="text-[11px] text-muted-foreground/70">Pindutin ang araw para makita</p>
        )}

        <div className="flex shrink-0 items-center gap-3">
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <span className={cn("size-2 rounded-full", BENTA_BAR)} />
            Benta
          </span>
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <span className={cn("size-2 rounded-full", GASTOS_BAR)} />
            Gastos
          </span>
        </div>
      </div>

      <div className="flex h-24 items-end justify-between gap-1">
        {daily.map((d, i) => {
          const isSel = selected === d.date;
          const bentaPct = Math.min(100, (d.benta / max) * 100);
          const gastosPct = Math.min(100, (d.gastos / max) * 100);
          const dimmed = selected !== null && !isSel;
          return (
            <button
              key={d.date}
              type="button"
              aria-pressed={isSel}
              aria-label={`${d.label}: benta ${peso(d.benta)}, gastos ${peso(d.gastos)}`}
              onClick={() => setSelected(isSel ? null : d.date)}
              className={cn(
                "flex h-full flex-1 cursor-pointer flex-col items-center justify-end gap-1 rounded-lg pb-0.5 transition-colors touch-manipulation",
                isSel && "bg-primary/5"
              )}
            >
              <div className="flex min-h-0 w-4/6 flex-1 flex-col justify-end gap-[2px]">
                {d.benta > 0 && (
                  <motion.div
                    className={cn("w-full rounded-t", BENTA_BAR)}
                    initial={{ height: "0%" }}
                    animate={{ height: `${bentaPct}%`, opacity: dimmed ? 0.45 : 1 }}
                    transition={{ duration: 0.4, delay: i * 0.04, ease: "easeOut" }}
                    style={{ minHeight: 2 }}
                  />
                )}
                {d.gastos > 0 && (
                  <motion.div
                    className={cn("w-full", GASTOS_BAR, d.benta === 0 && "rounded-t")}
                    initial={{ height: "0%" }}
                    animate={{ height: `${gastosPct}%`, opacity: dimmed ? 0.45 : 1 }}
                    transition={{ duration: 0.4, delay: i * 0.04 + 0.02, ease: "easeOut" }}
                    style={{ minHeight: 2 }}
                  />
                )}
              </div>
              <span
                className={cn(
                  "text-[10px] leading-none",
                  isSel ? "font-bold text-foreground" : "text-muted-foreground"
                )}
              >
                {d.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Day-detail affordance — visible only while a day is selected */}
      {sel && onViewDay && (
        <motion.button
          type="button"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15 }}
          onClick={() => onViewDay(sel.date, sel.label)}
          className="mt-2 flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-primary/40 bg-primary/5 text-[12px] font-bold text-primary transition-all hover:bg-primary/10 active:scale-[0.98] touch-manipulation"
        >
          <ListCollapse className="size-4" aria-hidden="true" />
          Tingnan ang mga tala ng {sel.label}
        </motion.button>
      )}
    </div>
  );
}
