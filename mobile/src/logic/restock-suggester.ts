/**
 * Deterministic restock budget allocator — verbatim port of the web
 * prototype's src/services/restock-suggester.ts. NO AI involved.
 *
 * Priority: paubos → ubos → frequently restocked (≥2 in last 30 days)
 * → overdue vs typical interval. Slow movers are skipped.
 * Greedy fill within budget, halving qty when a line doesn't fit.
 */

import { roundMoney } from "./format";
import { DEFAULT_RESTOCK_QTY } from "./constants";

export interface SuggesterProduct {
  id: string;
  name: string;
  stockStatus: string;
  lastRestockAt: string | null;
  lastRestockQty: number | null;
  lastCost: number | null;
  typicalIntervalDays: number | null;
}

export interface SuggestionLine {
  productId: string;
  name: string;
  qty: number;
  estUnitCost: number;
  estTotal: number;
  reason: "paubos" | "ubos" | "frequent" | "regular";
  reasonLabel: string;
}

export interface RestockSuggestion {
  budget: number;
  items: SuggestionLine[];
  total: number;
  remaining: number;
}

export interface SuggesterInput {
  products: SuggesterProduct[];
  /** productIds restocked in the last 30 days (one entry per restock occurrence) */
  restockedProductIds30d: string[];
  now?: Date;
}

const DEFAULT_INTERVAL_DAYS = 21;
const FREQUENT_THRESHOLD = 2;
const SLOW_MOVER_DAYS = 90;
const NO_COST_SUFFIX = " (kulang ang presyo info)";

interface Classified {
  product: SuggesterProduct;
  priority: number;
  reasonLabel: string;
  daysOld: number | null;
  restocks30d: number;
}

function classify(
  product: SuggesterProduct,
  restocks30d: number,
  now: Date
): Classified | null {
  const daysOld = product.lastRestockAt
    ? Math.max(0, Math.floor((now.getTime() - new Date(product.lastRestockAt).getTime()) / 86400000))
    : null;
  const healthy = product.stockStatus === "marami" || product.stockStatus === "sakto";

  // Skip slow movers: healthy stock, never/long-ago restocked, rarely bought.
  if (
    healthy &&
    (product.lastRestockAt === null || (daysOld ?? 0) > SLOW_MOVER_DAYS) &&
    restocks30d < FREQUENT_THRESHOLD
  ) {
    return null;
  }

  if (product.stockStatus === "paubos") {
    return { product, priority: 1, reasonLabel: "Paubos na — kailangan agad", daysOld, restocks30d };
  }
  if (product.stockStatus === "ubos") {
    return { product, priority: 2, reasonLabel: "Ubos na — kailangan agad", daysOld, restocks30d };
  }
  if (restocks30d >= FREQUENT_THRESHOLD) {
    return { product, priority: 3, reasonLabel: "Madalas i-restock", daysOld, restocks30d };
  }
  const interval = product.typicalIntervalDays ?? DEFAULT_INTERVAL_DAYS;
  if (healthy && daysOld !== null && daysOld > interval) {
    return { product, priority: 4, reasonLabel: "Matagal na since last restock", daysOld, restocks30d };
  }
  return null;
}

export function suggestRestock(budget: number, input: SuggesterInput): RestockSuggestion {
  const now = input.now ?? new Date();
  const counts = new Map<string, number>();
  for (const pid of input.restockedProductIds30d) {
    counts.set(pid, (counts.get(pid) ?? 0) + 1);
  }

  const classified: Classified[] = [];
  for (const product of input.products) {
    const c = classify(product, counts.get(product.id) ?? 0, now);
    if (c) classified.push(c);
  }

  // priority asc → products without cost info first within a class →
  // longest-overdue first → name asc
  classified.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    const aNoCost = a.product.lastCost === null || a.product.lastCost === undefined;
    const bNoCost = b.product.lastCost === null || b.product.lastCost === undefined;
    if (aNoCost !== bNoCost) return aNoCost ? -1 : 1;
    const aOld = a.daysOld ?? -1;
    const bOld = b.daysOld ?? -1;
    if (aOld !== bOld) return bOld - aOld;
    return a.product.name.localeCompare(b.product.name);
  });

  let remaining = roundMoney(Math.max(0, budget));
  const items: SuggestionLine[] = [];

  for (const c of classified) {
    if (remaining <= 0) break;
    const p = c.product;
    const baseQty = p.lastCost && p.lastCost > 0
      ? Math.max(1, Math.round(p.lastRestockQty ?? DEFAULT_RESTOCK_QTY))
      : 1;
    const cost = p.lastCost ?? 0;

    let qty = baseQty;
    let total = roundMoney(qty * cost);
    if (total > remaining) {
      const half = Math.max(1, Math.floor(baseQty / 2));
      const halfTotal = roundMoney(half * cost);
      if (halfTotal <= remaining && half !== qty) {
        qty = half;
        total = halfTotal;
      } else if (total > remaining) {
        continue;
      } else {
        // half didn't apply but base fits
      }
    }
    if (total > remaining) continue;

    remaining = roundMoney(remaining - total);
    items.push({
      productId: p.id,
      name: p.name,
      qty,
      estUnitCost: cost,
      estTotal: total,
      reason: c.priority === 1 ? "paubos" : c.priority === 2 ? "ubos" : c.priority === 3 ? "frequent" : "regular",
      reasonLabel: p.lastCost ? c.reasonLabel : c.reasonLabel + NO_COST_SUFFIX,
    });
  }

  return {
    budget: roundMoney(budget),
    items,
    total: roundMoney(items.reduce((s, i) => s + i.estTotal, 0)),
    remaining,
  };
}
