"use client";

// ── DaySheet — detalyadong tala ng isang araw (benta + gastos) ──
// Opened from the Home "Nitong Linggo" chart after tapping a day.
// Every row can be deleted (mali ang input? burahin lang) with confirmation.

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  CalendarDays,
  Trash2,
} from "lucide-react";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
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
import { Skeleton } from "@/components/ui/skeleton";
import { apiDelete, apiGet } from "@/lib/api";
import { formatTime, peso } from "@/lib/format";
import { useRefreshAll } from "@/hooks/use-store";
import { cn } from "@/lib/utils";

interface DayRow {
  id: string;
  amount: number;
  category: string | null;
  note: string | null;
  date: string;
}

interface DayData {
  date: string;
  sales: DayRow[];
  expenses: DayRow[];
  totals: { benta: number; gastos: number; net: number };
}

function DayRowItem({
  row,
  kind,
  onRequestDelete,
}: {
  row: DayRow;
  kind: "sale" | "expense";
  onRequestDelete: (kind: "sale" | "expense", row: DayRow) => void;
}) {
  const isSale = kind === "sale";
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg",
          isSale
            ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400"
            : "bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400"
        )}
      >
        {isSale ? <ArrowDownCircle className="size-4" /> : <ArrowUpCircle className="size-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">
          {row.category || (isSale ? "Benta" : "Gastos")}
          {row.note ? <span className="font-normal text-muted-foreground"> · {row.note}</span> : null}
        </p>
        <p className="text-[11px] text-muted-foreground">{formatTime(row.date)}</p>
      </div>
      <span
        className={cn(
          "shrink-0 text-sm font-bold tabular-nums",
          isSale ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
        )}
      >
        {isSale ? peso(row.amount) : `-${peso(row.amount)}`}
      </span>
      <button
        type="button"
        aria-label={`Burahin ang ${row.category || (isSale ? "benta" : "gastos")} na ${peso(row.amount)}`}
        onClick={() => onRequestDelete(kind, row)}
        className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-all hover:bg-rose-50 hover:text-rose-600 active:scale-90 touch-manipulation dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}

export function DaySheet({
  open,
  onOpenChange,
  date,
  label,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  date: string | null;
  label?: string;
}) {
  const refreshAll = useRefreshAll();
  const [pending, setPending] = useState<{ kind: "sale" | "expense"; row: DayRow } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data, isLoading, error, refetch } = useQuery<DayData>({
    queryKey: ["day", date],
    queryFn: () => apiGet<DayData>(`/api/day?date=${date}`),
    enabled: open && !!date,
  });

  const confirmDelete = async () => {
    if (!pending) return;
    setDeleting(true);
    try {
      await apiDelete(pending.kind === "sale" ? `/api/sales/${pending.row.id}` : `/api/expenses/${pending.row.id}`);
      toast.success("Nabura ang tala");
      await refetch();
      refreshAll();
      setPending(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "May problema, subukan ulit");
    } finally {
      setDeleting(false);
    }
  };

  const t = data?.totals;
  const empty = data && data.sales.length === 0 && data.expenses.length === 0;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-w-md">
        <DrawerHeader className="text-left pb-2">
          <DrawerTitle className="flex items-center gap-2 text-lg">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <CalendarDays className="size-4" />
            </span>
            Tala ng {label ?? "araw"}
          </DrawerTitle>
          <DrawerDescription className="text-xs">Benta at gastos para sa araw na ito</DrawerDescription>
        </DrawerHeader>

        <div className="max-h-[60vh] space-y-3 overflow-y-auto nice-scroll px-4 pb-5">
          {/* Totals strip */}
          {isLoading ? (
            <div className="grid grid-cols-3 gap-2 rounded-2xl border border-border bg-card p-3">
              <Skeleton className="h-9 rounded-lg" />
              <Skeleton className="h-9 rounded-lg" />
              <Skeleton className="h-9 rounded-lg" />
            </div>
          ) : error ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {error instanceof Error ? error.message : "Hindi ma-load ang tala."}
            </p>
          ) : t ? (
            <div className="grid grid-cols-3 gap-2 rounded-2xl border border-border bg-card p-3 text-center">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Benta</p>
                <p className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">{peso(t.benta)}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Gastos</p>
                <p className="text-sm font-extrabold text-rose-600 dark:text-rose-400 tabular-nums">{peso(t.gastos)}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Net</p>
                <p
                  className={cn(
                    "text-sm font-extrabold tabular-nums",
                    t.net >= 0 ? "text-foreground" : "text-rose-600 dark:text-rose-400"
                  )}
                >
                  {t.net >= 0 ? "+" : "-"}
                  {peso(Math.abs(t.net))}
                </p>
              </div>
            </div>
          ) : null}

          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 rounded-xl" />
              <Skeleton className="h-12 rounded-xl" />
              <Skeleton className="h-12 rounded-xl" />
            </div>
          ) : empty ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Walang tala sa araw na ito.</p>
          ) : data ? (
            <>
              {data.sales.length > 0 && (
                <section>
                  <p className="mb-1 flex items-center gap-1.5 px-1 text-[11px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                    <ArrowDownCircle className="size-3.5" aria-hidden="true" />
                    Benta ({data.sales.length})
                  </p>
                  <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                    {data.sales.map((r) => (
                      <DayRowItem key={r.id} row={r} kind="sale" onRequestDelete={(k, row) => setPending({ kind: k, row })} />
                    ))}
                  </div>
                </section>
              )}
              {data.expenses.length > 0 && (
                <section>
                  <p className="mb-1 flex items-center gap-1.5 px-1 text-[11px] font-bold uppercase tracking-wide text-rose-600 dark:text-rose-400">
                    <ArrowUpCircle className="size-3.5" aria-hidden="true" />
                    Gastos ({data.expenses.length})
                  </p>
                  <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                    {data.expenses.map((r) => (
                      <DayRowItem key={r.id} row={r} kind="expense" onRequestDelete={(k, row) => setPending({ kind: k, row })} />
                    ))}
                  </div>
                </section>
              )}
              <p className="px-1 pt-1 text-[11px] text-muted-foreground">
                Tip: Pindutin ang 🗑 katabi ng tala para burahin kung mali.
              </p>
            </>
          ) : null}
        </div>

        {/* Delete confirmation */}
        <AlertDialog open={pending !== null} onOpenChange={(v) => !v && setPending(null)}>
          <AlertDialogContent className="sm:max-w-sm">
            <AlertDialogHeader>
              <AlertDialogTitle>Burahin ang tala?</AlertDialogTitle>
              <AlertDialogDescription>
                {pending?.kind === "sale"
                  ? `Buburahin ang benta na ${peso(pending.row.amount)}. Hindi na ito maibabalik.`
                  : `Buburahin ang gastos na ${peso(pending?.row.amount ?? 0)}. Hindi na ito maibabalik.`}
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
      </DrawerContent>
    </Drawer>
  );
}
