// ── /api/payments — record a bayad for a customer (utang module, Task 1-a) ──

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  ERR_BAD_AMOUNT,
  ERR_CUSTOMER_NOT_FOUND,
  ERR_SERVER,
  computeStats,
  jsonError,
  parseBodyDate,
  parseBodyNote,
  parsePositiveAmount,
  readJson,
  roundMoney,
  serializeTxn,
} from "../customers/summary";

export const dynamic = "force-dynamic";

// ── POST /api/payments {customerId, amount?, markPaid?, note?, date?} ──
// → { transaction, customer: {id, name, balance} }
export async function POST(req: NextRequest) {
  try {
    const body = await readJson(req);

    const customerId = typeof body.customerId === "string" ? body.customerId.trim() : "";
    if (!customerId) return jsonError("Kailangan ang customer", 400);

    const customer = await db.customer.findUnique({ where: { id: customerId } });
    if (!customer) return jsonError(ERR_CUSTOMER_NOT_FOUND, 404);

    // Compute the current balance first.
    const txns = await db.utangTransaction.findMany({ where: { customerId } });
    const balance = computeStats(txns).balance;
    if (balance <= 0) {
      return jsonError(`Wala nang utang si ${customer.name}`, 400);
    }

    // Determine the payment amount:
    //  - markPaid or no amount → pay the full remaining balance
    //  - else validate 0 < amount <= balance + 0.001
    //    (tolerate ≤ 0.01 over by clamping to balance; beyond that → 400)
    const markPaid = body.markPaid === true;
    let payAmount: number;
    if (markPaid || body.amount === undefined || body.amount === null) {
      payAmount = balance;
    } else {
      const amount = parsePositiveAmount(body.amount);
      if (amount === null) return jsonError(ERR_BAD_AMOUNT, 400);
      if (amount > balance + 0.001) {
        if (amount <= balance + 0.01) {
          payAmount = balance;
        } else {
          return jsonError("Malaki sa natitirang utang", 400);
        }
      } else {
        payAmount = Math.min(amount, balance);
      }
    }

    const transaction = await db.utangTransaction.create({
      data: {
        customerId,
        type: "payment",
        amount: roundMoney(payAmount),
        note: parseBodyNote(body.note),
        date: parseBodyDate(body.date),
      },
    });

    const newBalance = roundMoney(balance - payAmount);
    return NextResponse.json({
      transaction: serializeTxn(transaction),
      customer: { id: customer.id, name: customer.name, balance: newBalance },
    });
  } catch (err) {
    console.error("[POST /api/payments]", err);
    return jsonError(ERR_SERVER, 500);
  }
}
