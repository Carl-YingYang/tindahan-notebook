"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { UserPlus, Search, X, NotebookPen, CalendarClock } from "lucide-react";
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AmountInput, parseAmount } from "./amount-input";
import { manilaDateStr } from "@/lib/format";
import { apiPost } from "@/lib/api";
import { useCustomers, useRefreshAll } from "@/hooks/use-store";
import type { CustomerSummary } from "@/types";
import { cn } from "@/lib/utils";

/**
 * Add Utang — pick an existing suki or type a new name.
 * If lockedCustomer is set, the customer is fixed (used from customer detail).
 */
export function AddUtangSheet({
  open,
  onOpenChange,
  lockedCustomer,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lockedCustomer?: { id: string; name: string } | null;
}) {
  const refreshAll = useRefreshAll();
  const { data: customers } = useCustomers();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<CustomerSummary | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(() => manilaDateStr());
  const [dueDate, setDueDate] = useState(""); // "" = walang due date
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(null);
      setAmount("");
      setNote("");
      setDate(manilaDateStr());
      setDueDate("");
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return (customers ?? []).slice(0, 6);
    return (customers ?? []).filter((c) => c.name.toLowerCase().includes(q)).slice(0, 6);
  }, [customers, query]);

  const exactExists = useMemo(
    () => (customers ?? []).some((c) => c.name.toLowerCase() === query.trim().toLowerCase()),
    [customers, query]
  );

  /** yyyy-mm-dd offset by n days from today (Manila) */
  const dateOffset = (days: number) =>
    manilaDateStr(new Date(Date.now() + days * 24 * 60 * 60 * 1000));

  const submit = async () => {
    const amt = parseAmount(amount);
    if (amt <= 0) {
      toast.error("Ilagay ang tamang halaga");
      return;
    }
    if (!selected && !query.trim()) {
      toast.error("Piliin o i-type ang pangalan ng customer");
      return;
    }
    setSaving(true);
    try {
      const iso = date === manilaDateStr() ? new Date().toISOString() : `${date}T12:00:00+08:00`;
      const dueIso = dueDate ? `${dueDate}T23:59:00+08:00` : null;
      // "__new__" is the placeholder id for a not-yet-created customer —
      // send the NAME so the API resolves/creates it (never the placeholder id).
      const isNewCustomer = selected?.id === "__new__";
      const res = await apiPost<{ customer: { name: string } }>("/api/utang", {
        customerId: isNewCustomer ? undefined : selected?.id,
        customerName: isNewCustomer ? selected.name : selected ? undefined : query.trim(),
        amount: amt,
        note: note.trim() || null,
        dueDate: dueIso,
        date: iso,
      });
      toast.success(`Naidagdag ang utang ni ${res.customer?.name ?? "customer"}!`);
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
            <span className="flex size-8 items-center justify-center rounded-lg bg-orange-100 text-orange-600">
              <NotebookPen className="size-4" />
            </span>
            Add Utang
          </DrawerTitle>
          <DrawerDescription className="text-xs">Itala ang hiniram na paninda ng suki</DrawerDescription>
        </DrawerHeader>

        <div className="px-4 space-y-4 overflow-y-auto nice-scroll max-h-[52vh]">
          {lockedCustomer ? (
            <div className="flex items-center justify-between rounded-xl border border-border bg-muted/50 px-4 py-3">
              <span className="font-bold">{lockedCustomer.name}</span>
            </div>
          ) : selected ? (
            <div className="flex items-center justify-between rounded-xl border border-primary/40 bg-primary/5 px-4 py-3">
              <span className="font-bold">{selected.name}</span>
              <button
                type="button"
                aria-label="Kanselahin ang piniling customer"
                onClick={() => setSelected(null)}
                className="text-muted-foreground hover:text-foreground p-1"
              >
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter" || !query.trim()) return;
                    e.preventDefault();
                    const q = query.trim().toLowerCase();
                    const match = (customers ?? []).find(
                      (c) => c.name.toLowerCase() === q
                    );
                    if (match) {
                      setSelected(match);
                    } else {
                      setSelected({
                        id: "__new__",
                        name: query.trim(),
                        balance: 0,
                        totalUtang: 0,
                        totalPaid: 0,
                        txnCount: 0,
                        lastActivityAt: null,
                        createdAt: "",
                      });
                    }
                  }}
                  placeholder="Pangalan ng suki…"
                  className="h-11 rounded-xl pl-10"
                  maxLength={60}
                  enterKeyHint="done"
                />
              </div>
              {filtered.length > 0 && (
                <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
                  {filtered.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelected(c)}
                      className={cn(
                        "flex w-full items-center justify-between px-4 py-2.5 text-sm min-h-[44px] hover:bg-muted/70 text-left",
                        c.balance > 0 && "bg-orange-50/60 dark:bg-orange-500/5"
                      )}
                    >
                      <span className="font-semibold">{c.name}</span>
                      {c.balance > 0 && (
                        <span className="text-xs font-semibold text-orange-600">
                          May utang: ₱{c.balance.toLocaleString("en-PH")}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
              {query.trim() && !exactExists && !selected && (
                <button
                  type="button"
                  onClick={() =>
                    setSelected({
                      id: "__new__",
                      name: query.trim(),
                      balance: 0,
                      totalUtang: 0,
                      totalPaid: 0,
                      txnCount: 0,
                      lastActivityAt: null,
                      createdAt: "",
                    })
                  }
                  className="flex w-full items-center gap-2 rounded-xl border border-dashed border-primary/50 bg-primary/5 px-4 py-3 text-sm font-semibold text-primary min-h-[44px] active:scale-[0.99]"
                >
                  <UserPlus className="size-4" />
                  Gumawa ng bagong customer: “{query.trim()}”
                </button>
              )}
            </div>
          )}

          <AmountInput value={amount} onChange={setAmount} />

          <div>
            <p className="mb-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Note (optional)</p>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="hal. 2 Lucky Me, 1 Coke"
              className="h-11 rounded-xl"
              maxLength={120}
            />
          </div>

          <div>
            <p className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              <CalendarClock className="size-3.5" />
              Kailan bayad? (optional)
            </p>
            <div className="mb-2 grid grid-cols-4 gap-1.5">
              {([
                { label: "Bukas", days: 1 },
                { label: "3 araw", days: 3 },
                { label: "1 linggo", days: 7 },
                { label: "2 linggo", days: 14 },
              ] as const).map((c) => {
                const day = dateOffset(c.days);
                const active = dueDate === day;
                return (
                  <button
                    key={c.label}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setDueDate(active ? "" : day)}
                    className={cn(
                      "h-9 rounded-lg border text-[12px] font-semibold transition-all touch-manipulation active:scale-95",
                      active
                        ? "border-orange-400 bg-orange-100 text-orange-700 dark:border-orange-500/50 dark:bg-orange-500/15 dark:text-orange-400"
                        : "border-border bg-card text-muted-foreground"
                    )}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
            <Input
              type="date"
              value={dueDate}
              min={manilaDateStr()}
              onChange={(e) => setDueDate(e.target.value)}
              aria-label="Due date (optional)"
              className="h-11 rounded-xl"
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
            {saving ? "Sine-save…" : "I-save ang Utang"}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
