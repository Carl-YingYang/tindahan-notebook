"use client";

// ── "Mga Dapat Bantayan" card — alerts built from the summary ──
// Paubos / ubos paninda, kabuuang utang, at pending restock list.
// Tapping a row jumps to the matching tab via useAppNav().

import type { ReactNode } from "react";
import { CheckCircle2, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppNav } from "@/components/shell/nav-context";
import { peso } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { SummaryData } from "@/types";

function WatchRow({
  dot,
  onClick,
  children,
}: {
  dot: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-11 w-full touch-manipulation items-center justify-between gap-2 rounded-xl px-2 py-2 text-left text-sm text-muted-foreground transition-transform hover:bg-muted/60 active:scale-[0.99]"
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <span className={cn("size-2 shrink-0 rounded-full", dot)} />
        <span className="block min-w-0 truncate">{children}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" />
    </button>
  );
}

const EMPH = "font-semibold text-foreground";

export function WatchCard({
  summary,
  error,
}: {
  summary?: SummaryData;
  error?: boolean;
}) {
  const { go } = useAppNav();

  const rows: { key: string; dot: string; label: ReactNode; onClick: () => void }[] = [];

  if (summary) {
    if (summary.stock.paubos > 0) {
      rows.push({
        key: "paubos",
        dot: "bg-orange-500",
        label: (
          <>
            <span className={EMPH}>{summary.stock.paubos}</span> na paninda ang paubos
          </>
        ),
        onClick: () => go("tinda"),
      });
    }
    if (summary.stock.ubos > 0) {
      rows.push({
        key: "ubos",
        dot: "bg-rose-500",
        label: (
          <>
            <span className={EMPH}>{summary.stock.ubos}</span> na paninda ang ubos na
          </>
        ),
        onClick: () => go("tinda"),
      });
    }
    // Utang row: always show when there is outstanding utang.
    if (summary.utang.outstanding > 0) {
      rows.push({
        key: "utang",
        dot: "bg-orange-500",
        label: (
          <>
            <span className={EMPH}>{peso(summary.utang.outstanding)}</span> kabuuang utang
            {summary.utang.customerCount > 0 ? (
              <> mula sa {summary.utang.customerCount} suki</>
            ) : null}
          </>
        ),
        onClick: () => go("utang"),
      });
    }
    // Due-na row (more urgent — pinned right after utang when present)
    if (summary.utang.dueCount > 0) {
      rows.push({
        key: "utang-due",
        dot: "bg-rose-500",
        label: (
          <>
            <span className={EMPH}>{summary.utang.dueCount}</span> suki ang due na ({
              peso(summary.utang.dueTotal)
            })
          </>
        ),
        onClick: () => go("utang"),
      });
    }
    if (summary.shopping.pendingCount > 0) {
      rows.push({
        key: "restock",
        dot: "bg-amber-500",
        label: (
          <>
            <span className={EMPH}>{summary.shopping.pendingCount}</span> items sa restock list (
            {peso(summary.shopping.pendingEstTotal)})
          </>
        ),
        onClick: () => go("restock"),
      });
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      {!summary && !error ? (
        <div className="space-y-2.5 py-1">
          <Skeleton className="h-6 w-3/4 rounded-lg" />
          <Skeleton className="h-6 w-2/3 rounded-lg" />
          <Skeleton className="h-6 w-1/2 rounded-lg" />
        </div>
      ) : !summary ? (
        <p className="py-2 text-sm text-muted-foreground">Hindi ma-load ang datos.</p>
      ) : rows.length === 0 ? (
        <div className="flex items-center gap-2 px-1 py-2.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="size-4 shrink-0" />
          Maayos ang tindahan ngayong araw!
        </div>
      ) : (
        <div className="-mx-2 space-y-0.5">
          {rows.map((r) => (
            <WatchRow key={r.key} dot={r.dot} onClick={r.onClick}>
              {r.label}
            </WatchRow>
          ))}
        </div>
      )}
    </div>
  );
}
