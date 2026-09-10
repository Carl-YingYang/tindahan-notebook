import { db } from "@/db/client";
import { newId } from "@/logic/id";
import {
  manilaDateStr,
  manilaDayEnd,
  manilaDayStart,
  manilaMonthStr,
  roundMoney,
  WEEKDAYS_SHORT,
  MONTHS_FULL,
} from "@/logic/format";
import type { DayDetail, Expense, MonthReport, Sale, SummaryData } from "@/types";
import { AppError, parsePositiveAmount, toIso, trimmedOrNull } from "./helpers";
import { refreshAll } from "@/store/data";
import { listCustomerSummaries } from "./customers";

/* ---------- serialization ---------- */

function serializeRecord(row: any): Sale {
  return {
    id: String(row.id),
    amount: Number(row.amount) || 0,
    category: row.category ?? null,
    note: row.note ?? null,
    date: String(row.date),
    createdAt: String(row.created_at),
  };
}

/* ---------- sales ---------- */

export function listSales(limit = 60): Sale[] {
  return db
    .getAllSync<any>(
      `SELECT * FROM sales ORDER BY date DESC, created_at DESC LIMIT ?`,
      [Math.min(Math.max(1, limit), 500)]
    )
    .map(serializeRecord);
}

export function addSale(input: {
  amount: unknown;
  category?: unknown;
  note?: unknown;
  date?: unknown;
}): Sale {
  const amount = parsePositiveAmount(input.amount);
  if (!amount) throw new AppError("Ilagay ang tamang halaga");
  const id = newId();
  const now = new Date().toISOString();
  db.runSync(
    `INSERT INTO sales (id, amount, category, note, date, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    [id, amount, trimmedOrNull(input.category, 60), trimmedOrNull(input.note, 200), toIso(input.date), now]
  );
  refreshAll();
  return serializeRecord({ id, amount, category: trimmedOrNull(input.category, 60), note: trimmedOrNull(input.note, 200), date: toIso(input.date), created_at: now });
}

export function deleteSale(id: string): void {
  const exists = db.getFirstSync(`SELECT id FROM sales WHERE id = ?`, [id]);
  if (!exists) throw new AppError("Hindi nahanap");
  db.runSync(`DELETE FROM sales WHERE id = ?`, [id]);
  refreshAll();
}

/* ---------- expenses ---------- */

export function listExpenses(limit = 60): Expense[] {
  return db
    .getAllSync<any>(
      `SELECT * FROM expenses ORDER BY date DESC, created_at DESC LIMIT ?`,
      [Math.min(Math.max(1, limit), 500)]
    )
    .map(serializeRecord);
}

export function addExpense(input: {
  amount: unknown;
  category?: unknown;
  note?: unknown;
  date?: unknown;
}): Expense {
  const amount = parsePositiveAmount(input.amount);
  if (!amount) throw new AppError("Ilagay ang tamang halaga");
  const category = trimmedOrNull(input.category, 60) ?? "Iba pa";
  const id = newId();
  const now = new Date().toISOString();
  const date = toIso(input.date);
  db.runSync(
    `INSERT INTO expenses (id, amount, category, note, date, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    [id, amount, category, trimmedOrNull(input.note, 200), date, now]
  );
  refreshAll();
  return serializeRecord({ id, amount, category, note: trimmedOrNull(input.note, 200), date, created_at: now });
}

export function deleteExpense(id: string): void {
  const exists = db.getFirstSync(`SELECT id FROM expenses WHERE id = ?`, [id]);
  if (!exists) throw new AppError("Hindi nahanap");
  db.runSync(`DELETE FROM expenses WHERE id = ?`, [id]);
  refreshAll();
}

/* ---------- day detail (noon-UTC anchor, Manila-safe) ---------- */

export function getDay(dateStr: string): DayDetail {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new AppError("Invalid na petsa (kailangan YYYY-MM-DD)");
  }
  const [y, m, d] = dateStr.split("-").map(Number);
  const anchor = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1, 12)); // 20:00 Manila same calendar day
  const start = manilaDayStart(anchor);
  const end = manilaDayEnd(anchor);

  const sales = db
    .getAllSync<any>(
      `SELECT * FROM sales WHERE date >= ? AND date < ? ORDER BY date DESC`,
      [start.toISOString(), end.toISOString()]
    )
    .map(serializeRecord);
  const expenses = db
    .getAllSync<any>(
      `SELECT * FROM expenses WHERE date >= ? AND date < ? ORDER BY date DESC`,
      [start.toISOString(), end.toISOString()]
    )
    .map(serializeRecord);

  const benta = roundMoney(sales.reduce((s, r) => s + r.amount, 0));
  const gastos = roundMoney(expenses.reduce((s, r) => s + r.amount, 0));
  return { date: dateStr, sales, expenses, totals: { benta, gastos, net: roundMoney(benta - gastos) } };
}

