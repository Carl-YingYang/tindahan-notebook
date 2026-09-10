"use client";

// ── Add / Edit product drawer (create + edit + delete) ───────────
// Create → POST /api/products (409 duplicate → toast the server message).
// Edit   → PATCH /api/products/[id], with a Burahin (delete) + confirm dialog.
// Both   → refreshAll + close + toast success.

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { History, ChevronDown } from "lucide-react";

import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CategoryChips } from "@/components/shared/category-chips";
import { StockStatusPicker } from "@/components/shared/stock-status";
import { AmountInput, parseAmount } from "@/components/shared/amount-input";
import { PRODUCT_UNITS } from "@/lib/constants";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import { useRefreshAll } from "@/hooks/use-store";
import { formatShortDate, peso } from "@/lib/format";
import type { Product, RestockDTO, StockStatus } from "@/types";

const SOURCE_LABEL: Record<string, string> = {
  manual: "Manual",
  receipt: "Resibo",
  shopping_list: "Restock list",
};

export function ProductDrawer({
  open,
  onOpenChange,
  product,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = create mode */
  product: Product | null;
}) {
  const refreshAll = useRefreshAll();
  const isEdit = !!product;

  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [status, setStatus] = useState<StockStatus>("sakto");
  const [cost, setCost] = useState("");
  const [intervalDays, setIntervalDays] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Pre-fill on open (edit) / reset (create)
  useEffect(() => {
    if (!open) return;
    setName(product?.name ?? "");
    setUnit(product?.unit ?? "");
    setStatus(product?.stockStatus ?? "sakto");
    setCost(product?.lastCost != null ? String(product.lastCost) : "");
    setIntervalDays(
      product?.typicalIntervalDays != null ? String(product.typicalIntervalDays) : ""
    );
    setNote(product?.note ?? "");
    setConfirmOpen(false);
    setHistoryOpen(false);
  }, [open, product]);

  async function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Ilagay ang pangalan ng paninda");
      return;
    }
    let interval: number | null = null;
    if (intervalDays.trim() !== "") {
      const n = Number(intervalDays);
      if (!Number.isFinite(n) || n < 0) {
        toast.error("Hindi valid ang bilang ng araw");
        return;
      }
      interval = Math.round(n);
    }
    const costValue = cost.trim() === "" ? null : parseAmount(cost);

    const body = {
      name: trimmed,
      unit, // "" → server stores null (Wala)
      stockStatus: status,
      lastCost: costValue,
      typicalIntervalDays: interval,
      note: note.trim(),
    };

    setSaving(true);
    try {
      if (isEdit && product) {
        await apiPatch(`/api/products/${product.id}`, body);
        toast.success(`Na-update si ${trimmed}!`);
      } else {
        await apiPost("/api/products", body);
        toast.success(`Naidagdag si ${trimmed}!`);
      }
      refreshAll();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "May problema, subukan ulit");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!product) return;
    setDeleting(true);
    try {
      await apiDelete(`/api/products/${product.id}`);
      toast.success(`Binura si ${product.name}!`);
      refreshAll();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "May problema, subukan ulit");
    } finally {
      setDeleting(false);
      setConfirmOpen(false);
    }
  }

  // Restock history (edit mode only, lazy-loaded when expanded)
  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ["product-restocks", product?.id],
    queryFn: () => apiGet<RestockDTO[]>(`/api/restocks?productId=${product?.id}&limit=20`),
    enabled: open && isEdit && historyOpen && !!product?.id,
    staleTime: 15_000,
  });

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-w-md">
        <DrawerHeader className="text-left">
          <DrawerTitle>{isEdit ? "I-edit ang paninda" : "Bagong paninda"}</DrawerTitle>
          <DrawerDescription>
            {isEdit
              ? "I-update ang detalye o burahin na lang kako."
              : "Idagdag sa listahan ng mga paninda mo."}
          </DrawerDescription>
        </DrawerHeader>

        <div className="nice-scroll flex-1 space-y-4 overflow-y-auto px-4 pb-2">
          {/* Name */}
          <div className="space-y-1.5">
            <label htmlFor="product-name" className="text-[13px] font-semibold">
              Pangalan
            </label>
            <Input
              id="product-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="hal. Coke Mismo"
              autoComplete="off"
              className="h-11 rounded-xl"
            />
          </div>

          {/* Unit */}
          <div className="space-y-1.5">
            <span className="text-[13px] font-semibold">Unit</span>
            <CategoryChips
              options={PRODUCT_UNITS}
              value={unit}
              onChange={setUnit}
              allowEmpty
              emptyLabel="Wala"
            />
          </div>

          {/* Stock status */}
          <div className="space-y-1.5">
            <span className="text-[13px] font-semibold">Stock status ngayon</span>
            <StockStatusPicker value={status} onChange={setStatus} />
          </div>

          {/* Last cost */}
          <div className="space-y-1.5">
            <span className="text-[13px] font-semibold">Huling presyo (optional)</span>
            <AmountInput value={cost} onChange={setCost} ariaLabel="Huling presyo" />
          </div>

          {/* Typical restock interval */}
          <div className="space-y-1.5">
            <label htmlFor="product-interval" className="text-[13px] font-semibold">
              Karaniwang restock interval (araw, optional)
            </label>
            <Input
              id="product-interval"
              inputMode="numeric"
              value={intervalDays}
              onChange={(e) => setIntervalDays(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="hal. 7"
              className="h-11 rounded-xl"
            />
          </div>

          {/* Note */}
          <div className="space-y-1.5">
            <label htmlFor="product-note" className="text-[13px] font-semibold">
              Note (optional)
            </label>
            <Input
              id="product-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="hal. Supplier: Ate Nena"
              className="h-11 rounded-xl"
            />
          </div>

          {/* Restock history (edit mode only — lazy-loaded timeline) */}
          {isEdit && (
            <div className="overflow-hidden rounded-xl border border-border">
              <button
                type="button"
                onClick={() => setHistoryOpen((v) => !v)}
                aria-expanded={historyOpen}
                className="flex h-11 w-full items-center gap-2 bg-muted/40 px-3 text-[13px] font-semibold text-muted-foreground transition-colors hover:bg-muted/70 touch-manipulation active:scale-[0.99]"
              >
                <History className="size-4" />
                Restock history
                <ChevronDown
                  aria-hidden="true"
                  className={`ml-auto size-4 transition-transform ${historyOpen ? "rotate-180" : ""}`}
                />
              </button>
              {historyOpen && (
                <div className="max-h-56 overflow-y-auto nice-scroll px-4 py-3">
                  {historyLoading ? (
                    <p className="py-2 text-center text-xs text-muted-foreground">Nilo-load…</p>
                  ) : !history || history.length === 0 ? (
                    <p className="py-2 text-center text-xs text-muted-foreground">
                      Wala pang restock record. Galing sa manual entry, resibo, o restock list.
                    </p>
                  ) : (
                    <ol className="relative space-y-3 border-l border-border pl-4">
                      {history.map((r) => {
                        const it = r.items[0];
                        return (
                          <li key={`${r.id}-${it?.id ?? "i"}`} className="relative">
                            <span
                              aria-hidden="true"
                              className="absolute -left-[21px] top-1.5 size-2.5 rounded-full border-2 border-background bg-primary"
                            />
                            <p className="text-xs font-bold">
                              {it ? `${it.qty} ${product.unit ?? "pcs"}` : "—"}
                              {it && it.unitPrice > 0 && (
                                <span className="ml-1 font-normal text-muted-foreground">
                                  × {peso(it.unitPrice)} = {peso(it.total)}
                                </span>
                              )}
                            </p>
                            <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                              {formatShortDate(r.date)}
                              <span className="rounded-full bg-muted px-1.5 py-px font-semibold text-[10px]">
                                {SOURCE_LABEL[r.source] ?? r.source}
                              </span>
                              {r.supplier && <span className="truncate">· {r.supplier}</span>}
                            </p>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <DrawerFooter className="pt-2">
          <div className="flex gap-2">
            {isEdit && (
              <Button
                variant="destructive"
                disabled={saving || deleting}
                onClick={() => setConfirmOpen(true)}
                className="h-11 flex-1 rounded-xl font-semibold touch-manipulation active:scale-[0.98]"
              >
                Burahin
              </Button>
            )}
            <Button
              disabled={saving || deleting}
              onClick={handleSubmit}
              className="h-11 flex-1 rounded-xl bg-primary font-bold touch-manipulation active:scale-[0.98]"
            >
              {saving ? "Sinasave…" : isEdit ? "I-save ang pagbabago" : "I-add siya"}
            </Button>
          </div>
        </DrawerFooter>

        {/* Delete confirmation */}
        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent className="max-w-sm rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle>Burahin si {product?.name ?? "ito"}?</AlertDialogTitle>
              <AlertDialogDescription>
                Hindi na ito maibabalik. Mawawala siya sa listahan ng paninda mo.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-xl">Kanselahin</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="rounded-xl bg-destructive text-white hover:bg-destructive/90"
              >
                Burahin
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DrawerContent>
    </Drawer>
  );
}
