"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MessageSquareText, NotebookPen, CalendarClock, StickyNote, Pencil, X } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
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
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { peso, dueInfo, DUE_TONE_CLASS, avatarTone } from "@/lib/format";
import { apiPost, apiDelete, apiPatch } from "@/lib/api";
import { useCustomerDetail, useRefreshAll } from "@/hooks/use-store";
import { cn } from "@/lib/utils";
import { UtangTxnRow } from "./txn-row";
import { DueDateDialog } from "./due-date-dialog";
import type { CustomerSummary, UtangTxn } from "@/types";

/**
 * Customer detail drawer: balance, quick actions (Add Utang / Bayad / Mark as Paid)
 * and the full history of utang + payment records. The sheets themselves live at
 * screen level — this drawer only calls back via onAddUtang / onPay.
 */
export function CustomerDetailDrawer({
  customer,
  open,
  onOpenChange,
  onAddUtang,
  onPay,
}: {
  customer: CustomerSummary | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAddUtang: (customer: CustomerSummary) => void;
  onPay: (customer: CustomerSummary) => void;
}) {
  const refreshAll = useRefreshAll();
  // Query is enabled only while a customer is actually selected (id or null).
  const { data: detail, isLoading, error } = useCustomerDetail(customer?.id ?? null);

  const [confirmPaid, setConfirmPaid] = useState(false);
  const [paying, setPaying] = useState(false);
  const [txnToDelete, setTxnToDelete] = useState<UtangTxn | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [txnForDue, setTxnForDue] = useState<UtangTxn | null>(null);
  const [noteEditing, setNoteEditing] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  // Leaving edit mode whenever a different suki is opened (drawer stays mounted).
  useEffect(() => {
    setNoteEditing(false);
  }, [customer?.id]);

  if (!customer) return null;

  const balance = detail?.balance ?? customer.balance;
  const txns = detail?.transactions ?? [];
  const hasBalance = balance > 0;
  const due = hasBalance ? dueInfo(detail?.customer.dueDate ?? customer.dueDate) : null;
  const initial = (customer.name.trim()[0] ?? "?").toUpperCase();

  const markAsPaid = async () => {
    setPaying(true);
    try {
      await apiPost("/api/payments", { customerId: customer.id, markPaid: true });
      toast.success(`Bayad na si ${customer.name}!`);
      refreshAll();
      setConfirmPaid(false);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "May problema, subukan ulit");
    } finally {
      setPaying(false);
    }
  };

  const deleteTxn = async () => {
    if (!txnToDelete) return;
    setDeleting(true);
    try {
      await apiDelete(`/api/utang-txn/${txnToDelete.id}`);
      toast.success("Nabura ang tala");
      refreshAll();
      setTxnToDelete(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "May problema, subukan ulit");
    } finally {
      setDeleting(false);
    }
  };

  const saveNote = async () => {
    setSavingNote(true);
    try {
      await apiPatch(`/api/customers/${customer.id}`, { note: noteDraft.trim() || null });
      toast.success(noteDraft.trim() ? "Nai-save ang tala sa suki!" : "Nabura ang tala sa suki");
      refreshAll();
      setNoteEditing(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "May problema, subukan ulit");
    } finally {
      setSavingNote(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-w-md">
        <DrawerHeader className="text-left pb-2">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-full font-bold",
                avatarTone(customer.name)
              )}
            >
              {initial}
            </span>
            <div className="min-w-0">
              <DrawerTitle className="truncate text-lg font-extrabold">{customer.name}</DrawerTitle>
              <DrawerDescription className="text-xs">Tala ng utang at bayad</DrawerDescription>
            </div>
          </div>
          <p
            className={cn(
              "mt-3 text-lg font-extrabold tracking-tight",
              hasBalance ? "text-orange-600 dark:text-orange-400" : "text-emerald-600 dark:text-emerald-500"
            )}
          >
            {hasBalance ? `Natitira: ${peso(balance)}` : "Bayad na!"}
          </p>
          {due && (
            <p
              className={cn(
                "mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold",
                DUE_TONE_CLASS[due.tone]
              )}
            >
              <CalendarClock className="size-3" aria-hidden="true" />
              {due.label}
            </p>
          )}
        </DrawerHeader>

        <div className="grid grid-cols-3 gap-2 px-4">
          <button
            type="button"
            onClick={() => onAddUtang(customer)}
            className="h-11 touch-manipulation rounded-xl bg-orange-100 text-[13px] font-semibold text-orange-700 transition-all active:scale-95 dark:bg-orange-500/15 dark:text-orange-400"
          >
            Add Utang
          </button>
          <button
            type="button"
            onClick={() => onPay(customer)}
            disabled={!hasBalance}
            className="h-11 touch-manipulation rounded-xl bg-emerald-100 text-[13px] font-semibold text-emerald-700 transition-all active:scale-95 disabled:pointer-events-none disabled:opacity-50 dark:bg-emerald-500/15 dark:text-emerald-400"
          >
            Bayad
          </button>
          <button
            type="button"
            onClick={() => setConfirmPaid(true)}
            disabled={!hasBalance}
            className="h-11 touch-manipulation rounded-xl bg-muted text-[13px] font-semibold text-muted-foreground transition-all hover:bg-accent active:scale-95 disabled:pointer-events-none disabled:opacity-50"
          >
            Mark as Paid
          </button>
        </div>

        {/* Paalala: copy a friendly reminder message to send via SMS/Messenger */}
        {hasBalance && (
          <button
            type="button"
            onClick={async () => {
              const duePart =
                due?.tone === "late"
                  ? " Nakalipas na po ang sinabing due date."
                  : due?.tone === "today"
                    ? " Ata po due ngayong araw."
                    : "";
              const msg = `Hi ${customer.name}! Paalala lang po: may ${peso(balance)} po kayong natitirang utang sa tindahan.${duePart} Kapag may pera na po, bayad na lang. Salamat po!`;
              try {
                if (navigator.clipboard?.writeText) {
                  await navigator.clipboard.writeText(msg);
                  toast.success("Nakopya ang paalala — i-paste sa text o Messenger!");
                } else {
                  toast.error("Hindi suportado ang pag-copy sa device na ito");
                }
              } catch {
                toast.error("Hindi nakopya, subukan ulit");
              }
            }}
            className="mx-4 mt-2 flex h-10 items-center justify-center gap-1.5 rounded-xl border border-dashed border-orange-300 bg-orange-50 text-[13px] font-semibold text-orange-700 transition-all active:scale-[0.98] dark:border-orange-500/40 dark:bg-orange-500/10 dark:text-orange-400"
          >
            <MessageSquareText className="size-4" />
            Kopyahin ang paalala (para sa text/Messenger)
          </button>
        )}

        {/* Tala sa suki — free-form note about this customer (address, suki habits, etc.) */}
        <div className="px-4">
          {noteEditing ? (
            <div className="rounded-xl border border-amber-300/70 bg-amber-50/60 p-3 dark:border-amber-500/40 dark:bg-amber-500/10">
              <p className="mb-1.5 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                <StickyNote className="size-3" aria-hidden="true" />
                Tala sa suki
              </p>
              <textarea
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                rows={2}
                maxLength={200}
                autoFocus
                placeholder="hal. Nakatira sa kabilang street, bayad tuwing sweldo"
                aria-label="Tala sa suki"
                className="w-full resize-none rounded-lg border border-border bg-background p-2 text-sm outline-none focus:ring-2 focus:ring-amber-400/60"
              />
              <div className="mt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setNoteEditing(false)}
                  className="flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-muted-foreground hover:bg-accent touch-manipulation active:scale-95"
                >
                  <X className="size-3.5" aria-hidden="true" />
                  Kanselahin
                </button>
                <button
                  type="button"
                  onClick={saveNote}
                  disabled={savingNote}
                  className="flex h-8 items-center rounded-lg bg-amber-600 px-3 text-xs font-bold text-white transition-all hover:bg-amber-700 disabled:opacity-60 touch-manipulation active:scale-95 dark:bg-amber-500 dark:text-amber-950 dark:hover:bg-amber-400"
                >
                  {savingNote ? "Sine-save…" : "I-save"}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setNoteDraft(detail?.customer.note ?? customer.note ?? "");
                setNoteEditing(true);
              }}
              className="flex w-full items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-left transition-all hover:bg-accent/50 touch-manipulation active:scale-[0.99]"
            >
              <StickyNote
                className={cn(
                  "size-4 shrink-0",
                  (detail?.customer.note ?? customer.note)
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-muted-foreground"
                )}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  Tala sa suki
                </span>
                <span
                  className={cn(
                    "block truncate text-sm",
                    (detail?.customer.note ?? customer.note)
                      ? "text-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  {(detail?.customer.note ?? customer.note)?.trim() ||
                    "Magdagdag ng paalala tungkol sa suki…"}
                </span>
              </span>
              <Pencil className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="px-4 pt-3 pb-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tala</p>
          <div className="nice-scroll max-h-72 divide-y divide-border overflow-y-auto rounded-xl border border-border">
            {isLoading ? (
              <div className="space-y-3 p-3">
                <Skeleton className="h-10 w-full rounded-lg" />
                <Skeleton className="h-10 w-full rounded-lg" />
                <Skeleton className="h-10 w-full rounded-lg" />
              </div>
            ) : error ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                {error instanceof Error ? error.message : "Hindi ma-load ang tala."}
              </p>
            ) : txns.length === 0 ? (
              <EmptyState
                icon={NotebookPen}
                title="Wala pang tala"
                description={`Idagdag ang unang utang ni ${customer.name}.`}
                className="py-8"
              />
            ) : (
              txns.map((t) => (
                <UtangTxnRow
                  key={t.id}
                  txn={t}
                  onRequestDelete={setTxnToDelete}
                  onRequestDue={setTxnForDue}
                  disabled={deleting}
                />
              ))
            )}
          </div>
        </div>

        {/* Due-date editor ("Kailan bayad?") */}
        <DueDateDialog
          txn={txnForDue}
          customerName={customer.name}
          onOpenChange={(v) => {
            if (!v) setTxnForDue(null);
          }}
        />

        {/* Mark as Paid confirmation */}
        <AlertDialog open={confirmPaid} onOpenChange={setConfirmPaid}>
          <AlertDialogContent className="sm:max-w-sm">
            <AlertDialogHeader>
              <AlertDialogTitle>Markahan bayad na si {customer.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                Gagawa tayo ng payment record para sa {peso(balance)}.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={paying}>Hindi na lang</AlertDialogCancel>
              <AlertDialogAction
                disabled={paying}
                onClick={(e) => {
                  e.preventDefault();
                  markAsPaid();
                }}
              >
                {paying ? "Sine-save…" : "Oo, bayad na"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete transaction confirmation */}
        <AlertDialog open={txnToDelete !== null} onOpenChange={(v) => !v && setTxnToDelete(null)}>
          <AlertDialogContent className="sm:max-w-sm">
            <AlertDialogHeader>
              <AlertDialogTitle>Burahin ang tala?</AlertDialogTitle>
              <AlertDialogDescription>
                {txnToDelete?.type === "payment"
                  ? `Buburahin ang bayad na ${peso(txnToDelete.amount)}. Hindi na ito maibabalik.`
                  : `Buburahin ang utang na ${peso(txnToDelete?.amount ?? 0)}. Hindi na ito maibabalik.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Hindi na lang</AlertDialogCancel>
              <AlertDialogAction
                disabled={deleting}
                onClick={(e) => {
                  e.preventDefault();
                  deleteTxn();
                }}
                className="bg-destructive text-white hover:bg-destructive/90"
              >
                {deleting ? "Binubura…" : "Burahin"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DrawerContent>
    </Drawer>
  );
}
