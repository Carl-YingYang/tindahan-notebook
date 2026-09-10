// ── /api/customers/[id] — detail / update / delete (utang module, Task 1-a) ──

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  ERR_CUSTOMER_NOT_FOUND,
  ERR_NO_NAME,
  ERR_SERVER,
  computeStats,
  jsonError,
  parseBodyNote,
  readJson,
  serializeTxn,
  summarizeCustomer,
} from "../summary";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

// ── GET /api/customers/[id] → CustomerDetail ─────────────────────
export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const customer = await db.customer.findUnique({ where: { id } });
    if (!customer) return jsonError(ERR_CUSTOMER_NOT_FOUND, 404);

    const transactions = await db.utangTransaction.findMany({
      where: { customerId: id },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    });

    const stats = computeStats(transactions);
    return NextResponse.json({
      customer: summarizeCustomer(customer, stats),
      transactions: transactions.map(serializeTxn),
      balance: stats.balance,
    });
  } catch (err) {
    console.error("[GET /api/customers/[id]]", err);
    return jsonError(ERR_SERVER, 500);
  }
}

// ── PATCH /api/customers/[id] {name?, note?} → CustomerSummary ───
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const existing = await db.customer.findUnique({ where: { id } });
    if (!existing) return jsonError(ERR_CUSTOMER_NOT_FOUND, 404);

    const body = await readJson(req);
    const data: { name?: string; note?: string | null } = {};

    if (body.name !== undefined) {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name) return jsonError(ERR_NO_NAME, 400);
      data.name = name;
    }
    if (body.note !== undefined) {
      data.note = parseBodyNote(body.note);
    }

    const customer = await db.customer.update({ where: { id }, data });
    const transactions = await db.utangTransaction.findMany({
      where: { customerId: id },
    });
    return NextResponse.json(summarizeCustomer(customer, computeStats(transactions)));
  } catch (err) {
    console.error("[PATCH /api/customers/[id]]", err);
    return jsonError(ERR_SERVER, 500);
  }
}

// ── DELETE /api/customers/[id] → {ok:true} (txns cascade) ────────
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const existing = await db.customer.findUnique({ where: { id } });
    if (!existing) return jsonError(ERR_CUSTOMER_NOT_FOUND, 404);

    await db.customer.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/customers/[id]]", err);
    return jsonError(ERR_SERVER, 500);
  }
}
