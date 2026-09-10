"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { HandCoins } from "lucide-react";
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AmountInput, parseAmount } from "./amount-input";
import { manilaDateStr, peso } from "@/lib/format";
import { apiPost } from "@/lib/api";
import { useRefreshAll } from "@/hooks/use-store";
import { cn } from "@/lib/utils";

/** Record a payment for a customer. Prefills the full remaining balance. */
export function PaymentSheet({
  open,
  onOpenChange,
  customer,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  customer: { id: string; name: string; balance: number } | null;
}) {
  const refreshAll = useRefreshAll();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && customer) {
      setAmount(String(customer.balance > 0 ? customer.balance : ""));
      setNote("");
    }
  }, [open, customer]);

  if (!customer) return null;

  const submit = async () => {
    const amt = parseAmount(amount);
    if (amt <= 0) {
      toast.error("Ilagay ang tamang halaga ng bayad");
      return;
    }
    if (amt > customer.balance + 0.001) {
      toast.error(`Malaki sa natitirang utang (${peso(customer.balance)})`);
      return;
    }
    setSaving(true);
    try {
      await apiPost("/api/payments", {
        customerId: customer.id,
        amount: amt,
        markPaid: Math.abs(amt - customer.balance) < 0.001,
        note: note.trim() || null,
        date: new Date().toISOString(),
      });
      toast.success(`Naitala ang bayad ni ${customer.name}!`);
      refreshAll();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "May problema, subukan ulit");
    } finally {
      setSaving(false);
    }
  };

  const remaining = Math.max(0, customer.balance - parseAmount(amount));

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-w-md">
        <DrawerHeader className="text-left pb-2">
          <DrawerTitle className="flex items-center gap-2 text-lg">
            <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
              <HandCoins className="size-4" />
            </span>
            Bayad ni {customer.name}
          </DrawerTitle>
          <DrawerDescription className="text-xs">
            Natitirang utang: <span className="font-bold text-foreground">{peso(customer.balance)}</span>
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-4 space-y-4 overflow-y-auto nice-scroll">
          <AmountInput value={amount} onChange={setAmount} />

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setAmount(String(customer.balance))}
              className="rounded-full border border-emerald-300 bg-emerald-50 px-3.5 py-1.5 text-[13px] font-semibold text-emerald-700 min-h-[36px] active:scale-95 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-400"
            >
              Buong bayad
            </button>
            <button
              type="button"
              onClick={() => setAmount(String(Math.round((customer.balance / 2) * 100) / 100))}
              className="rounded-full border border-border bg-card px-3.5 py-1.5 text-[13px] font-semibold text-muted-foreground min-h-[36px] active:scale-95"
            >
              Kalahati
            </button>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Note (optional)</p>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="hal. bayad sa puhunan"
              className="h-11 rounded-xl"
              maxLength={120}
            />
          </div>

          {parseAmount(amount) > 0 && parseAmount(amount) <= customer.balance && (
            <p className={cn("text-sm font-semibold", remaining === 0 ? "text-emerald-600" : "text-muted-foreground")}>
              {remaining === 0 ? "Bayad na — magsasarado ang utang!" : `Matitira: ${peso(remaining)}`}
            </p>
          )}
        </div>

        <DrawerFooter className="pt-3">
          <Button onClick={submit} disabled={saving || customer.balance <= 0} className="btn-hero h-12 rounded-2xl text-base font-bold" size="lg">
            {saving ? "Sine-save…" : "I-record ang Bayad"}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
