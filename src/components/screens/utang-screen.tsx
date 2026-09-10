"use client";

import { useMemo, useState } from "react";
import { HandCoins, Plus, Search, CalendarClock } from "lucide-react";
import { ScreenHeader } from "@/components/shared/screen-header";
import { EmptyState } from "@/components/shared/empty-state";
import { AddUtangSheet } from "@/components/shared/add-utang-sheet";
import { PaymentSheet } from "@/components/shared/payment-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCustomers } from "@/hooks/use-store";
import { peso, dueInfo } from "@/lib/format";
import { CustomerCard } from "@/features/utang/customer-card";
import { CustomerDetailDrawer } from "@/features/utang/customer-detail-drawer";
import { UtangScreenSkeleton } from "@/features/utang/skeletons";
import type { CustomerSummary } from "@/types";

/**
 * Utang screen — listahan ng mga suki.
 * Self-contained: fetches customers, owns search + summary + detail drawer,
 * and renders AddUtangSheet / PaymentSheet once at screen level.
 */
export default function UtangScreen() {
  const { data: customers, isLoading } = useCustomers();
  const list = customers ?? [];

  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [addLockedId, setAddLockedId] = useState<string | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [payId, setPayId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    // Match pangalan, tala sa suki, at notes ng mga transaksyon (hal. "Lucky Me")
    const base = q
      ? list.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            (c.note ?? "").toLowerCase().includes(q) ||
            (c.notes ?? "").toLowerCase().includes(q)
        )
      : list;
    // Due-urgent suki float to the top: late → due today → due soon → by balance → name
    const rank = (c: CustomerSummary) => {
      const d = c.balance > 0 ? dueInfo(c.dueDate) : null;
      if (!d) return 4;
      if (d.tone === "late") return 0;
      if (d.tone === "today") return 1;
      if (d.tone === "soon") return 2;
      return 3;
    };
    return base.slice().sort((a, b) => {
      const ra = rank(a);
      const rb = rank(b);
      if (ra !== rb) return ra - rb;
      const da = dueInfo(a.dueDate)?.days ?? Number.POSITIVE_INFINITY;
      const dbb = dueInfo(b.dueDate)?.days ?? Number.POSITIVE_INFINITY;
      if (da !== dbb) return da - dbb;
      return b.balance - a.balance || a.name.localeCompare(b.name);
    });
  }, [list, search]);

  const totals = useMemo(() => {
    let outstanding = 0;
    let withUtang = 0;
    let dueCount = 0;
    let dueTotal = 0;
    for (const c of list) {
      if (c.balance > 0) {
        outstanding += c.balance;
        withUtang += 1;
        const d = dueInfo(c.dueDate);
        if (d && (d.tone === "late" || d.tone === "today")) {
          dueCount += 1;
          dueTotal += c.balance;
        }
      }
    }
    return { outstanding, withUtang, dueCount, dueTotal };
  }, [list]);

  // Live objects (kept in sync by TanStack Query after every mutation).
  const selectedCustomer = selectedId ? (list.find((c) => c.id === selectedId) ?? null) : null;
  const addLockedCustomer = addLockedId ? (list.find((c) => c.id === addLockedId) ?? null) : null;
  const payCustomer = payId ? (list.find((c) => c.id === payId) ?? null) : null;

  const openAddUtang = (customer?: CustomerSummary) => {
    setAddLockedId(customer?.id ?? null);
    setAddOpen(true);
  };

  const openCustomer = (customer: CustomerSummary) => {
    setSelectedId(customer.id);
    setDetailOpen(true);
  };

  return (
    <div>
      <ScreenHeader
        title="Utang"
        subtitle="Listahan ng mga suki"
        right={
          <Button
            size="sm"
            className="h-9 gap-1 rounded-xl bg-primary text-primary-foreground touch-manipulation active:scale-95"
            onClick={() => openAddUtang()}
          >
            <Plus className="size-4" />
            Add Utang
          </Button>
        }
      />

      <div className="space-y-4 px-4 py-4">
        {isLoading ? (
          <UtangScreenSkeleton />
        ) : customers === undefined ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            May problema sa pag-load ng listahan. Subukan ulit.
          </p>
        ) : list.length === 0 ? (
          <EmptyState
            icon={HandCoins}
            title="Wala pang utang dito"
            description="Hindi pa nagagamit ang listahan. I-tap ang Add Utang para magsimula."
            action={
              <Button className="h-11 rounded-xl font-bold touch-manipulation active:scale-95" onClick={() => openAddUtang()}>
                <Plus className="size-4" />
                Add Utang
              </Button>
            }
          />
        ) : (
          <>
            {/* Summary strip — computed client-side from the list */}
            <div className="grid grid-cols-2 gap-3 rounded-2xl border border-border bg-card p-4">
              <div>
                <p className="text-xs text-muted-foreground">Kabuuang natitirang utang</p>
                <p className="mt-0.5 text-xl font-extrabold tracking-tight text-orange-600 dark:text-orange-400">
                  {peso(totals.outstanding)}
                </p>
              </div>
              <div className="flex flex-col justify-center border-l border-border pl-3">
                <p className="text-xl font-extrabold tracking-tight text-muted-foreground">
                  {totals.withUtang} suki
                </p>
                <p className="text-xs text-muted-foreground">ang may utang</p>
              </div>
              {totals.dueCount > 0 && (
                <div className="col-span-2 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 dark:border-rose-500/30 dark:bg-rose-500/10">
                  <CalendarClock className="size-4 shrink-0 text-rose-600 dark:text-rose-400" aria-hidden="true" />
                  <p className="text-xs font-semibold text-rose-700 dark:text-rose-400">
                    <span className="text-sm font-extrabold">{totals.dueCount}</span> suki ang due na ({peso(totals.dueTotal)}) — kausapin na sila!
                  </p>
                </div>
              )}
            </div>

            {/* Search */}
            <div className="relative">
              <Search
                aria-hidden="true"
                className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Hanapin ang suki o tala…"
                aria-label="Hanapin ang suki o tala"
                className="h-11 rounded-xl pl-10"
              />
            </div>

            {/* Customer list — due-urgent first (late → due today → due soon), then balance */}
            <div className="space-y-2">
              {filtered.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Walang tumugma sa pangalan o tala.</p>
              ) : (
                filtered.map((c) => <CustomerCard key={c.id} customer={c} onOpen={openCustomer} />)
              )}
            </div>
          </>
        )}
      </div>

      {/* Sheets rendered once at screen level; opened from header or detail drawer */}
      <AddUtangSheet open={addOpen} onOpenChange={setAddOpen} lockedCustomer={addLockedCustomer} />
      <PaymentSheet open={payOpen} onOpenChange={setPayOpen} customer={payCustomer} />

      <CustomerDetailDrawer
        customer={selectedCustomer}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onAddUtang={(c) => openAddUtang(c)}
        onPay={(c) => {
          setPayId(c.id);
          setPayOpen(true);
        }}
      />
    </div>
  );
}
