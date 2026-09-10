// ── /api/utang — record a new utang transaction (utang module, Task 1-a) ──

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { Customer } from "@prisma/client";
import {
  ERR_BAD_AMOUNT,
  ERR_CUSTOMER_NOT_FOUND,
  ERR_SERVER,
  findCustomerByName,
  jsonError,
  parseBodyDate,
  parseBodyDueDate,
  parseBodyNote,
  parsePositiveAmount,
  readJson,
  serializeTxn,
} from "../customers/summary";

export const dynamic = "force-dynamic";

// ── POST /api/utang {customerId?, customerName?, amount, note?, dueDate?, date?} ──
// → { transaction, customer: {id, name} }
// Resolves the customer: by id → else by exact case-insensitive name → else
// creates a new customer with that name. If the id is unresolvable but a name
// was also sent, fall back to the name (creates the customer) instead of 404 —
// protects against placeholder/stale ids from the client.
export async function POST(req: NextRequest) {
  try {
    const body = await readJson(req);

    const amount = parsePositiveAmount(body.amount);
    if (amount === null) return jsonError(ERR_BAD_AMOUNT, 400);

    let customer: Customer | null = null;
    const customerId = typeof body.customerId === "string" ? body.customerId.trim() : "";
    const customerName = typeof body.customerName === "string" ? body.customerName.trim() : "";

    if (customerId) {
      customer = await db.customer.findUnique({ where: { id: customerId } });
      if (!customer && !customerName) return jsonError(ERR_CUSTOMER_NOT_FOUND, 404);
    }
    if (!customer && customerName) {
      customer = await findCustomerByName(customerName);
      if (!customer) {
        customer = await db.customer.create({ data: { name: customerName } });
      }
    }
    if (!customer) {
      return jsonError("Kailangan ang pangalan ng customer", 400);
    }

    const transaction = await db.utangTransaction.create({
      data: {
        customerId: customer.id,
        type: "utang",
        amount,
        note: parseBodyNote(body.note),
        dueDate: parseBodyDueDate(body.dueDate),
        date: parseBodyDate(body.date),
      },
    });

    return NextResponse.json({
      transaction: serializeTxn(transaction),
      customer: { id: customer.id, name: customer.name },
    });
  } catch (err) {
    console.error("[POST /api/utang]", err);
    return jsonError(ERR_SERVER, 500);
  }
}