/* ---------- summary (home dashboard) ---------- */

function rangeTotals(table: "sales" | "expenses", start: Date, end: Date): number {
  const row = db.getFirstSync<{ total: number }>(
    `SELECT COALESCE(SUM(amount), 0) AS total FROM ${table} WHERE date >= ? AND date < ?`,
    [start.toISOString(), end.toISOString()]
  );
  return roundMoney(row?.total ?? 0);
}

export function getSummary(): SummaryData {
  const now = new Date();
  const todayStart = manilaDayStart(now);
  const todayEnd = manilaDayEnd(now);

  const bentaToday = rangeTotals("sales", todayStart, todayEnd);
  const gastosToday = rangeTotals("expenses", todayStart, todayEnd);

  // last 7 Manila days incl. today, oldest → newest
  const weekDaily: SummaryData["weekDaily"] = [];
  for (let i = 6; i >= 0; i--) {
    const dayStart = new Date(todayStart.getTime() - i * 86400000);
    const dayEnd = new Date(dayStart.getTime() + 86400000);
    const b = rangeTotals("sales", dayStart, dayEnd);
    const g = rangeTotals("expenses", dayStart, dayEnd);
    const { y, m, day } = (() => {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Manila",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(dayStart);
      const [yy, mm, dd] = parts.split("-");
      return { y: yy, m: mm, day: dd };
    })();
    const weekday = new Date(Date.UTC(Number(y), Number(m) - 1, Number(day))).getUTCDay();
    weekDaily.push({
      date: `${y}-${m}-${day}`,
      label: WEEKDAYS_SHORT[weekday],
      benta: b,
      gastos: g,
    });
  }

  const weekBenta = roundMoney(weekDaily.reduce((s, d) => s + d.benta, 0));
  const weekGastos = roundMoney(weekDaily.reduce((s, d) => s + d.gastos, 0));

  // utang
  const customers = listCustomerSummaries();
  const withBalance = customers.filter((c) => c.balance > 0);
  const outstanding = roundMoney(withBalance.reduce((s, c) => s + c.balance, 0));
  const topCustomers = withBalance
    .slice()
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 3)
    .map((c) => ({ id: c.id, name: c.name, balance: c.balance }));
  const due = withBalance.filter(
    (c) => c.dueDate && new Date(c.dueDate).getTime() < todayEnd.getTime()
  );
  const dueTotal = roundMoney(due.reduce((s, c) => s + c.balance, 0));

  // stock
  const stockRows = db.getAllSync<{ stock_status: string; n: number }>(
    `SELECT stock_status, COUNT(*) AS n FROM products GROUP BY stock_status`
  );
  const stockMap = new Map(stockRows.map((r) => [r.stock_status, Number(r.n)]));
  const stock = {
    marami: stockMap.get("marami") ?? 0,
    sakto: stockMap.get("sakto") ?? 0,
    paubos: stockMap.get("paubos") ?? 0,
    ubos: stockMap.get("ubos") ?? 0,
    total: stockRows.reduce((s, r) => s + Number(r.n), 0),
  };

  // shopping list
  const shopRow = db.getFirstSync<{ n: number; total: number }>(
    `SELECT COUNT(*) AS n, COALESCE(SUM(est_total), 0) AS total FROM shopping_list_items WHERE purchased = 0`
  );

  return {
    today: { benta: bentaToday, gastos: gastosToday, net: roundMoney(bentaToday - gastosToday) },
    week: { benta: weekBenta, gastos: weekGastos, net: roundMoney(weekBenta - weekGastos) },
    weekDaily,
    utang: {
      outstanding,
      customerCount: withBalance.length,
      topCustomers,
      dueCount: due.length,
      dueTotal,
    },
    stock,
    shopping: { pendingCount: Number(shopRow?.n ?? 0), pendingEstTotal: roundMoney(shopRow?.total ?? 0) },
  };
}

