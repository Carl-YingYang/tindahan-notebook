import { db, isoOrNull, strOrNull } from "@/db/client";
import { newId } from "@/logic/id";
import { roundMoney } from "@/logic/format";
import type { CustomerSummary, CustomerDetail, UtangTxn } from "@/types";
import { AppError, toIso } from "./helpers";
import { refreshAll } from "@/store/data";

interface CustomerAggRow {
  id: string;
  name: string;
  note: string | null;
  created_at: string;
  total_utang: number;
  total_paid: number;
  txn_count: number;
  last_activity: string | null;
  earliest_due: string | null;
}

export function serializeTxn(row: any): UtangTxn {
  return {
    id: String(row.id),
    customerId: String(row.customer_id),
    type: row.type === "payment" ? "payment" : "utang",
    amount: Number(row.amount) || 0,
    note: strOrNull(row.note),
    dueDate: isoOrNull(row.due_date),
    date: String(row.date),
    createdAt: String(row.created_at),
  };
}

function serializeSummary(row: CustomerAggRow, notes: string): CustomerSummary {
  const totalUtang = roundMoney(row.total_utang ?? 0);
  const totalPaid = roundMoney(row.total_paid ?? 0);
  const balance = roundMoney(totalUtang - totalPaid);
  return {
    id: row.id,
    name: row.name,
    note: strOrNull(row.note),
    notes,
    balance,
    totalUtang,
    totalPaid,
    txnCount: Number(row.txn_count) || 0,
    lastActivityAt: isoOrNull(row.last_activity),
    dueDate: balance > 0 ? isoOrNull(row.earliest_due) : null,
    createdAt: row.created_at,
  };
}

function summaryQuery(): CustomerSummary[] {
  const rows = db.getAllSync<CustomerAggRow>(`
    SELECT c.id, c.name, c.note, c.created_at,
      COALESCE(SUM(CASE WHEN t.type = 'utang' THEN t.amount END), 0) AS total_utang,
      COALESCE(SUM(CASE WHEN t.type = 'payment' THEN t.amount END), 0) AS total_paid,
      COUNT(t.id) AS txn_count,
      MAX(t.date) AS last_activity,
      MIN(CASE WHEN t.type = 'utang' AND t.due_date IS NOT NULL THEN t.due_date END) AS earliest_due
    FROM customers c
    LEFT JOIN utang_transactions t ON t.customer_id = c.id
    GROUP BY c.id
  `);

  const noteRows = db.getAllSync<{ customer_id: string; note: string }>(
    `SELECT customer_id, note FROM utang_transactions
     WHERE note IS NOT NULL AND TRIM(note) != ''
     ORDER BY date DESC, created_at DESC`
  );
  const notesByCustomer = new Map<string, string[]>();
  for (const r of noteRows) {
    const list = notesByCustomer.get(r.customer_id) ?? [];
    list.push(r.note.trim());
    notesByCustomer.set(r.customer_id, list);
  }

  return rows
    .map((r) => serializeSummary(r, (notesByCustomer.get(r.id) ?? []).join(" · ")))
    .sort((a, b) => {
      if (a.balance !== b.balance) return b.balance - a.balance;
      return a.name.localeCompare(b.name, "en", { sensitivity: "base" });
    });
}

export function listCustomerSummaries(): CustomerSummary[] {
  return summaryQuery();
}

export function getCustomerDetail(id: string): CustomerDetail | null {
  const all = summaryQuery();
  const customer = all.find((c) => c.id === id);
  if (!customer) return null;
  const transactions = db
    .getAllSync<any>(
      `SELECT * FROM utang_transactions WHERE customer_id = ? ORDER BY date DESC, created_at DESC`,
      [id]
    )
    .map(serializeTxn);
  return { customer, transactions, balance: customer.balance };
}

