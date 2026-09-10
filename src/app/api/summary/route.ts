import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { manilaDayStart, manilaDayEnd, manilaDateStr } from "@/lib/format";
import { ensureSeeded } from "@/services/seed";

export const dynamic = "force-dynamic";

const DAY = 24 * 60 * 60 * 1000;

// Filipino short weekdays indexed by weekday number 0=Sunday .. 6=Saturday
const WEEKDAY_SHORT = ["Lin", "Lun", "Mar", "Miy", "Huw", "Biy", "Sab"] as const;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Weekday label for a Manila calendar date "yyyy-mm-dd" (timezone-safe weekday number). */
function weekdayLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return WEEKDAY_SHORT[new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1)).getUTCDay()];
}

// GET /api/summary → SummaryData (benta / gastos / utang / stock / shopping)
export async function GET() {
  try {
    // Seed sample data on first run (idempotent).
    await ensureSeeded();

    const now = new Date();
    const todayStart = manilaDayStart(now);
    const todayEnd = manilaDayEnd(now); // exclusive upper bound
    // Last 7 Manila days including today
    const weekStart = manilaDayStart(new Date(now.getTime() - 6 * DAY));
    const weekEnd = todayEnd;

    const [todaySales, todayExpenses, weekSaleRows, weekExpenseRows] = await Promise.all([
      db.sale.aggregate({
        _sum: { amount: true },
        where: { date: { gte: todayStart, lt: todayEnd } },
      }),
      db.expense.aggregate({
        _sum: { amount: true },
        where: { date: { gte: todayStart, lt: todayEnd } },
      }),
      db.sale.findMany({
        where: { date: { gte: weekStart, lt: weekEnd } },
        select: { amount: true, date: true },
      }),
      db.expense.findMany({
        where: { date: { gte: weekStart, lt: weekEnd } },
        select: { amount: true, date: true },
      }),
    ]);

    const todayBenta = round2(todaySales._sum.amount ?? 0);
    const todayGastos = round2(todayExpenses._sum.amount ?? 0);

    let weekBenta = 0;
    let weekGastos = 0;
    for (const r of weekSaleRows) weekBenta += r.amount;
    for (const r of weekExpenseRows) weekGastos += r.amount;

    // 7 daily buckets oldest → newest (i=0 is 6 days ago, i=6 is today)
    const buckets = Array.from({ length: 7 }, (_, i) => {
      const bucketStart = manilaDayStart(new Date(now.getTime() - (6 - i) * DAY));
      const dateStr = manilaDateStr(bucketStart);
      return { date: dateStr, label: weekdayLabel(dateStr), benta: 0, gastos: 0 };
    });
    for (const r of weekSaleRows) {
      const i = Math.min(6, Math.max(0, Math.floor((r.date.getTime() - weekStart.getTime()) / DAY)));
      buckets[i].benta += r.amount;
    }
    for (const r of weekExpenseRows) {
      const i = Math.min(6, Math.max(0, Math.floor((r.date.getTime() - weekStart.getTime()) / DAY)));
      buckets[i].gastos += r.amount;
    }
    const weekDaily = buckets.map((b) => ({
      date: b.date,
      label: b.label,
      benta: round2(b.benta),
      gastos: round2(b.gastos),
    }));

    // ── Utang: outstanding = all-time utang − all-time payments ────
    // due = customers with balance > 0 whose earliest dueDate is today or earlier
    const [typeSums, utangByCustomer, paymentsByCustomer, dueByCustomer] = await Promise.all([
      db.utangTransaction.groupBy({ by: ["type"], _sum: { amount: true } }),
      db.utangTransaction.groupBy({
        by: ["customerId"],
        where: { type: "utang" },
        _sum: { amount: true },
      }),
      db.utangTransaction.groupBy({
        by: ["customerId"],
        where: { type: "payment" },
        _sum: { amount: true },
      }),
      db.utangTransaction.groupBy({
        by: ["customerId"],
        where: { type: "utang", dueDate: { lte: todayEnd } },
        _sum: { amount: true },
      }),
    ]);

    const totalUtang = typeSums.find((t) => t.type === "utang")?._sum.amount ?? 0;
    const totalPayments = typeSums.find((t) => t.type === "payment")?._sum.amount ?? 0;
    const outstanding = round2(totalUtang - totalPayments);

    const paidMap = new Map(
      paymentsByCustomer.map((r) => [r.customerId, r._sum.amount ?? 0])
    );
    const withBalance = utangByCustomer
      .map((r) => ({
        id: r.customerId,
        balance: round2((r._sum.amount ?? 0) - (paidMap.get(r.customerId) ?? 0)),
      }))
      .filter((c) => c.balance > 0)
      .sort((a, b) => b.balance - a.balance);

    const dueSet = new Set(dueByCustomer.map((r) => r.customerId));
    const dueTotal = round2(
      withBalance.filter((c) => dueSet.has(c.id)).reduce((sum, c) => sum + c.balance, 0)
    );

    const top = withBalance.slice(0, 3);
    const topCustomers = top.length
      ? (await db.customer.findMany({ where: { id: { in: top.map((c) => c.id) } } }))
          .map((c) => ({
            id: c.id,
            name: c.name,
            balance: top.find((t) => t.id === c.id)?.balance ?? 0,
          }))
          .sort((a, b) => b.balance - a.balance)
      : [];

    // ── Stock: counts per status + total products ──────────────────
    // ── Shopping: pending items count + estimated total ────────────
    const [stockGroups, shoppingAgg] = await Promise.all([
      db.product.groupBy({ by: ["stockStatus"], _count: { _all: true } }),
      db.shoppingListItem.aggregate({
        where: { purchased: false },
        _count: { _all: true },
        _sum: { estTotal: true },
      }),
    ]);

    const stock = { marami: 0, sakto: 0, paubos: 0, ubos: 0, total: 0 };
    for (const g of stockGroups) {
      const count = g._count._all;
      if (g.stockStatus === "marami") stock.marami += count;
      else if (g.stockStatus === "sakto") stock.sakto += count;
      else if (g.stockStatus === "paubos") stock.paubos += count;
      else if (g.stockStatus === "ubos") stock.ubos += count;
      stock.total += count;
    }

    return NextResponse.json({
      today: {
        benta: todayBenta,
        gastos: todayGastos,
        net: round2(todayBenta - todayGastos),
      },
      week: {
        benta: round2(weekBenta),
        gastos: round2(weekGastos),
        net: round2(weekBenta - weekGastos),
      },
      weekDaily,
      utang: {
        outstanding,
        customerCount: withBalance.length,
        topCustomers,
        dueCount: withBalance.filter((c) => dueSet.has(c.id)).length,
        dueTotal,
      },
      stock,
      shopping: {
        pendingCount: shoppingAgg._count._all,
        pendingEstTotal: round2(shoppingAgg._sum.estTotal ?? 0),
      },
    });
  } catch (e) {
    console.error("[GET /api/summary]", e);
    return NextResponse.json({ error: "May problema sa server" }, { status: 500 });
  }
}
