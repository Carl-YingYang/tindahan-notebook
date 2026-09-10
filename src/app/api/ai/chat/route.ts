// ── Suki AI chat (backend ONLY — uses z-ai-web-dev-sdk) ──────────
// GET    → last 50 messages (oldest→newest)
// POST   → { message } → { reply, suggestion? }
// DELETE → clear conversation → { ok: true }

import { NextRequest, NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";
import { db } from "@/lib/db";
import { daysSince, manilaDateStr, manilaDayEnd, manilaDayStart } from "@/lib/format";
import { suggestRestock } from "@/services/restock-suggester";
import type { RestockSuggestion } from "@/types";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_MESSAGE_LENGTH = 4000;

const SUKI_SYSTEM_PROMPT = `Ikaw si Suki, ang mabait at matinong store assistant ng isang maliit na sari-sari store sa Pilipinas. Sumagot sa simpleng Taglish, maikli at diretso (max ~150 salita maliban kung may listahan). GAMITIN MO LANG ang datos sa ibinigay na context — HUWAG mag-imbento ng numero. Kung kulang ang datos, sabihin: "Kulang pa ang sales at restock history para makapagbigay ako ng reliable recommendation." Kapag may budgetSuggestion sa context, ipakita ang mga item bilang simpleng listahan na may presyo, estimated total, at natitirang budget, at sabihin na puwede silang i-tap na "Add to Restock List" sa app.`;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ── GET: history ─────────────────────────────────────────────────
export async function GET() {
  try {
    const rows = await db.aiConversation.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    const messages = rows
      .reverse() // oldest → newest
      .map((r) => ({
        id: r.id,
        role: (r.role === "assistant" ? "assistant" : "user") as "assistant" | "user",
        content: r.content,
        createdAt: r.createdAt.toISOString(),
      }));
    return NextResponse.json(messages);
  } catch (err) {
    console.error("[api/ai/chat] GET failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Hindi ma-load ang usapan kay Suki" }, { status: 500 });
  }
}

// ── DELETE: clear history ────────────────────────────────────────
export async function DELETE() {
  try {
    await db.aiConversation.deleteMany({});
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/ai/chat] DELETE failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Hindi ma-clear ang usapan" }, { status: 500 });
  }
}

// ── Budget intent: word + first number ≥ 50 ─────────────────────
const BUDGET_INTENT = /(budget|puhunan|pera|₱)/i;
const NUMBER_PATTERN = /(\d[\d,]*(?:\.\d+)?)/g;

function detectBudget(message: string): number | null {
  if (!BUDGET_INTENT.test(message)) return null;
  for (const match of message.matchAll(NUMBER_PATTERN)) {
    const n = Number.parseFloat(match[1].replace(/,/g, ""));
    if (Number.isFinite(n) && n >= 50) return n;
  }
  return null;
}

