"use client";

// ── "Isara ang Tinda" — end-of-day recap sheet on Home ───────────
// A friendly closing-time summary of today: benta/gastos/net plus the things
// to keep an eye on (utang, paubos/ubos, restock list). Deterministic local
// data from /api/summary only — no AI. One tap copies a shareable Taglish text.

import { useState } from "react";
import {
  CalendarClock,
  ClipboardCopy,
  FileText,
  Package,
  HandCoins,
  ShoppingBasket,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSummary } from "@/hooks/use-store";
import { formatLongDate, peso } from "@/lib/format";
import { useMounted } from "@/features/home/use-mounted";
import { cn } from "@/lib/utils";
import type { SummaryData } from "@/types";

export function RecapSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { data: summary, isLoading } = useSummary();
  const mounted = useMounted();
  const [copying, setCopying] = useState(false);

  const today = summary?.today;
  const utang = summary?.utang;
  const stock = summary?.stock;
  const shopping = summary?.shopping;

  const bestDay = (summary?.weekDaily ?? [])
    .filter((d) => d.benta > 0)
    .sort((a, b) => b.benta - a.benta)[0];

  function buildRecapText(s: SummaryData): string {
    const lines = [
      `Recap ng tindahan — ${mounted ? formatLongDate() : ""}`.trim(),
      `Benta: ${peso(s.today.benta)}`,
      `Gastos: ${peso(s.today.gastos)}`,
      `Net: ${peso(s.today.net)}`,
    ];
    if (s.utang.outstanding > 0) {
      lines.push(`Utang: ${peso(s.utang.outstanding)} (${s.utang.customerCount} suki)`);
    }
    if (s.stock.paubos + s.stock.ubos > 0) {
      lines.push(`Panindang paubos/ubos: ${s.stock.paubos + s.stock.ubos}`);
    }
    if (s.shopping.pendingCount > 0) {
      lines.push(`Restock list: ${s.shopping.pendingCount} items (${peso(s.shopping.pendingEstTotal)})`);
    }
    return lines.join("\n");
  }

  async function handleCopy() {
    if (!summary) return;
    setCopying(true);
    try {
      const msg = buildRecapText(summary);
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(msg);
        toast.success("Nakopya ang recap — i-paste kahit saan!");
      } else {
        toast.error("Hindi suportado ang pag-copy sa device na ito");
      }
    } catch {
      toast.error("Hindi nakopya, subukan ulit");
    } finally {
      setCopying(false);
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-w-md">
        <DrawerHeader className="text-left pb-2">
          <DrawerTitle className="flex items-center gap-2 text-lg">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <FileText className="size-4" />
            </span>
            Recap ngayong araw
          </DrawerTitle>
          <DrawerDescription className="text-xs">
            {mounted ? formatLongDate() : "\u00A0"}
          </DrawerDescription>
        </DrawerHeader>

        <div className="space-y-4 px-4 pb-2">
          {isLoading || !summary || !today ? (
            <div className="space-y-2">
              <Skeleton className="h-20 w-full rounded-2xl" />
              <Skeleton className="h-24 w-full rounded-2xl" />
            </div>
          ) : (
            <>
              {/* Money rows */}
              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="space-y-2.5">
                  <RecapRow
                    icon={ShoppingBasket}
                    iconClass="bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400"
                    label="Benta"
                    value={peso(today.benta)}
                    valueClass="text-emerald-600 dark:text-emerald-400"
                  />
                  <RecapRow
                    icon={Wallet}
                    iconClass="bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400"
                    label="Gastos"
                    value={peso(today.gastos)}
                    valueClass="text-rose-600 dark:text-rose-400"
                  />
                  <div className="border-t border-dashed border-border pt-2.5">
                    <RecapRow
                      icon={TrendingUp}
                      iconClass="bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400"
                      label="Net kita"
                      value={peso(today.net)}
                      valueClass={today.net < 0 ? "text-rose-600 dark:text-rose-400" : "text-foreground"}
                      big
                    />
                  </div>
                </div>
              </div>

              {/* Watch list */}
              <div className="rounded-2xl border border-border bg-card p-4">
                <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  Iba pang dapat bantayan
                </p>
                <div className="space-y-2.5">
                  {utang && (
                    <RecapNote
                      icon={HandCoins}
                      text={`${peso(utang.outstanding)} natitirang utang mula sa ${utang.customerCount} suki`}
                      extra={utang.dueCount > 0 ? `${utang.dueCount} suki ang due na` : undefined}
                      tone={utang.outstanding > 0 ? "orange" : "muted"}
                    />
                  )}
                  {stock && (
                    <RecapNote
                      icon={Package}
                      text={
                        stock.paubos + stock.ubos > 0
                          ? `${stock.paubos} paubos · ${stock.ubos} ubos sa paninda`
                          : `Okay ang stock — ${stock.total} paninda`
                      }
                      tone={stock.paubos + stock.ubos > 0 ? "orange" : "muted"}
                    />
                  )}
                  {shopping && shopping.pendingCount > 0 && (
                    <RecapNote
                      icon={CalendarClock}
                      text={`${shopping.pendingCount} items sa restock list (${peso(shopping.pendingEstTotal)})`}
                      tone="amber"
                    />
                  )}
                  {bestDay && (
                    <RecapNote
                      icon={TrendingUp}
                      text={`Pinakamalakas na araw nitong linggo: ${bestDay.label} (${peso(bestDay.benta)} benta)`}
                      tone="emerald"
                    />
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] pt-3">
          <Button
            onClick={() => void handleCopy()}
            disabled={!summary || copying}
            className="btn-hero h-12 w-full rounded-2xl text-base font-bold"
            size="lg"
          >
            <ClipboardCopy className="size-5" />
            {copying ? "Kinokopya…" : "Kopyahin ang recap"}
          </Button>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Pang-share sa pamilya o i-message sa sarili para sa record
          </p>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function RecapRow({
  icon: Icon,
  iconClass,
  label,
  value,
  valueClass,
  big,
}: {
  icon: React.ComponentType<{ className?: string }>;
  iconClass: string;
  label: string;
  value: string;
  valueClass?: string;
  big?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", iconClass)}>
        <Icon className="size-[18px]" />
      </span>
      <span className={cn("flex-1 font-semibold", big ? "text-sm" : "text-sm text-muted-foreground")}>
        {label}
      </span>
      <span
        className={cn(
          "shrink-0 font-extrabold tabular-nums tracking-tight",
          big ? "text-xl" : "text-lg",
          valueClass
        )}
      >
        {value}
      </span>
    </div>
  );
}

const NOTE_TONES = {
  orange: "bg-orange-100 text-orange-600 dark:bg-orange-500/15 dark:text-orange-400",
  amber: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400",
  emerald: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400",
  muted: "bg-muted text-muted-foreground",
} as const;

function RecapNote({
  icon: Icon,
  text,
  extra,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  text: string;
  extra?: string;
  tone: keyof typeof NOTE_TONES;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className={cn("mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg", NOTE_TONES[tone])}>
        <Icon className="size-3.5" />
      </span>
      <p className="min-w-0 flex-1 text-[13px] leading-snug">
        {text}
        {extra && <span className="block text-[11px] font-semibold text-orange-600 dark:text-orange-400">{extra}</span>}
      </p>
    </div>
  );
}
