"use client";

// ── "Target sa Benta" — weekly sales goal card on Home ───────────
// Deterministic local logic: progress = summary.week.benta vs the stored
// weekly target (AppSetting). Tap to set / edit / remove the target.

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Pencil, Target, Trash2, TrendingUp } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { AmountInput, parseAmount } from "@/components/shared/amount-input";
import { useSetWeeklyTarget, useSettings, useSummary } from "@/hooks/use-store";
import { peso } from "@/lib/format";
import { cn } from "@/lib/utils";

const QUICK_TARGETS = [1000, 2500, 5000, 10000];

function encouragement(pct: number): { label: string; className: string } {
  if (pct >= 100) return { label: "Naabot na ang target — galing!", className: "text-emerald-600 dark:text-emerald-400" };
  if (pct >= 75) return { label: "Malapit na! Tuloy-tuloy lang.", className: "text-emerald-600 dark:text-emerald-400" };
  if (pct >= 40) return { label: "Ayan, may progress na — push pa!", className: "text-amber-600 dark:text-amber-400" };
  return { label: "Kaya 'to — isang sale at a time.", className: "text-muted-foreground" };
}

export function GoalCard() {
  const { data: settings, isLoading: settingsLoading } = useSettings();
  const { data: summary } = useSummary();
  const saveTarget = useSetWeeklyTarget();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

  const target = settings?.weeklyBentaTarget ?? null;
  const weekBenta = summary?.week.benta ?? 0;

  useEffect(() => {
    if (dialogOpen) {
      setAmount(target != null ? String(target) : "");
    }
  }, [dialogOpen, target]);

  const pct = target && target > 0 ? Math.min(100, Math.round((weekBenta / target) * 100)) : 0;
  const cheer = encouragement(pct);
  const reached = target != null && weekBenta >= target;

  async function handleSave() {
    const value = parseAmount(amount);
    if (value <= 0) {
      toast.error("Ilagay ang tamang halaga");
      return;
    }
    setSaving(true);
    try {
      await saveTarget(value);
      toast.success(`Naitakda ang weekly target sa ${peso(value)}`);
      setDialogOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "May problema, subukan ulit");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    setRemoving(true);
    try {
      await saveTarget(null);
      toast.success("Naitanggal ang target");
      setDialogOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "May problema, subukan ulit");
    } finally {
      setRemoving(false);
    }
  }

  // ── No target yet: quiet discovery CTA ─────────────────────────
  if (settingsLoading) {
    return <Skeleton className="h-[76px] w-full rounded-2xl" />;
  }

  if (target == null) {
    return (
      <>
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="flex w-full touch-manipulation items-center gap-3 rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-3.5 text-left transition-all active:scale-[0.99]"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Target className="size-[18px]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold">Itakda ang Target sa Benta</span>
            <span className="block text-xs text-muted-foreground">
              Lingguang goal para may gabay sa tindahan
            </span>
          </span>
          <span className="shrink-0 rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs font-bold text-primary">
            Itakda
          </span>
        </button>
        <TargetDialog />
      </>
    );
  }

  // ── Target set: progress card ──────────────────────────────────
  return (
    <>
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border bg-card p-3.5",
          reached ? "border-emerald-300 dark:border-emerald-500/40" : "border-border"
        )}
      >
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-xl",
              reached
                ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400"
                : "bg-primary/15 text-primary"
            )}
          >
            {reached ? <TrendingUp className="size-[18px]" /> : <Target className="size-[18px]" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold leading-tight">Target sa Benta (linggo)</p>
            <p className={cn("mt-0.5 text-xs font-medium", cheer.className)}>{cheer.label}</p>
          </div>
          <button
            type="button"
            aria-label="I-edit ang target"
            onClick={() => setDialogOpen(true)}
            className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground touch-manipulation active:scale-95"
          >
            <Pencil className="size-4" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="mt-3">
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <motion.div
              className={cn(
                "h-full rounded-full",
                reached
                  ? "bg-gradient-to-r from-emerald-400 to-emerald-500"
                  : "bg-gradient-to-r from-amber-400 to-orange-500"
              )}
              initial={false}
              animate={{ width: `${Math.max(pct, weekBenta > 0 ? 2 : 0)}%` }}
              transition={{ type: "spring", stiffness: 120, damping: 20 }}
            />
          </div>
          <div className="mt-1.5 flex items-baseline justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              <span className="font-bold tabular-nums text-foreground">{peso(weekBenta)}</span>
              {" sa "}
              <span className="font-semibold tabular-nums">{peso(target)}</span>
            </p>
            <p
              className={cn(
                "shrink-0 text-xs font-extrabold tabular-nums",
                reached ? "text-emerald-600 dark:text-emerald-400" : "text-primary"
              )}
            >
              {pct}%
            </p>
          </div>
        </div>
      </div>
      <TargetDialog />
    </>
  );

  // ── Set / edit / remove dialog ─────────────────────────────────
  function TargetDialog() {
    return (
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-xs rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="size-4 text-primary" />
              Target sa Benta
            </DialogTitle>
            <DialogDescription>
              Magkano ang target mong benta sa loob ng isang linggo? (7 araw)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <AmountInput value={amount} onChange={setAmount} />
            <div className="flex flex-wrap gap-1.5">
              {QUICK_TARGETS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setAmount(String(q))}
                  className={cn(
                    "min-h-9 rounded-lg border px-2.5 text-xs font-semibold transition touch-manipulation active:scale-95",
                    parseAmount(amount) === q
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-muted-foreground hover:text-foreground"
                  )}
                >
                  {peso(q)}
                </button>
              ))}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            {target != null && (
              <Button
                type="button"
                variant="ghost"
                disabled={removing || saving}
                onClick={() => void handleRemove()}
                className="mr-auto h-11 rounded-xl text-destructive hover:text-destructive"
              >
                {removing ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                Alisin
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => setDialogOpen(false)}
              className="h-11 rounded-xl"
            >
              Kanselahin
            </Button>
            <Button
              type="button"
              disabled={saving}
              onClick={() => void handleSave()}
              className="btn-hero h-11 rounded-xl font-bold"
            >
              {saving ? "Sine-save…" : "I-save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
}
