import { db } from "@/db/client";
import { newId } from "@/logic/id";
import { roundMoney } from "@/logic/format";
import type { UtangTxn } from "@/types";
import { AppError, parsePositiveAmount, toIso, toIsoOrNull } from "./helpers";
import { refreshAll } from "@/store/data";
import {
  customerBalance,
  findCustomerByName,
  insertTxn,
  serializeTxn,
} from "./customers";

export interface AddUtangInput {
  customerId?: string | null;
  customerName?: string | null;
  amount: unknown;
  note?: string | null;
  dueDate?: unknown;
  date?: unknown;
}

/**
 * Mirrors POST /api/utang: resolve by id → name (case-insensitive, create
 * if new) → name fallback for stale ids. All error strings verbatim.
 */
export function addUtang(input: AddUtangInput): {
  transaction: UtangTxn;
  customer: { id: string; name: string };
} {
  const amount = parsePositiveAmount(input.amount);
  if (!amount) throw new AppError("Ilagay ang tamang halaga");

  let customer: { id: string; name: string } | null = null;
  const customerId = typeof input.customerId === "string" ? input.customerId : "";
  const customerName =
    typeof input.customerName === "string" ? input.customerName.trim() : "";

  if (customerId) {
    const row = db.getFirstSync<{ id: string; name: string }>(
      `SELECT id, name FROM customers WHERE id = ?`,
      [customerId]
    );
    if (row) customer = row;
    else if (!customerName) throw new AppError("Hindi nahanap ang customer");
  }
  if (!customer && customerName) {
    customer = findCustomerByName(customerName);
    if (!customer) {
      const newIdStr = createCustomerQuiet(customerName);
      customer = { id: newIdStr, name: customerName.trim() };
    }
  }
  if (!customer) throw new AppError("Kailangan ang pangalan ng customer");

  const transaction = insertTxn({
    customerId: customer.id,
    type: "utang",
    amount,
    note: input.note ?? null,
    dueDate: toIsoOrNull(input.dueDate),
    date: input.date,
  });
  refreshAll();
  return { transaction, customer };
}

function createCustomerQuiet(name: string): string {
  const clean = name.trim();
  const id = newId();
  const now = new Date().toISOString();
  db.runSync(
    `INSERT INTO customers (id, name, note, created_at, updated_at) VALUES (?, ?, NULL, ?, ?)`,
    [id, clean, now, now]
  );
  return id;
}

export interface PaymentInput {
  customerId: string;
  amount?: unknown;
  markPaid?: boolean;
  note?: string | null;
  date?: unknown;
}

/** Mirrors POST /api/payments — full/partial, clamping, Taglish errors. */
export function recordPayment(input: PaymentInput): {
  transaction: UtangTxn;
  customer: { id: string; name: string; balance: number };
} {
  if (!input.customerId) throw new AppError("Kailangan ang customer");
  const customer = db.getFirstSync<{ id: string; name: string }>(
    `SELECT id, name FROM customers WHERE id = ?`,
    [input.customerId]
  );
  if (!customer) throw new AppError("Hindi nahanap ang customer");

  const balance = customerBalance(customer.id);
  if (balance <= 0) throw new AppError(`Wala nang utang si ${customer.name}`);

  let amount: number;
  if (input.markPaid === true || input.amount === undefined || input.amount === null) {
    amount = balance;
  } else {
    const parsed = parsePositiveAmount(input.amount);
    if (!parsed) throw new AppError("Ilagay ang tamang halaga");
    amount = parsed;
    if (amount > balance + 0.001) {
      if (amount - balance <= 0.01) {
        amount = balance; // clamped
      } else {
        throw new AppError("Malaki sa natitirang utang");
      }
    }
  }
  amount = roundMoney(amount);

  const transaction = insertTxn({
    customerId: customer.id,
    type: "payment",
    amount,
    note: input.note ?? null,
    date: input.date,
  });
  refreshAll();
  return {
    transaction,
    customer: { id: customer.id, name: customer.name, balance: customerBalance(customer.id) },
  };
}

export function deleteUtangTxn(id: string): void {
  const exists = db.getFirstSync<{ id: string }>(
    `SELECT id FROM utang_transactions WHERE id = ?`,
    [id]
  );
  if (!exists) throw new AppError("Hindi nahanap ang transaction");
  db.runSync(`DELETE FROM utang_transactions WHERE id = ?`, [id]);
  refreshAll();
}

/** dueDate: ISO string or null to clear. Only for type="utang". */
export function setUtangDueDate(id: string, dueDate: string | null): UtangTxn {
  const row = db.getFirstSync<any>(`SELECT * FROM utang_transactions WHERE id = ?`, [id]);
  if (!row) throw new AppError("Hindi nahanap ang transaction");
  if (row.type !== "utang") throw new AppError("Ang due date ay para lang sa utang");
  const iso = toIsoOrNull(dueDate);
  db.runSync(`UPDATE utang_transactions SET due_date = ? WHERE id = ?`, [iso, id]);
  refreshAll();
  return serializeTxn({ ...row, due_date: iso });
}
