"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarDays, Download, TrendingUp, Trophy, ChevronLeft, ChevronRight } from "lucide-react";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiGet } from "@/lib/api";
import { peso, manilaDateStr } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SectionHeader } from "@/components/shared/section-header";

// ── Types ────────────────────────────────────────────────────────

interface MonthReport {
  month: string;
  label: string;
  benta: number;
  gastos: number;
  net: number;
  salesCount: number;
  expensesCount: number;
  activeDays: number;
  daysInMonth: number;
  avgDailyNet: number;
  bestDay: { date: string; benta: number } | null;
  gastosByCategory: { category: string; amount: number }[];
  bentaByCategory: { category: string; amount: number }[];
  daily: { date: string; label: string; day: number; benta: number; gastos: number; net: number }[];
  topExpenses: { id: string; amount: number; category: string; note: string | null; date: string }[];
  transactions: { id: string; type: "benta" | "gastos"; amount: number; category: string; note: string | null; date: string }[];
}

const MONTH_NAMES = ["Enero", "Pebrero", "Marso", "Abril", "Mayo", "Hunyo", "Hulyo", "Agosto", "Setyembre", "Oktubre", "Nobyembre", "Disyembre"];

function monthKey(d: Date): string {
  return manilaDateStr(d).slice(0, 7);
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

/** yyyy-mm shifted by n months (negative = back in time) */
function shiftMonth(key: string, n: number): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ── CSV export (client-side, works from already-fetched data) ────

function toCsv(report: MonthReport): string {
  const esc = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines: string[] = [];
  lines.push(`Talaan,${esc(report.label)}`);
  lines.push("");
  lines.push("Petsa,Turi,Category,Note,Halaga (PHP)");
  for (const t of report.transactions) {
    lines.push([t.date.slice(0, 10), t.type === "benta" ? "Benta" : "Gastos", esc(t.category), esc(t.note ?? ""), t.amount.toFixed(2)].join(","));
  }
  lines.push("");
  lines.push(`Benta,${report.benta.toFixed(2)}`);
  lines.push(`Gastos,${report.gastos.toFixed(2)}`);
  lines.push(`Net,${report.net.toFixed(2)}`);
  return lines.join("\n");
}

function downloadCsv(report: MonthReport) {
  try {
    const blob = new Blob(["\uFEFF" + toCsv(report)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `talaan-${report.month}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success("Nai-download ang CSV!");
  } catch {
    toast.error("Hindi ma-download ang CSV, subukan ulit");
  }
}

// ── Component ────────────────────────────────────────────────────

export function TalaanDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const now = new Date();
  const thisMonth = monthKey(now);
  // Allow browsing up to 24 months back
  const oldestKey = shiftMonth(thisMonth, -24);
  const [selected, setSelected] = useState(thisMonth);
  const atOldest = selected <= oldestKey;
  const atNewest = selected >= thisMonth;

  const { data: report, isLoading } = useQuery({
    queryKey: ["report-month", selected],
    queryFn: () => apiGet<MonthReport>(`/api/reports/month?month=${selected}`),
    enabled: open,
    staleTime: 30_000,
  });

  // Trend vs the previous month (generic — works for any selected month)
  const prevKey = shiftMonth(selected, -1);
  const { data: prevReport } = useQuery({
    queryKey: ["report-month", prevKey],
    queryFn: () => apiGet<MonthReport>(`/api/reports/month?month=${prevKey}`),
    enabled: open,
    staleTime: 60_000,
  });

  const maxCategory = useMemo(
    () => Math.max(1, ...(report?.gastosByCategory.map((c) => c.amount) ?? [1])),
    [report]
  );

  const trendText = useMemo(() => {
    if (!report || !prevReport || prevReport.benta === 0) return null;
    const diff = report.benta - prevReport.benta;
    const pct = Math.round((diff / prevReport.benta) * 100);
    if (pct === 0) return "Kapareho ng nakaraang buwan";
    return `${pct > 0 ? "+" : ""}${pct}% benta vs ${monthLabel(prevKey)}`;
  }, [report, prevReport, prevKey]);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-w-md">
        <DrawerHeader className="text-left pb-2">
          <DrawerTitle className="flex items-center gap-2 text-lg">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <CalendarDays className="size-4" />
            </span>
            Talaan
          </DrawerTitle>
          <DrawerDescription className="text-xs">Buwanang benta, gastos, at neto ng tindahan</DrawerDescription>
        </DrawerHeader>

        <div className="px-4 pb-6 space-y-4 overflow-y-auto nice-scroll max-h-[62vh]">
          {/* Month navigation — ← [Month Year] → with reset */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Nakaraang buwan"
              disabled={atOldest}
              onClick={() => setSelected(shiftMonth(selected, -1))}
              className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-all hover:text-foreground disabled:pointer-events-none disabled:opacity-40 touch-manipulation active:scale-95"
            >
              <ChevronLeft className="size-4" />
            </button>
            <div className="flex h-10 min-w-0 flex-1 items-center justify-center rounded-xl border border-primary/30 bg-primary/5">
              <p className="truncate text-sm font-extrabold text-primary">{monthLabel(selected)}</p>
            </div>
            <button
              type="button"
              aria-label="Susunod na buwan"
              disabled={atNewest}
              onClick={() => setSelected(shiftMonth(selected, 1))}
              className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-all hover:text-foreground disabled:pointer-events-none disabled:opacity-40 touch-manipulation active:scale-95"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
          {selected !== thisMonth && (
            <button
              type="button"
              onClick={() => setSelected(thisMonth)}
              className="mx-auto flex h-8 items-center rounded-full border border-dashed border-border px-3 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground touch-manipulation active:scale-95"
            >
              Bumalik sa ngayong buwan
            </button>
          )}

          {isLoading || !report ? (
            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-3 gap-2">
                <Skeleton className="h-20 rounded-2xl" />
                <Skeleton className="h-20 rounded-2xl" />
                <Skeleton className="h-20 rounded-2xl" />
              </div>
              <Skeleton className="h-28 rounded-2xl" />
              <Skeleton className="h-40 rounded-2xl" />
            </div>
          ) : (
            <>
              {/* Totals */}
              <div className="card-surface rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold">{report.label}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadCsv(report)}
                    className="h-8 gap-1.5 rounded-lg border-border text-xs font-semibold"
                  >
                    <Download className="size-3.5" />
                    CSV
                  </Button>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-emerald-500/10 p-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Benta</p>
                    <p className="text-sm font-extrabold text-emerald-700 dark:text-emerald-400 tabular">{peso(report.benta)}</p>
                  </div>
                  <div className="rounded-xl bg-rose-500/10 p-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-400">Gastos</p>
                    <p className="text-sm font-extrabold text-rose-700 dark:text-rose-400 tabular">{peso(report.gastos)}</p>
                  </div>
                  <div className="rounded-xl bg-amber-500/10 p-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">Net</p>
                    <p className={cn("text-sm font-extrabold tabular", report.net < 0 ? "text-rose-600 dark:text-rose-400" : "text-foreground")}>{peso(report.net)}</p>
                  </div>
                </div>
                <div className="mt-3 space-y-1 text-[11px] text-muted-foreground">
                  <p className="flex items-center gap-1.5">
                    <TrendingUp className="size-3.5 text-emerald-500" />
                    Average net kada araw: <span className="font-bold text-foreground tabular">{peso(report.avgDailyNet)}</span>
                    {trendText && <span className="ml-auto font-semibold text-primary">{trendText}</span>}
                  </p>
                  {report.bestDay && (
                    <p className="flex items-center gap-1.5">
                      <Trophy className="size-3.5 text-amber-500" />
                      Pinakamalakas na araw: <span className="font-bold text-foreground">{report.bestDay.date.slice(8)}</span> ng buwan — <span className="font-bold tabular">{peso(report.bestDay.benta)}</span>
                    </p>
                  )}
                  <p>
                    {report.salesCount} benta records · {report.expensesCount} gastos records · {report.activeDays}/{report.daysInMonth} araw may tala
                  </p>
                </div>
              </div>

              {/* Gastos by category */}
              <div className="card-surface rounded-2xl border border-border bg-card p-4">
                <SectionHeader title="Gastos ayon sa Category" />
                {report.gastosByCategory.length === 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">Wala pang gastos ngayong buwan.</p>
                ) : (
                  <div className="mt-3 space-y-2.5">
                    {report.gastosByCategory.map((c) => (
                      <div key={c.category}>
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold">{c.category}</span>
                          <span className="font-bold tabular text-rose-600 dark:text-rose-400">{peso(c.amount)}</span>
                        </div>
                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-rose-400 to-rose-500"
                            style={{ width: `${Math.round((c.amount / maxCategory) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Top gastos */}
              {report.topExpenses.length > 0 && (
                <div className="card-surface rounded-2xl border border-border bg-card p-4">
                  <SectionHeader title="Pinakamalaking Gastos" />
                  <div className="mt-2 divide-y divide-border">
                    {report.topExpenses.map((e) => (
                      <div key={e.id} className="flex items-center justify-between py-2 text-sm">
                        <span className="min-w-0 truncate">
                          {e.note || e.category}
                          <span className="ml-1.5 text-[11px] text-muted-foreground">{e.date.slice(8, 10)} ng buwan</span>
                        </span>
                        <span className="ml-2 shrink-0 font-bold tabular text-rose-600 dark:text-rose-400">-{peso(e.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Daily breakdown */}
              <div className="card-surface rounded-2xl border border-border bg-card p-4">
                <SectionHeader title="Araw-araw" subtitle="Benta / Gastos / Net" />
                <div className="mt-2 max-h-64 space-y-1 overflow-y-auto nice-scroll">
                  {report.daily
                    .filter((d) => d.benta > 0 || d.gastos > 0)
                    .map((d) => (
                      <div key={d.date} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-xs hover:bg-muted/50">
                        <span className="w-14 shrink-0 font-semibold">
                          {d.label} <span className="text-muted-foreground">{d.day}</span>
                        </span>
                        <span className="tabular text-emerald-600 dark:text-emerald-400">+{peso(d.benta)}</span>
                        <span className="tabular text-rose-500">-{peso(d.gastos)}</span>
                        <span className={cn("w-16 text-right font-bold tabular", d.net < 0 ? "text-rose-600 dark:text-rose-400" : "text-foreground")}>{peso(d.net)}</span>
                      </div>
                    ))}
                  {report.daily.every((d) => d.benta === 0 && d.gastos === 0) && (
                    <p className="py-3 text-center text-xs text-muted-foreground">Wala pang tala ngayong buwan.</p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
