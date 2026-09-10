// ── /api/customers — list + create customers (utang module, Task 1-a) ──

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  ERR_NO_NAME,
  ERR_SERVER,
  computeStats,
  jsonError,
  parseBodyNote,
  readJson,
  roundMoney,
  summarizeCustomer,
} from "./summary";

export const dynamic = "force-dynamic";

// ── GET /api/customers → CustomerSummary[] ───────────────────────
// balance = utang sum − payment sum; sorted balance desc, then name asc.
// dueDate = earliest non-null dueDate among a customer's utang records,
// surfaced only when the customer still has an outstanding balance.
export async function GET() {
  try {
    const [customers, groups, notedTxns] = await Promise.all([
      db.customer.findMany(),
      db.utangTransaction.groupBy({
        by: ["customerId", "type"],
        _sum: { amount: true },
        _count: { _all: true },
        _max: { date: true },
        _min: { dueDate: true },
      }),
      // Only txns with a note — powers the "Hanapin ang suki o tala" search.
      db.utangTransaction.findMany({
        where: { note: { not: null } },
        select: { customerId: true, note: true },
        orderBy: { date: "desc" },
      }),
    ]);

    // Per-customer blob of txn notes (newest first), joined with " · ".
    const notesById = new Map<string, string>();
    for (const t of notedTxns) {
      const n = t.note?.trim();
      if (!n) continue;
      const prev = notesById.get(t.customerId);
      notesById.set(t.customerId, prev ? `${prev} · ${n}` : n);
    }

    // Fold the (customerId × type) aggregates into per-customer stats.
    const statsById = new Map<
      string,
      { utang: number; paid: number; count: number; last: Date | null; minDue: Date | null }
    >();
    for (const g of groups) {
      const entry =
        statsById.get(g.customerId) ?? { utang: 0, paid: 0, count: 0, last: null, minDue: null };
      const sum = g._sum.amount ?? 0;
      if (g.type === "payment") entry.paid += sum;
      else {
        entry.utang += sum;
        if (g._min.dueDate && (!entry.minDue || g._min.dueDate < entry.minDue)) {
          entry.minDue = g._min.dueDate;
        }
      }
      entry.count += g._count._all;
      if (g._max.date && (!entry.last || g._max.date > entry.last)) entry.last = g._max.date;
      statsById.set(g.customerId, entry);
    }

    const summaries = customers.map((c) => {
      const s = statsById.get(c.id);
      const txnNotes = notesById.get(c.id) ?? "";
      if (!s) {
        return summarizeCustomer(c, {
          balance: 0,
          totalUtang: 0,
          totalPaid: 0,
          txnCount: 0,
          lastActivityAt: null,
          earliestDueDate: null,
          notes: txnNotes,
        });
      }
      const balance = roundMoney(s.utang - s.paid);
      return summarizeCustomer(c, {
        balance,
        totalUtang: roundMoney(s.utang),
        totalPaid: roundMoney(s.paid),
        txnCount: s.count,
        lastActivityAt: s.last,
        earliestDueDate: balance > 0 ? s.minDue : null,
        notes: txnNotes,
      });
    });

    summaries.sort((a, b) => b.balance - a.balance || a.name.localeCompare(b.name));
    return NextResponse.json(summaries);
  } catch (err) {
    console.error("[GET /api/customers]", err);
    return jsonError(ERR_SERVER, 500);
  }
}

// ── POST /api/customers {name, note?} → CustomerSummary ──────────
export async function POST(req: NextRequest) {
  try {
    const body = await readJson(req);
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return jsonError(ERR_NO_NAME, 400);

    const customer = await db.customer.create({
      data: { name, note: parseBodyNote(body.note) },
    });

    return NextResponse.json(
      summarizeCustomer(customer, {
        balance: 0,
        totalUtang: 0,
        totalPaid: 0,
        txnCount: 0,
        lastActivityAt: null,
      })
    );
  } catch (err) {
    console.error("[POST /api/customers]", err);
    return jsonError(ERR_SERVER, 500);
  }
}
