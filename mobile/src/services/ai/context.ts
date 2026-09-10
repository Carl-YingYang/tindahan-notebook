/**
 * Suki AI context builder — ALL numbers are computed deterministically
 * on-device from the local SQLite database. The LLM is only asked to
 * phrase advice; it never calculates values.
 */

import { db } from "@/db/client";
import { manilaDateStr, manilaDayStart, manilaDayEnd, roundMoney } from "@/logic/format";
import { suggestRestock } from "@/logic/restock-suggester";
import { listProducts } from "@/db/repos/products";

export interface AiContextResult {
  context: Record<string, unknown>;
  budgetSuggestion: ReturnType<typeof suggestRestock> | null;
}

/** Budget intent: keyword (budget|puhunan|pera|₱) + first number ≥ 50. */
export function detectBudget(message: string): number | null {
  if (!/(budget|puhunan|pera|₱)/i.test(message)) return null;
  const cleaned = message.replace(/,/g, "");
  const match = cleaned.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const n = parseFloat(match[1]);
  return Number.isFinite(n) && n >= 50 ? n : null;
}

function buildContext(budgetSuggestion: ReturnType<typeof suggestRestock> | null) {
  const now = new Date();
  const todayStart = manilaDayStart(now);
  const todayEnd = manilaDayEnd(now);
  const weekStart = new Date(todayStart.getTime() - 6 * 86400000);

  const sumRange = (table: "sales" | "expenses", start: Date, end: Date): number => {
    const row = db.getFirstSync<{ total: number }>(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM ${table} WHERE date >= ? AND date < ?`,
      [start.toISOString(), end.toISOString()]
    );
    return roundMoney(row?.total ?? 0);
  };

  const todayBenta = sumRange("sales", todayStart, todayEnd);
  const todayGastos = sumRange("expenses", todayStart, todayEnd);
  const weekBenta = sumRange("sales", weekStart, todayEnd);
  const weekGastos = sumRange("expenses", weekStart, todayEnd);

  const utangRow = db.getFirstSync<{ utang: number; paid: number }>(
    `SELECT
      COALESCE(SUM(CASE WHEN type = 'utang' THEN amount END), 0) AS utang,
      COALESCE(SUM(CASE WHEN type = 'payment' THEN amount END), 0) AS paid
    FROM utang_transactions`
  );
  const outstanding = roundMoney((utangRow?.utang ?? 0) - (utangRow?.paid ?? 0));

  const topCustomers = db
    .getAllSync<{ name: string; bal: number }>(
      `SELECT c.name,
        COALESCE(SUM(CASE WHEN t.type = 'utang' THEN t.amount END), 0) -
        COALESCE(SUM(CASE WHEN t.type = 'payment' THEN t.amount END), 0) AS bal
      FROM customers c JOIN utang_transactions t ON t.customer_id = c.id
      GROUP BY c.id HAVING bal > 0 ORDER BY bal DESC LIMIT 3`
    )
    .map((r) => ({ name: r.name, balance: roundMoney(r.bal) }));

  const products = listProducts();
  const stockCounts = { marami: 0, sakto: 0, paubos: 0, ubos: 0 };
  for (const p of products) {
    if (p.stockStatus in stockCounts) stockCounts[p.stockStatus as keyof typeof stockCounts]++;
  }

  const lowStock = (status: "paubos" | "ubos") =>
    products
      .filter((p) => p.stockStatus === status)
      .sort((a, b) => (b.daysSinceRestock ?? 999) - (a.daysSinceRestock ?? 999))
      .slice(0, 10)
      .map((p) => ({ name: p.name, daysSinceRestock: p.daysSinceRestock, lastCost: p.lastCost }));

  // restock frequency: top 5 products by restock-item count in last 30 days
  const freqRows = db.getAllSync<{ name: string; n: number }>(
    `SELECT ri.name, COUNT(*) AS n
     FROM restock_items ri JOIN restocks r ON r.id = ri.restock_id
     WHERE ri.product_id IS NOT NULL AND r.date >= ?
     GROUP BY ri.product_id ORDER BY n DESC LIMIT 5`,
    [new Date(todayStart.getTime() - 29 * 86400000).toISOString()]
  );

  const shopRow = db.getFirstSync<{ n: number; total: number }>(
    `SELECT COUNT(*) AS n, COALESCE(SUM(est_total), 0) AS total FROM shopping_list_items WHERE purchased = 0`
  );

  const context: Record<string, unknown> = {
    todayDate: manilaDateStr(now),
    today: { benta: todayBenta, gastos: todayGastos, net: roundMoney(todayBenta - todayGastos) },
    week: { benta: weekBenta, gastos: weekGastos, net: roundMoney(weekBenta - weekGastos) },
    utang: { outstanding, topCustomers },
    stock: {
      counts: { ...stockCounts, total: products.length },
      paubos: lowStock("paubos"),
      ubos: lowStock("ubos"),
    },
    restockFrequency: freqRows.map((r) => ({ name: r.name, restocksIn30d: Number(r.n) })),
    shoppingList: { pendingCount: Number(shopRow?.n ?? 0), pendingEstTotal: roundMoney(shopRow?.total ?? 0) },
  };
  if (budgetSuggestion) {
    context.budgetSuggestion = {
      budget: budgetSuggestion.budget,
      items: budgetSuggestion.items.map((i) => ({
        name: i.name,
        qty: i.qty,
        estUnitCost: i.estUnitCost,
        estTotal: i.estTotal,
        reason: i.reasonLabel,
      })),
      total: budgetSuggestion.total,
      remaining: budgetSuggestion.remaining,
    };
  }
  return context;
}

export function buildAiContext(message: string): AiContextResult {
  const budget = detectBudget(message);
  let budgetSuggestion: ReturnType<typeof suggestRestock> | null = null;
  if (budget) {
    const products = listProducts();
    const freq = db.getAllSync<{ product_id: string }>(
      `SELECT ri.product_id FROM restock_items ri JOIN restocks r ON r.id = ri.restock_id
       WHERE ri.product_id IS NOT NULL AND r.date >= ?`,
      [new Date(manilaDayStart().getTime() - 29 * 86400000).toISOString()]
    );
    budgetSuggestion = suggestRestock(budget, {
      products,
      restockedProductIds30d: freq.map((r) => r.product_id),
    });
  }
  return { context: buildContext(budgetSuggestion), budgetSuggestion };
}

/** Verbatim system prompt from the web prototype. */
export const SUKI_SYSTEM_PROMPT =
  "Ikaw si Suki, ang mabait at matinong store assistant ng isang maliit na sari-sari store sa Pilipinas. Sumagot sa simpleng Taglish, maikli at diretso (max ~150 salita maliban kung may listahan). GAMITIN MO LANG ang datos sa ibinigay na context — HUWAG mag-imbento ng numero. Kung kulang ang datos, sabihin: \"Kulang pa ang sales at restock history para makapagbigay ako ng reliable recommendation.\" Kapag may budgetSuggestion sa context, ipakita ang mga item bilang simpleng listahan na may presyo, estimated total, at natitirang budget, at sabihin na puwede silang i-tap na \"Add to Restock List\" sa app.";
