"use client";

// ── Restock review form — shared by receipt OCR flow AND manual add ──
// Contract: OCR results are NEVER auto-saved; the user always reviews here
// and taps save to POST /api/restocks.

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { apiPost } from "@/lib/api";
import { peso } from "@/lib/format";
import { parseAmount } from "@/components/shared/amount-input";
import { useRefreshAll } from "@/hooks/use-store";
import type { RestockDTO, RestockItemDTO } from "@/types";

interface Row {
  key: string;
  productId: string | null;
  name: string;
  qty: string;
  unitPrice: string;
}

let rowSeq = 0;
function nextKey() {
  rowSeq += 1;
  return `row-${Date.now()}-${rowSeq}`;
}

function rowFromItem(it: RestockItemDTO): Row {
  const qty = typeof it.qty === "number" && it.qty > 0 ? it.qty : 1;
  const unitPrice = typeof it.unitPrice === "number" && it.unitPrice >= 0 ? it.unitPrice : 0;
  return {
    key: nextKey(),
    productId: it.productId ?? null,
    name: it.name ?? "",
    qty: String(qty),
    unitPrice: unitPrice ? String(unitPrice) : "",
  };
}

function emptyRow(): Row {
  return { key: nextKey(), productId: null, name: "", qty: "", unitPrice: "" };
}

function rowTotal(r: Row): number {
  return parseAmount(r.qty || "1") * parseAmount(r.unitPrice || "0");
}

export function ReceiptReviewForm({
  initialItems,
  initialSupplier,
  onSaved,
  source,
}: {
  initialItems: RestockItemDTO[];
  initialSupplier?: string;
  /** Called after a successful save — parent closes the sheet + refreshAll(). */
  onSaved: () => void;
  source: "receipt" | "manual";
}) {
  const refreshAll = useRefreshAll();
  const [rows, setRows] = useState<Row[]>(() =>
    initialItems.length > 0 ? initialItems.map(rowFromItem) : [emptyRow()]
  );
  const [supplier, setSupplier] = useState(initialSupplier ?? "");
  const [note, setNote] = useState("");
  const [updateStock, setUpdateStock] = useState(true);
  const [saving, setSaving] = useState(false);

  // Items with an empty name are skipped on save (OCR noise guard).
  const validRows = rows.filter((r) => r.name.trim().length > 0);
  const estimatedTotal = validRows.reduce((sum, r) => sum + rowTotal(r), 0);

  const updateRow = (key: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const removeRow = (key: string) => setRows((rs) => rs.filter((r) => r.key !== key));

  const save = async () => {
    if (validRows.length === 0 || saving) return;
    setSaving(true);
    try {
      const saved = await apiPost<RestockDTO>("/api/restocks", {
        source,
        supplier: supplier.trim() || null,
        note: note.trim() || null,
        items: validRows.map((r) => ({
          productId: r.productId || null,
          name: r.name.trim(),
          qty: parseAmount(r.qty) || 1,
          unitPrice: parseAmount(r.unitPrice) || 0,
        })),
        updateStock,
      });
      toast.success(`Nai-save ang restock — ${peso(saved?.total ?? estimatedTotal)}`);
      refreshAll();
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Hindi na-save, subukan ulit");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="max-h-[48vh] space-y-4 overflow-y-auto nice-scroll px-4 pb-2">
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
          {source === "receipt"
            ? "Tingnan at ayusin ang mga item bago i-save. Puwedeng magkamali ang pagbasa."
            : "Tingnan at ayusin ang mga item bago i-save."}
        </p>

        <div className="grid grid-cols-2 gap-2">
          <Input
            aria-label="Supplier (optional)"
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
            placeholder="Supplier (hal. Aling Rosa)"
            className="col-span-2 h-11 rounded-xl"
            maxLength={80}
          />
          <Input
            aria-label="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (hal. pambaon week)"
            className="col-span-2 h-11 rounded-xl"
            maxLength={120}
          />
        </div>

        <div className="space-y-3">
          {rows.length === 0 && (
            <div className="rounded-xl border border-dashed border-border bg-muted/40 p-4 text-center text-xs text-muted-foreground">
              Walang items — tap ang &quot;Add item&quot; para magdagdag.
            </div>
          )}

          {rows.map((r) => {
            const total = rowTotal(r);
            return (
              <div key={r.key} className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-center gap-2">
                  <Input
                    aria-label="Item name"
                    value={r.name}
                    onChange={(e) => updateRow(r.key, { name: e.target.value })}
                    placeholder="Pangalan ng item"
                    className="h-10 flex-1 rounded-lg font-semibold"
                    maxLength={80}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Tanggalin ang ${r.name || "item"}`}
                    onClick={() => removeRow(r.key)}
                    className="size-10 shrink-0 rounded-lg text-rose-500 hover:bg-rose-500/10 hover:text-rose-600 touch-manipulation"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <div>
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Qty</p>
                    <Input
                      aria-label="Qty"
                      inputMode="numeric"
                      value={r.qty}
                      onChange={(e) => updateRow(r.key, { qty: e.target.value.replace(/[^0-9]/g, "") })}
                      placeholder="1"
                      className="h-10 rounded-lg text-center"
                    />
                  </div>
                  <div>
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Presyo</p>
                    <div className="relative">
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground"
                      >
                        ₱
                      </span>
                      <Input
                        aria-label="Unit price"
                        inputMode="decimal"
                        value={r.unitPrice}
                        onChange={(e) =>
                          updateRow(r.key, { unitPrice: e.target.value.replace(/[^0-9.,]/g, "") })
                        }
                        placeholder="0"
                        className="h-10 rounded-lg pl-6"
                      />
                    </div>
                  </div>
                  <div>
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Total</p>
                    <div
                      aria-live="polite"
                      className="flex h-10 items-center justify-end rounded-lg bg-muted px-2 text-sm font-semibold tabular-nums"
                    >
                      {peso(total)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          <button
            type="button"
            onClick={() => setRows((rs) => [...rs, emptyRow()])}
            className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-border text-sm font-semibold text-muted-foreground transition-colors touch-manipulation active:scale-[0.99] hover:border-primary/50 hover:text-primary"
          >
            <Plus className="size-4" /> Add item
          </button>
        </div>

        <label className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl px-1 py-2 text-sm">
          <Checkbox
            checked={updateStock}
            onCheckedChange={(v) => setUpdateStock(v === true)}
            className="size-5"
            aria-label="I-update ang stock status ng mga item"
          />
          <span>I-update ang stock status ng mga item (Marami pa)</span>
        </label>
      </div>

      <div className="border-t border-border bg-background p-4 pb-6">
        <div className="mb-3 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Estimated Total:</span>
          <span className="font-bold tabular-nums">{peso(estimatedTotal)}</span>
        </div>
        <Button
          onClick={save}
          disabled={validRows.length === 0 || saving}
          className="btn-hero h-12 w-full rounded-2xl text-base font-bold touch-manipulation active:scale-[0.99]"
        >
          {saving ? "Sine-save…" : `I-save ang Restock (${validRows.length} items)`}
        </Button>
      </div>
    </div>
  );
}
