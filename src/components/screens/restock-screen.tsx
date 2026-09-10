"use client";

// ── Restock screen — Kailangan ng Bili, Restock List, History ─────
// Entry points for the receipt scanner: header button + Home "scan" intent.

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Loader2,
  Minus,
  PackageOpen,
  PackagePlus,
  Plus,
  ScanLine,
  Sparkles,
  Trash2,
} from "lucide-react";
import { ScreenHeader } from "@/components/shared/screen-header";
import { SectionHeader } from "@/components/shared/section-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StockStatusBadge } from "@/components/shared/stock-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { apiDelete, apiPatch, apiPost } from "@/lib/api";
import { peso, formatDayLabel } from "@/lib/format";
import { DEFAULT_RESTOCK_QTY, stockStatusMeta } from "@/lib/constants";
import { useProducts, useRestocks, useShoppingList, useRefreshAll } from "@/hooks/use-store";
import { useAppNav } from "@/components/shell/nav-context";
import type { Product, RestockDTO, RestockSource, ShoppingItemDTO } from "@/types";
import { ReceiptScannerSheet } from "@/features/receipt/receipt-scanner-sheet";
import { ManualRestockSheet } from "@/features/receipt/manual-restock-sheet";

function sourceBadgeMeta(source: RestockSource): { label: string; cls: string } {
  if (source === "receipt")
    return {
      label: "Resibo",
      cls: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/20",
    };
  if (source === "shopping_list")
    return {
      label: "List",
      cls: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/20",
    };
  return { label: "Manual", cls: "bg-muted text-muted-foreground border-border" };
}

