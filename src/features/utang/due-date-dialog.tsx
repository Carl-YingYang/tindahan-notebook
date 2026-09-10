"use client";

// ── Due-date editor for utang records ("Kailan bayad?") ──────────
// Opens from a tap on the due chip in the customer history list.
// PATCH /api/utang-txn/[id] { dueDate } — null clears it.

import { useEffect, useState } from "react";
import { CalendarClock, Loader2, Trash2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { apiPatch } from "@/lib/api";
import { manilaDateStr } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { UtangTxn } from "@/types";

/** ISO string → yyyy-mm-dd (Manila) for <input type="date"> */
function toInputDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : manilaDateStr(d);
}

export function DueDateDialog({
  txn,
  customerName,
  onOpenChange,
}: {
  txn: UtangTxn | null;
  customerName: string;
  /** Controls Dialog open — open when txn is non-null */
  onOpenChange: (open: boolean) => void;
}) {
  const [date, setDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    if (txn) setDate(toInputDate(txn.dueDate));
  }, [txn]);

  const tomorrow = manilaDateStr(new Date(Date.now() + 24 * 60 * 60 * 1000));
  const nextWeek = manilaDateStr(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));

  async function save(dueDateIso: string | null) {
    if (!txn) return;
    const clearing = dueDateIso === null;
    if (clearing) setRemoving(true);
    else setSaving(true);
    try {
      await apiPatch(`/api/utang-txn/${txn.id}`, { dueDate: dueDateIso });
      toast.success(clearing ? "Naitanggal ang due date" : "Naitakda ang due date!");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "May problema, subukan ulit");
    } finally {
      setSaving(false);
      setRemoving(false);
    }
  }

  return (
    <Dialog open={txn !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xs rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="size-4 text-primary" />
            Kailan bayad?
          </DialogTitle>
          <DialogDescription>
            Due date ng {`₱${(txn?.amount ?? 0).toLocaleString("en-PH")}`} utang ni {customerName}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            aria-label="Due date"
            className="h-12 rounded-xl text-base"
          />
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setDate(tomorrow)}
              className={cn(
                "min-h-9 rounded-lg border px-2.5 text-xs font-semibold transition touch-manipulation active:scale-95",
                date === tomorrow
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              )}
            >
              Bukas
            </button>
            <button
              type="button"
              onClick={() => setDate(nextWeek)}
              className={cn(
                "min-h-9 rounded-lg border px-2.5 text-xs font-semibold transition touch-manipulation active:scale-95",
                date === nextWeek
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              )}
            >
              Sa loob ng isang linggo
            </button>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {txn?.dueDate && (
            <Button
              type="button"
              variant="ghost"
              disabled={saving || removing}
              onClick={() => void save(null)}
              className="mr-auto h-11 rounded-xl text-destructive hover:text-destructive"
            >
              {removing ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              Alisin
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            disabled={saving || removing}
            onClick={() => onOpenChange(false)}
            className="h-11 rounded-xl"
          >
            Kanselahin
          </Button>
          <Button
            type="button"
            disabled={saving || removing || !date}
            onClick={() => void save(`${date}T12:00:00+08:00`)}
            className="btn-hero h-11 rounded-xl font-bold"
          >
            {saving ? "Sine-save…" : "I-save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
