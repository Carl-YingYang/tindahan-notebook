"use client";

// ── HOME SCREEN — Tindahan Ko dashboard ──
// Greeting + date, "Ngayong Araw" stats, "Mga Dapat Bantayan" alerts,
// "Nitong Linggo" mini chart, quick actions, at "Pinakabagong Tala".
// Data comes from the shared TanStack Query hooks; navigation via useAppNav().

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import {
  CalendarDays,
  NotebookPen,
  ScanLine,
  ShoppingBasket,
  Store,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AddUtangSheet } from "@/components/shared/add-utang-sheet";
import { QuickEntrySheet } from "@/components/shared/quick-entry-sheet";
import { SectionHeader } from "@/components/shared/section-header";
import { StatCard } from "@/components/shared/stat-card";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppNav } from "@/components/shell/nav-context";
import { useSummary } from "@/hooks/use-store";
import { formatLongDate, greetingForHour, peso } from "@/lib/format";
import { cn } from "@/lib/utils";
import { RecentRecords } from "@/features/home/recent-records";
import { TalaanDrawer } from "@/features/home/talaan-drawer";
import { WatchCard } from "@/features/home/watch-card";
import { WeekChart } from "@/features/home/week-chart";
import { DaySheet } from "@/features/home/day-sheet";

type SheetKind = null | "benta" | "gastos" | "utang";

interface QuickAction {
  key: "benta" | "gastos" | "utang" | "scan";
  label: string;
  icon: LucideIcon;
  className: string;
  onClick: () => void;
}

const STAT_CLASS = "flex-col items-start gap-1.5 p-2.5";

// Mount-guard without setState-in-effect (hydration-safe clock text)
const emptySubscribe = () => () => {};
function useMounted(): boolean {
  return useSyncExternalStore(emptySubscribe, () => true, () => false);
}

