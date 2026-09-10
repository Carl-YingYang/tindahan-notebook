"use client";

// ── "Pinakabagong Tala" — 5 newest records merged from sales + expenses ──

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowDownCircle, ArrowUpCircle, Inbox, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { apiDelete } from "@/lib/api";
import { useExpenses, useSales, useRefreshAll } from "@/hooks/use-store";
import { formatDayLabel, peso } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Expense, Sale } from "@/types";

interface RecordRow {
  /** Prefixed id (sale-…/expense-…) — only used as a React key */
  id: string;
  /** Raw DB id used for DELETE calls */
  refId: string;
  kind: "sale" | "expense";
  amount: number;
  category: string | null;
  note: string | null;
  date: string;
}

export function RecentRecords() {
  const { data: sales, isLoading: salesLoading, isError: salesError } = useSales();
  const { data: expenses, isLoading: expensesLoading, isError: expensesError } = useExpenses();
  const refreshAll = useRefreshAll();
  const [pending, setPending] = useState<RecordRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const rows = useMemo<RecordRow[]>(() => {
    const merged: RecordRow[] = [
      ...(sales ?? []).map((s: Sale) => ({
        id: `sale-${s.id}`,
        refId: s.id,
        kind: "sale" as const,
        amount: s.amount,
        category: s.category ?? null,
        note: s.note ?? null,
        date: s.date,
      })),
      ...(expenses ?? []).map((e: Expense) => ({
        id: `expense-${e.id}`,
        refId: e.id,
        kind: "expense" as const,
        amount: e.amount,
        category: e.category ?? null,
        note: e.note ?? null,
        date: e.date,
      })),
    ];
    return merged
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  }, [sales, expenses]);

  const loading = salesLoading || expensesLoading;
  const error = salesError || expensesError;

  const confirmDelete = async () => {
    if (!pending) return;
    setDeleting(true);
    try {
      await apiDelete(pending.kind === "sale" ? `/api/sales/${pending.refId}` : `/api/expenses/${pending.refId}`);
      toast.success("Nabura ang tala");
      refreshAll();
      setPending(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "May problema, subukan ulit");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
      {loading ? (
        <div className="space-y-4 p-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="size-9 shrink-0 rounded-xl" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-2/3 rounded-md" />
                <Skeleton className="h-3 w-1/3 rounded-md" />
              </div>
              <Skeleton className="h-4 w-14 shrink-0 rounded-md" />
            </div>
          ))}
        </div>
      ) : error && rows.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">Hindi ma-load ang datos.</p>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Wala pang tala"
          description="Magsimula gamit ang mga quick action sa itaas."
          className="py-8"
        />
      ) : (
        rows.map((r) => {
          const isSale = r.kind === "sale";
          return (
            <div key={r.id} className="flex items-center gap-1.5 pl-4 pr-1.5 transition-colors hover:bg-accent/40">
              <button
                type="button"
                onClick={() => setPending(r)}
                aria-label={`Burahin ang tala: ${r.category || (isSale ? "Benta" : "Gastos")} ${peso(r.amount)}`}
                className="flex min-w-0 flex-1 items-center gap-3 py-3 text-left touch-manipulation"
              >
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-xl",
                    isSale
                      ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400"
                      : "bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400"
                  )}
                >
                  {isSale ? (
                    <ArrowDownCircle className="size-5" />
                  ) : (
                    <ArrowUpCircle className="size-5" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">
                    {r.category || (isSale ? "Benta" : "Gastos")}
                    {r.note ? (
                      <span className="font-normal text-muted-foreground"> · {r.note}</span>
                    ) : null}
                  </span>
                  <span className="block text-xs text-muted-foreground">{formatDayLabel(r.date)}</span>
                </span>
                <span
                  className={cn(
                    "shrink-0 text-sm font-bold tabular-nums",
                    isSale
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-rose-600 dark:text-rose-400"
                  )}
                >
                  {isSale ? peso(r.amount) : `-${peso(r.amount)}`}
                </span>
              </button>
              <button
                type="button"
                aria-label={`Burahin ang tala na ${peso(r.amount)}`}
                onClick={() => setPending(r)}
                className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground/60 transition-all hover:bg-rose-50 hover:text-rose-600 active:scale-90 touch-manipulation dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          );
        })
      )}

      {/* Delete confirmation — burahin ang maling tala */}
      <AlertDialog open={pending !== null} onOpenChange={(v) => !v && setPending(null)}>
        <AlertDialogContent className="sm:max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Burahin ang tala?</AlertDialogTitle>
            <AlertDialogDescription>
              {pending?.kind === "sale"
                ? `Buburahin ang benta na ${peso(pending.amount)}${pending.note ? ` (${pending.note})` : ""}. Hindi na ito maibabalik.`
                : `Buburahin ang gastos na ${peso(pending?.amount ?? 0)}${pending?.note ? ` (${pending.note})` : ""}. Hindi na ito maibabalik.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Hindi na lang</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleting ? "Binubura…" : "Burahin"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
