"use client";

// ── Product card with one-tap stock status control ───────────────
// One tap on a segment = optimistic PATCH /api/products/[id] then refreshAll.
// "Sa Restock List" posts straight to the shopping list. Edit opens the drawer
// (delete lives inside the drawer, not here).

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { StockStatusBadge } from "@/components/shared/stock-status";
import { DEFAULT_RESTOCK_QTY, STOCK_STATUSES, stockStatusMeta } from "@/lib/constants";
import { formatShortDate, peso } from "@/lib/format";
import { apiPatch, apiPost } from "@/lib/api";
import { qk, useRefreshAll } from "@/hooks/use-store";
import type { Product, StockStatus } from "@/types";
import { cn } from "@/lib/utils";

const SHORT_LABELS: Record<StockStatus, string> = {
  marami: "Marami",
  sakto: "Sakto",
  paubos: "Paubos",
  ubos: "Ubos",
};

export function ProductCard({
  product,
  onEdit,
}: {
  product: Product;
  onEdit: (p: Product) => void;
}) {
  const qc = useQueryClient();
  const refreshAll = useRefreshAll();
  const [busyStatus, setBusyStatus] = useState(false);
  const [busyRestock, setBusyRestock] = useState(false);

  /** Optimistically paint the new status, then confirm with the server. */
  async function handleStatus(next: StockStatus) {
    if (busyStatus || next === product.stockStatus) return;
    setBusyStatus(true);
    qc.setQueryData<Product[]>(qk.products, (old) =>
      old ? old.map((p) => (p.id === product.id ? { ...p, stockStatus: next } : p)) : old
    );
    try {
      await apiPatch(`/api/products/${product.id}`, { stockStatus: next });
      toast.success(`${product.name}: ${stockStatusMeta(next).label}`);
      refreshAll();
    } catch (e) {
      // Revert the optimistic paint back to server truth
      qc.setQueryData<Product[]>(qk.products, (old) =>
        old
          ? old.map((p) =>
              p.id === product.id ? { ...p, stockStatus: product.stockStatus } : p
            )
          : old
      );
      toast.error(e instanceof Error ? e.message : "May problema, subukan ulit");
      refreshAll();
    } finally {
      setBusyStatus(false);
    }
  }

  async function handleAddToRestock() {
    if (busyRestock) return;
    setBusyRestock(true);
    try {
      await apiPost("/api/shopping-list", {
        productId: product.id,
        name: product.name,
        qty: product.lastRestockQty ?? DEFAULT_RESTOCK_QTY,
        estUnitCost: product.lastCost ?? 0,
        source: "low_stock",
      });
      toast.success("Naidagdag sa restock list!");
      refreshAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "May problema, subukan ulit");
    } finally {
      setBusyRestock(false);
    }
  }

  const restockLine = product.lastRestockAt
    ? `Huling restock: ${formatShortDate(product.lastRestockAt)}${
        product.lastRestockQty != null
          ? ` · ${product.lastRestockQty} ${product.unit ?? "pcs"}`
          : ""
      }`
    : "Hindi pa nare-restock";

  return (
    <article className="rounded-2xl border border-border bg-card p-4">
      {/* Top row: name + unit badge … current status badge */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 truncate font-bold leading-6">
          {product.name}
          {product.unit && (
            <span className="ml-1 text-[11px] font-normal text-muted-foreground">
              {" "}· {product.unit}
            </span>
          )}
        </h3>
        <StockStatusBadge status={product.stockStatus} className="shrink-0" />
      </div>

      {/* Sub-row: last restock info + price */}
      <p className="mt-1 text-xs text-muted-foreground">
        {restockLine}
        {product.lastCost != null && ` · Presyo: ${peso(product.lastCost)}`}
      </p>

      {/* One-tap status control */}
      <div
        role="radiogroup"
        aria-label={`Stock status ng ${product.name}`}
        className="mt-3 grid grid-cols-4 gap-1"
      >
        {STOCK_STATUSES.map((s) => {
          const active = product.stockStatus === s.value;
          return (
            <button
              key={s.value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={busyStatus}
              onClick={() => handleStatus(s.value)}
              className={cn(
                "flex h-9 items-center justify-center gap-1.5 rounded-lg text-[12px] font-semibold transition-all touch-manipulation active:scale-95 disabled:opacity-60",
                active ? s.badge : "bg-muted text-muted-foreground"
              )}
            >
              <span className={cn("size-1.5 rounded-full", s.dot)} aria-hidden="true" />
              {SHORT_LABELS[s.value]}
            </button>
          );
        })}
      </div>

      {/* Quick actions */}
      <div className="mt-3 flex gap-2">
        <Button
          variant="outline"
          disabled={busyRestock}
          onClick={handleAddToRestock}
          className="h-9 flex-1 rounded-lg px-3 text-[13px] font-semibold touch-manipulation active:scale-[0.98]"
        >
          <Plus className="size-4" />
          Sa Restock List
        </Button>
        <Button
          variant="outline"
          onClick={() => onEdit(product)}
          className="h-9 rounded-lg px-3 text-[13px] font-semibold touch-manipulation active:scale-[0.98]"
        >
          <Pencil className="size-4" />
          Edit
        </Button>
      </div>
    </article>
  );
}