export default function HomeScreen() {
  const { go } = useAppNav();
  const {
    data: summary,
    isLoading: summaryLoading,
    isError: summaryError,
  } = useSummary();

  const mounted = useMounted();
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [dayDetail, setDayDetail] = useState<{ date: string; label: string } | null>(null);
  const [talaanOpen, setTalaanOpen] = useState(false);

  const greeting = mounted ? greetingForHour(new Date().getHours()) : "Kumusta!";
  const today = mounted ? formatLongDate() : "\u00A0";

  // Trend vs kahapon (from the 7-day buckets: index 5 = kahapon, 6 = ngayon)
  const trend = useMemo(() => {
    const d = summary?.weekDaily;
    if (!d || d.length < 7) return null;
    const kahapon = d[5];
    const ngayon = d[6];
    return {
      benta: ngayon.benta - kahapon.benta,
      gastos: ngayon.gastos - kahapon.gastos,
      net: ngayon.benta - ngayon.gastos - (kahapon.benta - kahapon.gastos),
    };
  }, [summary]);

  const trendSub = (diff: number, positiveIsGood = true) => {
    if (!mounted || !trend || diff === 0) return undefined;
    const up = diff > 0;
    const good = positiveIsGood ? up : !up;
    const Icon = up ? TrendingUp : TrendingDown;
    return (
      <span className={cn("inline-flex items-center gap-0.5 font-semibold", good ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500")}>
        <Icon className="size-3" />
        {up ? "+" : "-"}{peso(Math.abs(diff))} vs kahapon
      </span>
    );
  };

  const actions: QuickAction[] = [
    {
      key: "benta",
      label: "Add Benta",
      icon: ShoppingBasket,
      className:
        "border-emerald-200 bg-emerald-500/10 text-emerald-700 dark:border-emerald-500/20 dark:text-emerald-400",
      onClick: () => setSheet("benta"),
    },
    {
      key: "gastos",
      label: "Add Gastos",
      icon: Wallet,
      className:
        "border-rose-200 bg-rose-500/10 text-rose-700 dark:border-rose-500/20 dark:text-rose-400",
      onClick: () => setSheet("gastos"),
    },
    {
      key: "utang",
      label: "Add Utang",
      icon: NotebookPen,
      className:
        "border-orange-200 bg-orange-500/10 text-orange-700 dark:border-orange-500/20 dark:text-orange-400",
      onClick: () => setSheet("utang"),
    },
    {
      key: "scan",
      label: "Scan Resibo",
      icon: ScanLine,
      className: "border-primary/25 bg-primary/10 text-primary",
      onClick: () => go("restock", "scan"),
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-4">
      {/* ── Header (not sticky) ── */}
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="flex size-5 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Store className="size-3" />
            </span>
            <span className="text-[11px] font-bold uppercase tracking-widest text-primary">Tindahan Ko</span>
          </div>
          <h1 className="mt-1 text-xl font-extrabold leading-tight">{greeting}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{today}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Buksan ang Talaan (buwanang report)"
            onClick={() => setTalaanOpen(true)}
            className="flex size-9 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:text-primary touch-manipulation active:scale-95"
          >
            <CalendarDays className="size-[18px]" />
          </button>
          <ThemeToggle />
        </div>
      </header>

      {/* ── Ngayong Araw ── */}
      <section className="space-y-2">
        <SectionHeader title="Ngayong Araw" subtitle="Benta, gastos, at net ngayon" />
        {summaryError ? (
          <p className="px-1 text-sm text-muted-foreground">Hindi ma-load ang datos.</p>
        ) : !summary ? (
          <div className="grid grid-cols-3 gap-2">
            <Skeleton className="h-[100px] rounded-2xl" />
            <Skeleton className="h-[100px] rounded-2xl" />
            <Skeleton className="h-[100px] rounded-2xl" />
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <StatCard
              label="Benta"
              value={peso(summary.today.benta)}
              icon={ShoppingBasket}
              tone="benta"
              className={STAT_CLASS}
              loading={summaryLoading}
              sub={trendSub(trend?.benta ?? 0)}
            />
            <StatCard
              label="Gastos"
              value={peso(summary.today.gastos)}
              icon={Wallet}
              tone="gastos"
              className={STAT_CLASS}
              loading={summaryLoading}
              sub={trendSub(trend?.gastos ?? 0, false)}
            />
            <StatCard
              label="Net"
              value={peso(summary.today.net)}
              icon={TrendingUp}
              tone="net"
              className={STAT_CLASS}
              loading={summaryLoading}
              sub={trendSub(trend?.net ?? 0)}
            />
          </div>
        )}
      </section>

      {/* ── Mga Dapat Bantayan ── */}
      <section className="space-y-2">
        <SectionHeader title="Mga Dapat Bantayan" subtitle="Paubos, ubos, utang, at restock" />
        <WatchCard summary={summary} error={summaryError} />
      </section>

      {/* ── Nitong Linggo ── */}
      <section className="space-y-2">
        <SectionHeader title="Nitong Linggo" subtitle="Benta vs gastos sa loob ng 7 araw" />
        <div className="rounded-2xl border border-border bg-card p-4">
          {summary ? (
            <WeekChart
              daily={summary.weekDaily}
              onViewDay={(date, label) => {
                setDayDetail({ date, label });
              }}
            />
          ) : summaryError ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Hindi ma-load ang datos.
            </p>
          ) : (
            <Skeleton className="h-24 w-full rounded-xl" />
          )}
        </div>
      </section>

      {/* ── Mga Quick Action ── */}
      <section className="space-y-2">
        <SectionHeader title="Mga Quick Action" />
        <div className="grid grid-cols-2 gap-2">
          {actions.map((a) => (
            <button
              key={a.key}
              type="button"
              onClick={a.onClick}
              className={cn(
                "flex h-20 touch-manipulation flex-col items-center justify-center gap-1 rounded-2xl border border-transparent text-sm font-bold transition-transform active:scale-95",
                a.className
              )}
            >
              <a.icon className="size-5" />
              {a.label}
            </button>
          ))}
        </div>
      </section>

      {/* ── Pinakabagong Tala ── */}
      <section className="space-y-2">
        <SectionHeader title="Pinakabagong Tala" subtitle="Huling 5 tala ng benta at gastos" />
        <RecentRecords />
      </section>

      {/* ── Sheets ── */}
      <TalaanDrawer open={talaanOpen} onOpenChange={setTalaanOpen} />
      <QuickEntrySheet
        kind="benta"
        open={sheet === "benta"}
        onOpenChange={(v) => setSheet(v ? "benta" : null)}
      />
      <QuickEntrySheet
        kind="gastos"
        open={sheet === "gastos"}
        onOpenChange={(v) => setSheet(v ? "gastos" : null)}
      />
      <AddUtangSheet
        open={sheet === "utang"}
        onOpenChange={(v) => setSheet(v ? "utang" : null)}
      />
      <DaySheet
        open={dayDetail !== null}
        onOpenChange={(v) => !v && setDayDetail(null)}
        date={dayDetail?.date ?? null}
        label={dayDetail?.label}
      />
    </div>
  );
}
