"use client";

// ── "Suhestiyon ni Suki" — budget restock suggestion card ───────
// Rendered attached under the assistant reply that carried a
// RestockSuggestion. One tap adds every line to the restock list.

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { apiPost } from "@/lib/api";
import { peso } from "@/lib/format";
import { useRefreshAll } from "@/hooks/use-store";
import { Button } from "@/components/ui/button";
import type { RestockSuggestion } from "@/types";

export function SuggestionCard({
  suggestion,
  added,
  onAdded,
}: {
  suggestion: RestockSuggestion;
  added: boolean;
  onAdded: () => void;
}) {
  const refreshAll = useRefreshAll();
  const [adding, setAdding] = useState(false);
  const items = suggestion.items ?? [];

  async function handleAdd() {
    if (adding || added || items.length === 0) return;
    setAdding(true);
    try {
      await apiPost<{ count: number }>("/api/shopping-list/bulk", {
        items: items.map((i) => ({
          productId: i.productId || null,
          name: i.name,
          qty: i.qty,
          estUnitCost: i.estUnitCost,
          source: "ai",
        })),
      });
      toast.success("Naidagdag sa restock list!");
      onAdded();
      refreshAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "May problema sa server");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="-mt-1.5 w-[85%] max-w-[85%] self-start rounded-2xl border border-primary/30 bg-primary/5 p-3">
      <div className="flex items-center gap-1.5">
        <Sparkles className="size-4 shrink-0 text-primary" />
        <p className="text-sm font-bold">Suhestiyon ni Suki</p>
        <span className="ml-auto shrink-0 rounded-full bg-primary/15 px-2.5 py-1 text-[11px] font-bold text-primary">
          Budget: {peso(suggestion.budget)}
        </span>
      </div>

      {items.length > 0 && (
        <div className="mt-2.5 space-y-2">
          {items.map((item, idx) => (
            <div key={`${item.name}-${idx}`} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{item.name}</p>
                {item.reasonLabel && (
                  <p className="text-[11px] leading-snug text-muted-foreground">{item.reasonLabel}</p>
                )}
              </div>
              <p className="shrink-0 text-sm font-semibold whitespace-nowrap">
                {item.qty} × {peso(item.estUnitCost)} = {peso(item.estTotal)}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-primary/20 pt-2.5">
        <p className="text-sm font-bold">Estimated total: {peso(suggestion.total)}</p>
        <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
          Matitira sa budget: {peso(suggestion.remaining)}
        </p>
      </div>

      <Button
        onClick={handleAdd}
        disabled={added || adding || items.length === 0}
        className="mt-3 h-11 w-full rounded-xl font-bold touch-manipulation active:scale-[0.98]"
      >
        {added ? "Naidagdag na!" : adding ? "Nagdaragdag…" : "Add to Restock List"}
      </Button>
    </div>
  );
}
