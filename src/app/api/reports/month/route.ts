// ── /api/reports/month — deterministic monthly "Talaan" (no AI) ───

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureSeeded } from "@/services/seed";

export const dynamic = "force-dynamic";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Manila midnight of the 1st of the month, and of the next month */
function monthRange(month: string): { start: Date; end: Date; label: string } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12) return null;
  const start = new Date(`${y}-${String(mo).padStart(2, "0")}-01T00:00:00+08:00`);
  const ny = mo === 12 ? y + 1 : y;
  const nm = mo === 12 ? 1 : mo + 1;
  const end = new Date(`${ny}-${String(nm).padStart(2, "0")}-01T00:00:00+08:00`);
  const MONTHS = ["Enero", "Pebrero", "Marso", "Abril", "Mayo", "Hunyo", "Hulyo", "Agosto", "Setyembre", "Oktubre", "Nobyembre", "Disyembre"];
  return { start, end, label: `${MONTHS[mo - 1]} ${y}` };
}

function manilaDateStr(d: Date): string {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" });
  return fmt.format(d);
}

const DAY_LABELS = ["Lin", "Lun", "Mar", "Miy", "Huw", "Biy", "Sab"];

// GET /api/reports/month?month=YYYY-MM
export async function GET(req: Request) {
  try {
    await ensureSeeded();
    const url = new URL(req.url);
    const monthParam = url.searchParams.get("month");
    const now = new Date();
    const defaultMonth = manilaDateStr(now).slice(0, 7);
    const month = monthParam ?? defaultMonth;
    const range = monthRange(month);
    if (!range) {
      return NextResponse.json({ error: "Hindi valid ang buwan (format: YYYY-MM)" }, { status: 400 });
    }

    const [sales, expenses] = await Promise.all([
      db.sale.findMany({ where: { date: { gte: range.start, lt: range.end } }, orderBy: { date: "asc" } }),
      db.expense.findMany({ where: { date: { gte: range.start, lt: range.end } }, orderBy: { date: "asc" } }),
    ]);

    const benta = round2(sales.reduce((s, x) => s + x.amount, 0));
    const gastos = round2(expenses.reduce((s, x) => s + x.amount, 0));

    // Daily buckets across the month (Manila calendar days)
    const days: { date: string; label: string; day: number; benta: number; gastos: number; net: number }[] = [];
    const byDay = new Map<string, { benta: number; gastos: number }>();
    const bucketOf = (d: Date) => {
      const key = manilaDateStr(d);
      if (!byDay.has(key)) byDay.set(key, { benta: 0, gastos: 0 });
      return byDay.get(key)!;
    };
    for (const s of sales) bucketOf(s.date).benta += s.amount;
    for (const e of expenses) bucketOf(e.date).gastos += e.amount;

    const cursor = new Date(range.start);
    while (cursor < range.end) {
      const key = manilaDateStr(cursor);
      const b = byDay.get(key) ?? { benta: 0, gastos: 0 };
      days.push({
        date: key,
        label: DAY_LABELS[cursor.getDay()],
        day: Number(key.slice(8)),
        benta: round2(b.benta),
        gastos: round2(b.gastos),
        net: round2(b.benta - b.gastos),
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    // Gastos by category
    const gastosByCategoryMap = new Map<string, number>();
    for (const e of expenses) gastosByCategoryMap.set(e.category, (gastosByCategoryMap.get(e.category) ?? 0) + e.amount);
    const gastosByCategory = [...gastosByCategoryMap.entries()]
      .map(([category, amount]) => ({ category, amount: round2(amount) }))
      .sort((a, b) => b.amount - a.amount);

    // Benta by category (optional field on sales)
    const bentaByCategoryMap = new Map<string, number>();
    for (const s of sales) bentaByCategoryMap.set(s.category ?? "Tindahan", (bentaByCategoryMap.get(s.category ?? "Tindahan") ?? 0) + s.amount);
    const bentaByCategory = [...bentaByCategoryMap.entries()]
      .map(([category, amount]) => ({ category, amount: round2(amount) }))
      .sort((a, b) => b.amount - a.amount);

    const bestDay = days.reduce<{ date: string; benta: number } | null>(
      (best, d) => (d.benta > 0 && (!best || d.benta > best.benta) ? { date: d.date, benta: d.benta } : best),
      null
    );

    const activeDays = days.filter((d) => d.benta > 0 || d.gastos > 0);
    const avgDailyNet = activeDays.length > 0 ? round2((benta - gastos) / Math.max(activeDays.length, 1)) : 0;

    const topExpenses = expenses
      .slice()
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3)
      .map((e) => ({ id: e.id, amount: e.amount, category: e.category, note: e.note, date: e.date.toISOString() }));

    const transactions = [
      ...sales.map((s) => ({ id: s.id, type: "benta" as const, amount: s.amount, category: s.category ?? "Tindahan", note: s.note, date: s.date.toISOString() })),
      ...expenses.map((e) => ({ id: e.id, type: "gastos" as const, amount: e.amount, category: e.category, note: e.note, date: e.date.toISOString() })),
    ].sort((a, b) => (a.date < b.date ? 1 : -1));

    return NextResponse.json({
      month,
      label: range.label,
      benta,
      gastos,
      net: round2(benta - gastos),
      salesCount: sales.length,
      expensesCount: expenses.length,
      activeDays: activeDays.length,
      daysInMonth: days.length,
      avgDailyNet,
      bestDay,
      gastosByCategory,
      bentaByCategory,
      daily: days,
      topExpenses,
      transactions,
    });
  } catch (e) {
    console.error("[GET /api/reports/month]", e);
    return NextResponse.json({ error: "May problema sa server" }, { status: 500 });
  }
}