// ── POST: ask Suki ───────────────────────────────────────────────
export async function POST(req: NextRequest) {
  let body: { message?: unknown } | null = null;
  try {
    body = (await req.json()) as { message?: unknown } | null;
  } catch {
    body = null;
  }

  const rawMessage = typeof body?.message === "string" ? body.message : "";
  const message = rawMessage.trim().slice(0, MAX_MESSAGE_LENGTH);
  if (!message) {
    return NextResponse.json({ error: "Isulat ang tanong mo kay Suki" }, { status: 400 });
  }

  // 1. Save the user message first (removed again if anything below fails).
  let userRowId: string | null = null;
  try {
    const userRow = await db.aiConversation.create({
      data: { role: "user", content: message },
    });
    userRowId = userRow.id;

    // 2. Compact local context (aggregates + product names only — no sensitive data).
    const now = new Date();
    const todayStart = manilaDayStart(now);
    const todayEnd = manilaDayEnd(now);
    const weekStart = manilaDayStart(new Date(now.getTime() - 6 * DAY_MS));
    const since30 = new Date(todayStart.getTime() - 29 * DAY_MS);

    const [todaySales, todayExpenses, weekSales, weekExpenses, customers, products, recentRestockItems, pendingShopping] =
      await Promise.all([
        db.sale.aggregate({ _sum: { amount: true }, where: { date: { gte: todayStart, lt: todayEnd } } }),
        db.expense.aggregate({ _sum: { amount: true }, where: { date: { gte: todayStart, lt: todayEnd } } }),
        db.sale.aggregate({ _sum: { amount: true }, where: { date: { gte: weekStart, lt: todayEnd } } }),
        db.expense.aggregate({ _sum: { amount: true }, where: { date: { gte: weekStart, lt: todayEnd } } }),
        db.customer.findMany({ select: { name: true, transactions: { select: { type: true, amount: true } } } }),
        db.product.findMany(),
        db.restockItem.findMany({
          where: { productId: { not: null }, restock: { date: { gte: since30 } } },
          select: { productId: true, product: { select: { name: true, lastCost: true } } },
        }),
        db.shoppingListItem.aggregate({
          _count: true,
          _sum: { estTotal: true },
          where: { purchased: false },
        }),
      ]);

    const todayBenta = round2(todaySales._sum.amount ?? 0);
    const todayGastos = round2(todayExpenses._sum.amount ?? 0);
    const weekBenta = round2(weekSales._sum.amount ?? 0);
    const weekGastos = round2(weekExpenses._sum.amount ?? 0);

    // Utang: outstanding total + top 3 customers by balance.
    const balances = customers
      .map((c) => {
        let balance = 0;
        for (const t of c.transactions) balance += t.type === "utang" ? t.amount : -t.amount;
        return { name: c.name, balance: round2(balance) };
      })
      .filter((b) => b.balance > 0)
      .sort((a, b) => b.balance - a.balance);
    const outstanding = round2(balances.reduce((sum, b) => sum + b.balance, 0));

    // Stock: counts + paubos/ubos lists.
    const counts = { marami: 0, sakto: 0, paubos: 0, ubos: 0 };
    const paubosList: { name: string; daysSinceRestock: number | null; lastCost: number | null }[] = [];
    const ubosList: { name: string; daysSinceRestock: number | null; lastCost: number | null }[] = [];
    for (const p of products) {
      if (p.stockStatus in counts) counts[p.stockStatus as keyof typeof counts] += 1;
      if (p.stockStatus === "paubos" || p.stockStatus === "ubos") {
        const entry = {
          name: p.name,
          daysSinceRestock: daysSince(p.lastRestockAt ? p.lastRestockAt.toISOString() : null),
          lastCost: p.lastCost,
        };
        (p.stockStatus === "paubos" ? paubosList : ubosList).push(entry);
      }
    }
    const byDaysOld = (a: { daysSinceRestock: number | null }, b: { daysSinceRestock: number | null }) =>
      (b.daysSinceRestock ?? Number.MAX_SAFE_INTEGER) - (a.daysSinceRestock ?? Number.MAX_SAFE_INTEGER);

    // Restock frequency: top 5 products by restock-item count (last 30 days).
    const freq = new Map<string, { name: string; count: number; lastCost: number | null }>();
    for (const item of recentRestockItems) {
      if (!item.productId) continue;
      const existing = freq.get(item.productId);
      if (existing) existing.count += 1;
      else freq.set(item.productId, { name: item.product?.name ?? "Unknown", count: 1, lastCost: item.product?.lastCost ?? null });
    }
    const restockFrequency = [...freq.entries()]
      .map(([, v]) => v)
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, 5);

    // Budget intent → attach deterministic suggestion.
    let suggestion: RestockSuggestion | null = null;
    const budget = detectBudget(message);
    if (budget !== null) {
      suggestion = await suggestRestock(budget);
    }

    const context: Record<string, unknown> = {
      todayDate: manilaDateStr(now),
      today: { benta: todayBenta, gastos: todayGastos, net: round2(todayBenta - todayGastos) },
      week: { benta: weekBenta, gastos: weekGastos, net: round2(weekBenta - weekGastos) },
      utang: { outstanding, topCustomers: balances.slice(0, 3) },
      stock: {
        counts: { ...counts, total: products.length },
        paubos: paubosList.sort(byDaysOld).slice(0, 10),
        ubos: ubosList.sort(byDaysOld).slice(0, 10),
      },
      restockFrequency,
      shoppingList: {
        pendingCount: pendingShopping._count,
        pendingEstTotal: round2(pendingShopping._sum.estTotal ?? 0),
      },
    };
    if (suggestion) context.budgetSuggestion = suggestion;

    // 3. Ask the LLM (system prompt uses role "assistant" per SDK skill docs).
    const userContent = `${message}\n\n---\nStore data (context JSON — GAMITIN LANG ANG NUMERONG ITO, huwag mag-imbento):\n${JSON.stringify(context)}`;
    const zai = await ZAI.create();
    const completion = (await zai.chat.completions.create({
      messages: [
        { role: "assistant", content: SUKI_SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      thinking: { type: "disabled" },
    })) as { choices?: { message?: { content?: unknown } }[] } | null;
    const reply = completion?.choices?.[0]?.message?.content;
    if (typeof reply !== "string" || !reply.trim()) {
      throw new Error("Suki returned an empty response");
    }

    // 4. Save the assistant reply.
    await db.aiConversation.create({
      data: { role: "assistant", content: reply.slice(0, MAX_MESSAGE_LENGTH) },
    });

    const payload: { reply: string; suggestion?: RestockSuggestion } = { reply: reply.slice(0, MAX_MESSAGE_LENGTH) };
    if (suggestion) payload.suggestion = suggestion;
    return NextResponse.json(payload);
  } catch (err) {
    console.error("[api/ai/chat] POST failed:", err instanceof Error ? err.message : err);
    // Do not leave a saved user message without a reply.
    if (userRowId) {
      try {
        await db.aiConversation.delete({ where: { id: userRowId } });
      } catch {
        // best effort
      }
    }
    return NextResponse.json(
      { error: "Offline si Suki ngayon. Available pa rin ang ibang features ng app." },
      { status: 503 }
    );
  }
}
