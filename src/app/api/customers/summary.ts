// ── Shared helpers for the utang module API routes ───────────────
// Colocated under src/app/api/customers/ (owned by Task 1-a) so the
// customers / utang / payments routes serialize money + dates identically.
// NOTE: this file is NOT a route (only route.ts files are).

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import type { Customer, UtangTransaction } from "@prisma/client";
import type { CustomerSummary, UtangTxn } from "@/types";

// ── Contract error messages ──────────────────────────────────────

export const ERR_SERVER = "May problema sa server";
export const ERR_NO_NAME = "Kailangan ang pangalan";
export const ERR_CUSTOMER_NOT_FOUND = "Hindi nahanap ang customer";
export const ERR_BAD_AMOUNT = "Ilagay ang tamang halaga";

export function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

// ── Money / date helpers ─────────────────────────────────────────

/** Round to centavos so float drift (0.1 + 0.2 problem) never leaks to the UI. */
export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Body `date` (ISO string) → Date; missing/invalid → now. */
export function parseBodyDate(value: unknown): Date {
  if (typeof value === "string" && value.trim() !== "") {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

/** Body `note` → trimmed string, or null when empty/missing. */
export function parseBodyNote(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

/** Body `dueDate` (ISO string) → Date; null/missing/invalid → null. */
export function parseBodyDueDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Body `amount` → finite positive number (accepts numeric strings), else null. */
export function parsePositiveAmount(value: unknown): number | null {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : null;
}

/** Safely read a JSON body; invalid/absent JSON → {}. */
export async function readJson(req: NextRequest): Promise<Record<string, unknown>> {
  try {
    const data: unknown = await req.json();
    return data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

// ── Serialization ────────────────────────────────────────────────

export function serializeTxn(txn: UtangTransaction): UtangTxn {
  return {
    id: txn.id,
    customerId: txn.customerId,
    type: txn.type === "payment" ? "payment" : "utang",
    amount: txn.amount,
    note: txn.note,
    dueDate: txn.dueDate ? txn.dueDate.toISOString() : null,
    date: txn.date.toISOString(),
    createdAt: txn.createdAt.toISOString(),
  };
}

export interface TxnStats {
  balance: number;
  totalUtang: number;
  totalPaid: number;
  txnCount: number;
  lastActivityAt: Date | null;
  /** Earliest non-null dueDate among the customer's utang-type txns */
  earliestDueDate?: Date | null;
  /** All non-empty txn notes joined with " · " — powers note search in the Utang list */
  notes?: string;
}

/** Reduce a customer's txns into balance / totals / count / last activity / note blob. */
export function computeStats(
  txns: Pick<UtangTransaction, "type" | "amount" | "date" | "dueDate" | "note">[]
): TxnStats {
  let totalUtang = 0;
  let totalPaid = 0;
  let last: Date | null = null;
  let earliestDue: Date | null = null;
  const notes: string[] = [];
  for (const t of txns) {
    if (t.type === "payment") totalPaid += t.amount;
    else {
      totalUtang += t.amount;
      if (t.dueDate && (!earliestDue || t.dueDate.getTime() < earliestDue.getTime())) {
        earliestDue = t.dueDate;
      }
    }
    if (t.note && t.note.trim()) notes.push(t.note.trim());
    if (!last || t.date.getTime() > last.getTime()) last = t.date;
  }
  return {
    balance: roundMoney(totalUtang - totalPaid),
    totalUtang: roundMoney(totalUtang),
    totalPaid: roundMoney(totalPaid),
    txnCount: txns.length,
    lastActivityAt: last,
    earliestDueDate: earliestDue,
    notes: notes.join(" · "),
  };
}

export function summarizeCustomer(
  customer: Customer,
  stats: TxnStats
): CustomerSummary {
  return {
    id: customer.id,
    name: customer.name,
    note: customer.note,
    notes: stats.notes,
    balance: stats.balance,
    totalUtang: stats.totalUtang,
    totalPaid: stats.totalPaid,
    txnCount: stats.txnCount,
    lastActivityAt: stats.lastActivityAt ? stats.lastActivityAt.toISOString() : null,
    dueDate: stats.earliestDueDate ? stats.earliestDueDate.toISOString() : null,
    createdAt: customer.createdAt.toISOString(),
  };
}

// ── Customer lookup ──────────────────────────────────────────────

/** Exact-name lookup, case-insensitive. (Prisma SQLite has no `mode: "insensitive"`,
 *  so: indexed exact match first, then a small in-memory scan — suki lists are tiny.) */
export async function findCustomerByName(name: string): Promise<Customer | null> {
  const trimmed = name.trim();
  const exact = await db.customer.findFirst({ where: { name: trimmed } });
  if (exact) return exact;
  const lowered = trimmed.toLowerCase();
  const all = await db.customer.findMany();
  return all.find((c) => c.name.trim().toLowerCase() === lowered) ?? null;
}