/* ---------- monthly report (Talaan) ---------- */

export function getMonthReport(monthStr?: string): MonthReport {
  const month = monthStr && /^\d{4}-\d{2}$/.test(monthStr) ? monthStr : manilaMonthStr();
  const [ys, ms] = month.split("-").map(Number);
  const start = new Date(`${ys}-${String(ms).padStart(2, "0")}-01T00:00:00+08:00`);
  const nextMonth = ms === 12 ? `${ys + 1}-01-01T00:00:00+08:00` : `${ys}-${String(ms + 1).padStart(2, "0")}-01T00:00:00+08:00`;
  const end = new Date(nextMonth);
  const daysInMonth = Math.round((end.getTime() - start.getTime()) / 86400000);

  const sales = db
    .getAllSync<any>(`SELECT * FROM sales WHERE date >= ? AND date < ?`, [
      start.toISOString(),
      end.toISOString(),
    ])
    .map(serializeRecord);
  const expenses = db
    .getAllSync<any>(`SELECT * FROM expenses WHERE date >= ? AND date < ?`, [
      start.toISOString(),
      end.toISOString(),
    ])
    .map(serializeRecord);

  const benta = roundMoney(sales.reduce((s, r) => s + r.amount, 0));
  const gastos = roundMoney(expenses.reduce((s, r) => s + r.amount, 0));
  const net = roundMoney(benta - gastos);

  // daily buckets keyed by Manila date
  const bucketMap = new Map<string, { benta: number; gastos: number }>();
  const bucketOf = (iso: string) => {
    const key = manilaDateStr(new Date(iso));
    let b = bucketMap.get(key);
    if (!b) {
      b = { benta: 0, gastos: 0 };
      bucketMap.set(key, b);
    }
    return b;
  };
  for (const s of sales) bucketOf(s.date).benta += s.amount;
  for (const e of expenses) bucketOf(e.date).gastos += e.amount;

  const daily: MonthReport["daily"] = [];
  let activeDays = 0;
  let bestDay: { date: string; benta: number } | null = null;
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${month}-${String(d).padStart(2, "0")}`;
    const b = bucketMap.get(date);
    const bentaD = roundMoney(b?.benta ?? 0);
    const gastosD = roundMoney(b?.gastos ?? 0);
    if (bentaD > 0 || gastosD > 0) activeDays++;
    if (bentaD > 0 && (!bestDay || bentaD > bestDay.benta)) bestDay = { date, benta: bentaD };
    const weekday = new Date(Date.UTC(ys, ms - 1, d)).getUTCDay();
    daily.push({
      date,
      label: WEEKDAYS_SHORT[weekday],
      day: d,
      benta: bentaD,
      gastos: gastosD,
      net: roundMoney(bentaD - gastosD),
    });
  }

  const groupBy = (rows: Sale[], fallback: string | null) => {
    const map = new Map<string, number>();
    for (const r of rows) {
      const key = r.category ?? fallback;
      if (key === null) continue;
      map.set(key, (map.get(key) ?? 0) + r.amount);
    }
    return Array.from(map.entries())
      .map(([category, total]) => ({ category, total: roundMoney(total) }))
      .sort((a, b) => b.total - a.total);
  };

  const transactions = [
    ...sales.map((s) => ({ kind: "benta" as const, ...s })),
    ...expenses.map((e) => ({ kind: "gastos" as const, ...e })),
  ].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  return {
    month,
    label: `${MONTHS_FULL[ms - 1]} ${ys}`,
    benta,
    gastos,
    net,
    salesCount: sales.length,
    expensesCount: expenses.length,
    activeDays,
    daysInMonth,
    avgDailyNet: activeDays > 0 ? roundMoney(net / activeDays) : 0,
    bestDay,
    gastosByCategory: groupBy(expenses, null),
    bentaByCategory: groupBy(sales, "Tindahan"),
    daily,
    topExpenses: expenses.slice().sort((a, b) => b.amount - a.amount).slice(0, 3),
    transactions,
  };
}
