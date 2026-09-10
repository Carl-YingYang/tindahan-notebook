// ── /api/day — all benta + gastos for one Manila calendar day ──
// Powers the Home "Nitong Linggo" day-detail sheet.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { manilaDayStart, manilaDayEnd } from "@/lib/format";
import { roundMoney } from "../customers/summary";

export const dynamic = "force-dynamic";

// GET /api/day?date=YYYY-MM-DD
// → { date, sales[], expenses[], totals: { benta, gastos, net } }
export async function GET(req: NextRequest) {
  try {
    const dateParam = new URL(req.url).searchParams.get("date") ?? "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      return NextResponse.json(
        { error: "Invalid na petsa (kailangan YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    const [y, m, d] = dateParam.split("-").map(Number);
    // Noon-UTC anchor: lands at 20:00 Manila of the same calendar date —
    // safely inside the target Manila day, never straddles midnight.
    const anchor = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1, 12));
    const start = manilaDayStart(anchor);
    const end = manilaDayEnd(anchor); // exclusive upper bound

    const [sales, expenses] = await Promise.all([
      db.sale.findMany({
        where: { date: { gte: start, lt: end } },
        orderBy: { date: "desc" },
      }),
      db.expense.findMany({
        where: { date: { gte: start, lt: end } },
        orderBy: { date: "desc" },
      }),
    ]);

    const benta = roundMoney(sales.reduce((s, r) => s + r.amount, 0));
    const gastos = roundMoney(expenses.reduce((s, r) => s + r.amount, 0));

    return NextResponse.json({
      date: dateParam,
      sales: sales.map((r) => ({
        id: r.id,
        amount: r.amount,
        category: r.category,
        note: r.note,
        date: r.date.toISOString(),
      })),
      expenses: expenses.map((r) => ({
        id: r.id,
        amount: r.amount,
        category: r.category,
        note: r.note,
        date: r.date.toISOString(),
      })),
      totals: { benta, gastos, net: roundMoney(benta - gastos) },
    });
  } catch (err) {
    console.error("[GET /api/day]", err);
    return NextResponse.json({ error: "May problema sa server" }, { status: 500 });
  }
}