export default function RestockScreen() {
  const { intent, clearIntent } = useAppNav();
  const refreshAll = useRefreshAll();

  const productsQ = useProducts();
  const shoppingQ = useShoppingList();
  const restocksQ = useRestocks();

  const [scannerOpen, setScannerOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [qtyDraft, setQtyDraft] = useState<Record<string, string>>({});

  // Home screen "Scan Resibo" intent → auto-open the scanner once.
  useEffect(() => {
    if (intent === "scan") {
      setScannerOpen(true);
      clearIntent();
    }
  }, [intent, clearIntent]);

  const lowStock = useMemo(() => {
    const list = (productsQ.data ?? []).filter((p) => p.stockStatus === "paubos" || p.stockStatus === "ubos");
    return list.sort((a, b) => {
      if (a.stockStatus !== b.stockStatus) return a.stockStatus === "ubos" ? -1 : 1;
      const da = a.daysSinceRestock ?? -1;
      const dbb = b.daysSinceRestock ?? -1;
      if (da !== dbb) return dbb - da;
      return a.name.localeCompare(b.name);
    });
  }, [productsQ.data]);

  const shoppingItems = shoppingQ.data ?? [];
  const pending = useMemo(() => shoppingItems.filter((i) => !i.purchased), [shoppingItems]);
  const purchased = useMemo(() => shoppingItems.filter((i) => i.purchased), [shoppingItems]);
  const pendingEstTotal = useMemo(
    () => pending.reduce((sum, i) => sum + (Number(i.estTotal) || 0), 0),
    [pending]
  );
  const purchasedTotal = useMemo(
    () => purchased.reduce((sum, i) => sum + (Number(i.estTotal) || 0), 0),
    [purchased]
  );

  // ── Mutations ────────────────────────────────────────────────────
  const addLowStockToList = async (p: Product) => {
    setAddingId(p.id);
    try {
      await apiPost("/api/shopping-list", {
        productId: p.id,
        name: p.name,
        qty: p.lastRestockQty ?? DEFAULT_RESTOCK_QTY,
        estUnitCost: p.lastCost ?? 0,
        source: "low_stock",
      });
      toast.success(`Naidagdag sa restock list: ${p.name}`);
      refreshAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Hindi maidagdag, subukan ulit");
    } finally {
      setAddingId(null);
    }
  };

  const togglePurchased = async (item: ShoppingItemDTO) => {
    try {
      await apiPatch(`/api/shopping-list/${item.id}`, { purchased: !item.purchased });
      refreshAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Hindi ma-update, subukan ulit");
      refreshAll();
    }
  };

  const patchQty = async (item: ShoppingItemDTO, next: number) => {
    const qty = Math.max(1, Math.round(next) || 1);
    try {
      await apiPatch(`/api/shopping-list/${item.id}`, { qty });
      refreshAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Hindi ma-update ang qty, subukan ulit");
      refreshAll();
    }
  };

  const commitQtyDraft = (item: ShoppingItemDTO) => {
    const raw = qtyDraft[item.id];
    if (raw === undefined) return;
    const next = { ...qtyDraft };
    delete next[item.id];
    setQtyDraft(next);
    const parsed = parseInt(raw, 10);
    const current = item.qty ?? 1;
    if (Number.isFinite(parsed) && parsed !== current) void patchQty(item, parsed);
  };

  const removeShoppingItem = async (item: ShoppingItemDTO) => {
    try {
      await apiDelete(`/api/shopping-list/${item.id}`);
      toast.success(`Natanggal sa listahan: ${item.name}`);
      refreshAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Hindi matanggal, subukan ulit");
    }
  };

  const checkoutPurchased = async () => {
    setCheckingOut(true);
    try {
      const res = await apiPost<{ restock: RestockDTO }>("/api/shopping-list/checkout");
      toast.success(`Nai-record ang restock — ${peso(res?.restock?.total ?? purchasedTotal)}`);
      refreshAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Hindi ma-checkout, subukan ulit");
    } finally {
      setCheckingOut(false);
    }
  };

  // ── Render helpers ───────────────────────────────────────────────
  const sourceIcon = (item: ShoppingItemDTO) => {
    if (item.source === "ai")
      return <Sparkles className="size-3.5 shrink-0 text-primary" aria-label="Mula kay Suki AI" />;
    if (item.source === "low_stock")
      return <AlertTriangle className="size-3.5 shrink-0 text-orange-500" aria-label="Mula sa low stock" />;
    return null;
  };

  return (
    <div>
      <ScreenHeader
        title="Restock"
        subtitle="Bantayan ang stock at bilihin"
        right={
          <>
            <Button
              onClick={() => setScannerOpen(true)}
              className="h-9 rounded-xl bg-primary px-3 text-sm font-bold touch-manipulation active:scale-95"
            >
              <ScanLine className="size-4" />
              Scan Resibo
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="Manual na restock"
              onClick={() => setManualOpen(true)}
              className="size-9 shrink-0 rounded-xl touch-manipulation active:scale-95"
            >
              <PackagePlus className="size-4" />
            </Button>
          </>
        }
      />

      <div className="space-y-6 p-4">
        {/* ── Kailangan ng Bili ── */}
        <section className="space-y-3">
          <SectionHeader title="Kailangan ng Bili" subtitle="Paubos o ubos na paninda" />
          {productsQ.isLoading ? (
            <div className="space-y-2 rounded-2xl border border-border bg-card p-3">
              <Skeleton className="h-9 w-full rounded-lg" />
              <Skeleton className="h-9 w-full rounded-lg" />
              <Skeleton className="h-9 w-3/4 rounded-lg" />
            </div>
          ) : lowStock.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card px-4 py-5 text-center text-sm text-muted-foreground">
              Okay ang stock, walang paubos!
            </div>
          ) : (
            <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
              {lowStock.map((p) => {
                const meta = stockStatusMeta(p.stockStatus);
                return (
                  <div key={p.id} className="flex min-h-[56px] items-center gap-2.5 py-2 pl-3.5 pr-2">
                    <span className={`size-2 shrink-0 rounded-full ${meta.dot}`} aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold leading-tight">{p.name}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <StockStatusBadge
                          status={p.stockStatus}
                          showDot={false}
                          className="px-1.5 py-0 text-[10px]"
                        />
                        {p.daysSinceRestock != null && (
                          <span className="text-[11px] text-muted-foreground">{p.daysSinceRestock} araw na</span>
                        )}
                      </div>
                    </div>
                    <Button
                      onClick={() => addLowStockToList(p)}
                      disabled={addingId === p.id}
                      className="h-8 shrink-0 rounded-lg bg-primary/10 px-2.5 text-xs font-bold text-primary shadow-none hover:bg-primary/20 touch-manipulation active:scale-95"
                    >
                      {addingId === p.id ? <Loader2 className="size-3 animate-spin" /> : "Add +"}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Restock List ── */}
        <section className="space-y-3">
          <SectionHeader
            title="Restock List"
            subtitle="Itakda ang qty, markahan kapag nabili"
            action={
              <span className="text-xs font-semibold text-muted-foreground tabular-nums">
                Estimated: {peso(pendingEstTotal)}
              </span>
            }
          />
          {shoppingQ.isLoading ? (
            <div className="space-y-2 rounded-2xl border border-border bg-card p-3">
              <Skeleton className="h-11 w-full rounded-lg" />
              <Skeleton className="h-11 w-full rounded-lg" />
            </div>
          ) : pending.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card px-4 py-5 text-center text-sm text-muted-foreground">
              Wala pang item sa listahan — dagdagan mula sa Kailangan ng Bili.
            </div>
          ) : (
            <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
              {pending.map((item) => {
                const shownQty = qtyDraft[item.id] ?? String(item.qty ?? 1);
                return (
                  <div key={item.id} className="flex min-h-[56px] items-center gap-2 py-2 pl-2.5 pr-2">
                    <Checkbox
                      checked={item.purchased}
                      onCheckedChange={() => togglePurchased(item)}
                      aria-label={`Markahang nabili: ${item.name}`}
                      className="size-5 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 truncate text-sm font-semibold leading-tight">
                        {sourceIcon(item)}
                        <span className="truncate">{item.name}</span>
                      </p>
                      {!!item.estUnitCost && item.estUnitCost > 0 && (
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          est. {peso(item.estUnitCost)} bawat isa
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <button
                        type="button"
                        aria-label="Bawasan ang qty"
                        onClick={() => patchQty(item, (item.qty ?? 1) - 1)}
                        className="flex size-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors touch-manipulation active:scale-90 hover:bg-accent"
                      >
                        <Minus className="size-3.5" />
                      </button>
                      <Input
                        aria-label={`Qty ng ${item.name}`}
                        inputMode="numeric"
                        value={shownQty}
                        onChange={(e) =>
                          setQtyDraft((d) => ({ ...d, [item.id]: e.target.value.replace(/[^0-9]/g, "") }))
                        }
                        onBlur={() => commitQtyDraft(item)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                        }}
                        className="h-8 w-12 rounded-lg px-0 text-center text-sm font-semibold"
                      />
                      <button
                        type="button"
                        aria-label="Dagdagan ang qty"
                        onClick={() => patchQty(item, (item.qty ?? 1) + 1)}
                        className="flex size-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors touch-manipulation active:scale-90 hover:bg-accent"
                      >
                        <Plus className="size-3.5" />
                      </button>
                    </div>
                    <span className="shrink-0 text-right text-sm font-bold tabular-nums">
                      {peso(item.estTotal)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Tanggalin si ${item.name}`}
                      onClick={() => removeShoppingItem(item)}
                      className="size-9 shrink-0 rounded-lg text-rose-500 hover:bg-rose-500/10 hover:text-rose-600 touch-manipulation"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer: purchased summary + checkout */}
          <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">
              Naka-mark na nabili:{" "}
              <span className="font-semibold text-foreground">
                {purchased.length} items{purchased.length > 0 ? ` (${peso(purchasedTotal)})` : ""}
              </span>
            </p>
            <AlertDialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
              <AlertDialogTrigger asChild>
                <Button
                  disabled={purchased.length === 0 || checkingOut}
                  className="btn-hero h-12 w-full rounded-2xl text-base font-bold touch-manipulation active:scale-[0.99]"
                >
                  {checkingOut ? "Tine-checkout…" : "I-checkout ang mga Nabili"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-2xl sm:max-w-sm">
                <AlertDialogHeader>
                  <AlertDialogTitle>I-checkout ang mga Nabili?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Gagawing restock record ang {purchased.length} na item na nabili? Ia-update din ang stock
                    status nila.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="h-11 rounded-xl">Kanselahin</AlertDialogCancel>
                  <AlertDialogAction
                    className="h-11 rounded-xl"
                    onClick={() => {
                      void checkoutPurchased();
                    }}
                  >
                    Oo, i-checkout
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </section>

        {/* ── Mga Nakaraang Restock ── */}
        <section className="space-y-3">
          <SectionHeader title="Mga Nakaraang Restock" />
          {restocksQ.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full rounded-2xl" />
              <Skeleton className="h-24 w-full rounded-2xl" />
            </div>
          ) : (restocksQ.data ?? []).length === 0 ? (
            <div className="rounded-2xl border border-border bg-card">
              <EmptyState
                icon={PackageOpen}
                title="Wala pang restock"
                description="Mula sa resibo, listahan, o manual add."
              />
            </div>
          ) : (
            <div className="space-y-3">
              {(restocksQ.data ?? []).map((r) => {
                const badge = sourceBadgeMeta(r.source);
                return (
                  <div key={r.id} className="rounded-2xl border border-border bg-card p-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{formatDayLabel(r.date)}</span>
                      <Badge variant="outline" className={`border ${badge.cls}`}>
                        {badge.label}
                      </Badge>
                      <span className="ml-auto text-sm font-bold tabular-nums">{peso(r.total)}</span>
                    </div>
                    {(r.supplier || r.note) && (
                      <p className="mt-1 truncate text-xs text-muted-foreground">{r.supplier || r.note}</p>
                    )}
                    {r.items.length > 0 && (
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {r.items.map((it) => `${it.qty}x ${it.name}`).join(", ")}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <ReceiptScannerSheet open={scannerOpen} onOpenChange={setScannerOpen} />
      <ManualRestockSheet open={manualOpen} onOpenChange={setManualOpen} />
    </div>
  );
}
