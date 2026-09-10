// ── Deterministic restock suggestion (NO AI, no SDK) ─────────────
// Given a budget, greedily fill a restock list from product stock
// status + restock history. Pure local logic over Prisma data.

import { db } from "@/lib/db";
import { daysSince, manilaDayStart } from "@/lib/format";
import type { RestockSuggestion, SuggestionLine } from "@/types";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_QTY = 12;
const DEFAULT_INTERVAL_DAYS = 21; // used when typicalIntervalDays is unknown
const FREQUENT_THRESHOLD = 2; // restocks in the last 30 days
const SLOW_MOVER_DAYS = 90;
const NO_COST_SUFFIX = " (kulang ang presyo info)";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Whole Manila-day difference since a date (null if never). */
function manilaDaysAgo(date: Date | null | undefined): number | null {
  return date ? daysSince(date.toISOString()) : null;
}

/** Raw Prisma product row (the DTO in @/types adds computed fields). */
type ProductRow = Awaited<ReturnType<typeof db.product.findMany>>[number];

type Candidate = {
  product: ProductRow;
  priority: number; // 1 paubos | 2 ubos | 3 frequent | 4 regular
  reason: SuggestionLine["reason"];
  reasonLabel: string;
  restocks30d: number;
  daysOld: number | null;
};

function classify(
  product: ProductRow,
  restocks30d: number,
  daysOld: number | null
): Candidate | null {
  const isHealthy = product.stockStatus === "marami" || product.stockStatus === "sakto";

  // Slow movers: old stock, still plenty, not recently restocked → skip.
  if (isHealthy && (daysOld === null || daysOld > SLOW_MOVER_DAYS) && restocks30d < FREQUENT_THRESHOLD) {
    return null;
  }

  if (product.stockStatus === "paubos") {
    return { product, priority: 1, reason: "paubos", reasonLabel: "Paubos na — kailangan agad", restocks30d, daysOld };
  }
  if (product.stockStatus === "ubos") {
    return { product, priority: 2, reason: "ubos", reasonLabel: "Ubos na — kailangan agad", restocks30d, daysOld };
  }
  if (restocks30d >= FREQUENT_THRESHOLD) {
    return { product, priority: 3, reason: "frequent", reasonLabel: "Madalas i-restock", restocks30d, daysOld };
  }
  if (isHealthy && daysOld !== null && daysOld > (product.typicalIntervalDays ?? DEFAULT_INTERVAL_DAYS)) {
    return { product, priority: 4, reason: "regular", reasonLabel: "Matagal na since last restock", restocks30d, daysOld };
  }
  return null;
}

export async function suggestRestock(budget: number): Promise<RestockSuggestion> {
  const safeBudget = typeof budget === "number" && Number.isFinite(budget) ? round2(budget) : 0;
  if (safeBudget <= 0) {
    return { budget: safeBudget, items: [], total: 0, remaining: safeBudget };
  }

  const now = new Date();
  const since30 = new Date(manilaDayStart(now).getTime() - 29 * DAY_MS);

  const [products, recentItems] = await Promise.all([
    db.product.findMany(),
    db.restockItem.findMany({
      where: { productId: { not: null }, restock: { date: { gte: since30 } } },
      select: { productId: true },
    }),
  ]);

  const restockCounts = new Map<string, number>();
  for (const item of recentItems) {
    if (!item.productId) continue;
    restockCounts.set(item.productId, (restockCounts.get(item.productId) ?? 0) + 1);
  }

  const candidates: Candidate[] = [];
  for (const product of products) {
    const candidate = classify(product, restockCounts.get(product.id) ?? 0, manilaDaysAgo(product.lastRestockAt));
    if (candidate) candidates.push(candidate);
  }

  // Priority first; products without cost info go last within their class;
  // then longest-overdue first; name as a stable tiebreaker.
  candidates.sort((a, b) => {
    const noCostA = a.product.lastCost === null ? 1 : 0;
    const noCostB = b.product.lastCost === null ? 1 : 0;
    return (
      a.priority - b.priority ||
      noCostA - noCostB ||
      (b.daysOld ?? 0) - (a.daysOld ?? 0) ||
      a.product.name.localeCompare(b.product.name)
    );
  });

  let remaining = safeBudget;
  let total = 0;
  const items: SuggestionLine[] = [];

  for (const candidate of candidates) {
    const noCost = candidate.product.lastCost === null;
    const estUnitCost = noCost ? 0 : round2(candidate.product.lastCost as number);
    let qty = noCost ? 1 : Math.max(1, Math.round(candidate.product.lastRestockQty ?? DEFAULT_QTY));
    let estTotal = round2(qty * estUnitCost);

    if (estTotal > remaining) {
      // Whole qty doesn't fit — try half (min 1); otherwise skip this item.
      const halfQty = Math.max(1, Math.floor(qty / 2));
      const halfTotal = round2(halfQty * estUnitCost);
      if (halfQty < qty && halfTotal <= remaining) {
        qty = halfQty;
        estTotal = halfTotal;
      } else {
        continue;
      }
    }

    items.push({
      productId: candidate.product.id,
      name: candidate.product.name,
      qty,
      estUnitCost,
      estTotal,
      reason: candidate.reason,
      reasonLabel: noCost ? `${candidate.reasonLabel}${NO_COST_SUFFIX}` : candidate.reasonLabel,
    });
    remaining = round2(remaining - estTotal);
    total = round2(total + estTotal);
  }

  return { budget: safeBudget, items, total, remaining };
}