export function createCustomer(name: string, note?: string | null): CustomerSummary {
  const clean = name.trim();
  if (!clean) throw new AppError("Kailangan ang pangalan");
  const now = new Date().toISOString();
  const id = newId();
  db.runSync(
    `INSERT INTO customers (id, name, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
    [id, clean, note?.trim() || null, now, now]
  );
  refreshAll();
  const created = getCustomerRow(id);
  return serializeSummary(
    {
      ...created,
      total_utang: 0,
      total_paid: 0,
      txn_count: 0,
      last_activity: null,
      earliest_due: null,
    },
    ""
  );
}

function getCustomerRow(id: string): CustomerAggRow {
  const row = db.getFirstSync<CustomerAggRow>(
    `SELECT id, name, note, created_at,
      0 AS total_utang, 0 AS total_paid, 0 AS txn_count,
      NULL AS last_activity, NULL AS earliest_due
    FROM customers WHERE id = ?`,
    [id]
  );
  if (!row) throw new AppError("Hindi nahanap ang customer");
  return row;
}

export function updateCustomer(
  id: string,
  patch: { name?: string; note?: string | null }
): CustomerSummary {
  const existing = db.getFirstSync<{ id: string; name: string }>(
    `SELECT id, name FROM customers WHERE id = ?`,
    [id]
  );
  if (!existing) throw new AppError("Hindi nahanap ang customer");

  if (patch.name !== undefined) {
    const clean = patch.name.trim();
    if (!clean) throw new AppError("Kailangan ang pangalan");
    db.runSync(`UPDATE customers SET name = ?, updated_at = ? WHERE id = ?`, [
      clean,
      new Date().toISOString(),
      id,
    ]);
  }
  if (patch.note !== undefined) {
    const note = typeof patch.note === "string" && patch.note.trim() ? patch.note.trim().slice(0, 200) : null;
    db.runSync(`UPDATE customers SET note = ?, updated_at = ? WHERE id = ?`, [
      note,
      new Date().toISOString(),
      id,
    ]);
  }
  refreshAll();
  const refreshed = summaryQuery().find((c) => c.id === id);
  if (!refreshed) throw new AppError("Hindi nahanap ang customer");
  return refreshed;
}

export function deleteCustomer(id: string): void {
  db.runSync(`DELETE FROM customers WHERE id = ?`, [id]);
  refreshAll();
}

/** Exact name match first, then case-insensitive scan. */
export function findCustomerByName(name: string): { id: string; name: string } | null {
  const clean = name.trim();
  if (!clean) return null;
  const exact = db.getFirstSync<{ id: string; name: string }>(
    `SELECT id, name FROM customers WHERE name = ? LIMIT 1`,
    [clean]
  );
  if (exact) return exact;
  const all = db.getAllSync<{ id: string; name: string }>(`SELECT id, name FROM customers`);
  const lower = clean.toLowerCase();
  return all.find((c) => c.name.toLowerCase() === lower) ?? null;
}

/** Insert an utang or payment row directly (used by higher-level repos). */
export function insertTxn(input: {
  customerId: string;
  type: UtangTxn["type"];
  amount: number;
  note?: string | null;
  dueDate?: string | null;
  date?: unknown;
}): UtangTxn {
  const id = newId();
  const now = new Date().toISOString();
  const date = toIso(input.date);
  db.runSync(
    `INSERT INTO utang_transactions (id, customer_id, type, amount, note, due_date, date, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.customerId,
      input.type,
      roundMoney(input.amount),
      input.note?.trim() || null,
      input.dueDate ?? null,
      date,
      now,
    ]
  );
  return {
    id,
    customerId: input.customerId,
    type: input.type,
    amount: roundMoney(input.amount),
    note: input.note?.trim() || null,
    dueDate: input.dueDate ?? null,
    date,
    createdAt: now,
  };
}

export function customerBalance(customerId: string): number {
  const row = db.getFirstSync<{ total_utang: number; total_paid: number }>(
    `SELECT
      COALESCE(SUM(CASE WHEN type = 'utang' THEN amount END), 0) AS total_utang,
      COALESCE(SUM(CASE WHEN type = 'payment' THEN amount END), 0) AS total_paid
    FROM utang_transactions WHERE customer_id = ?`,
    [customerId]
  );
  return roundMoney((row?.total_utang ?? 0) - (row?.total_paid ?? 0));
}
