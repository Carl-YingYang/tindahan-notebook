"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AmountInput, parseAmount } from "./amount-input";
import { CategoryChips } from "./category-chips";
import { EXPENSE_CATEGORIES, SALES_CATEGORIES } from "@/lib/constants";
import { manilaDateStr } from "@/lib/format";
import { apiPost } from "@/lib/api";
import { useRefreshAll } from "@/hooks/use-store";
import { ShoppingBasket, Wallet } from "lucide-react";

/**
 * Shared quick-entry sheet for Benta (sales) and Gastos (expenses).
 * Minimal fields: amount → category → optional note/date.
 */
export function QuickEntrySheet({
  kind,
  open,
  onOpenChange,
}: {
  kind: "benta" | "gastos";
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const refreshAll = useRefreshAll();
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(() => manilaDateStr());
  const [saving, setSaving] = useState(false);

  const isBenta = kind === "benta";
  const categories = isBenta ? SALES_CATEGORIES : EXPENSE_CATEGORIES;

  useEffect(() => {
    if (open) {
      setAmount("");
      setNote("");
      setDate(manilaDateStr());
      setCategory(isBenta ? "" : "Restock");
    }
  }, [open, isBenta]);

  const submit = async () => {
    const amt = parseAmount(amount);
    if (amt <= 0) {
      toast.error("Ilagay ang tamang halaga");
      return;
    }
    setSaving(true);
    try {
      const iso = date === manilaDateStr() ? new Date().toISOString() : `${date}T12:00:00+08:00`;
      if (isBenta) {
        await apiPost("/api/sales", { amount: amt, category: category || null, note: note.trim() || null, date: iso });
        toast.success("Naitala ang benta!");
      } else {
        await apiPost("/api/expenses", { amount: amt, category: category || "Iba pa", note: note.trim() || null, date: iso });
        toast.success("Naitala ang gastos!");
      }
      refreshAll();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "May problema, subukan ulit");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-w-md">
        <DrawerHeader className="text-left pb-2">
          <DrawerTitle className="flex items-center gap-2 text-lg">
            <span
              className={
                isBenta
                  ? "flex size-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600"
                  : "flex size-8 items-center justify-center rounded-lg bg-rose-100 text-rose-600"
              }
            >
              {isBenta ? <ShoppingBasket className="size-4" /> : <Wallet className="size-4" />}
            </span>
            {isBenta ? "Add Benta" : "Add Gastos"}
          </DrawerTitle>
          <DrawerDescription className="text-xs">
            {isBenta ? "Kita mula sa tindahan ngayong araw" : "Gumastos para sa tindahan"}
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-4 space-y-4 overflow-y-auto nice-scroll max-h-[52vh]">
          <AmountInput value={amount} onChange={setAmount} autoFocus />

          <div>
            <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Category {isBenta && <span className="normal-case font-normal">(optional)</span>}
            </p>
            <CategoryChips options={categories} value={category} onChange={setCategory} allowEmpty={isBenta} />
          </div>

          <div>
            <p className="mb-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Note (optional)</p>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={isBenta ? "hal. benta ng softdrinks" : "hal. pambili ng load"}
              className="h-11 rounded-xl"
              maxLength={120}
            />
          </div>

          <div>
            <p className="mb-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Petsa</p>
            <Input
              type="date"
              value={date}
              max={manilaDateStr()}
              onChange={(e) => setDate(e.target.value)}
              className="h-11 rounded-xl"
            />
          </div>
        </div>

        <DrawerFooter className="pt-3">
          <Button onClick={submit} disabled={saving} className="btn-hero h-12 rounded-2xl text-base font-bold" size="lg">
            {saving ? "Sine-save…" : isBenta ? "I-save ang Benta" : "I-save ang Gastos"}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
