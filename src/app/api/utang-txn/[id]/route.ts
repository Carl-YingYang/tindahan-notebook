// ── /api/utang-txn/[id] — delete a single utang/payment entry, or edit its ──
// due date ("Kailan bayad?") on utang records (Task 1-a).

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ERR_SERVER, jsonError } from "../../customers/summary";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

// ── DELETE /api/utang-txn/[id] → {ok:true} ───────────────────────
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const txn = await db.utangTransaction.findUnique({ where: { id } });
    if (!txn) return jsonError("Hindi nahanap ang transaction", 404);

    await db.utangTransaction.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/utang-txn/[id]]", err);
    return jsonError(ERR_SERVER, 500);
  }
}

// ── PATCH /api/utang-txn/[id] { dueDate: string | null } ─────────
// Only meaningful for type="utang". An ISO string sets/updates the due date;
// null clears it. Returns the serialized transaction (dueDate as ISO or null).
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const txn = await db.utangTransaction.findUnique({ where: { id } });
    if (!txn) return jsonError("Hindi nahanap ang transaction", 404);
    if (txn.type !== "utang") {
      return jsonError("Ang due date ay para lang sa utang", 400);
    }

    const body = (await req.json().catch(() => null)) as { dueDate?: string | null } | null;
    if (!body || !("dueDate" in body)) {
      return jsonError("Ilagay ang due date", 400);
    }

    let dueDate: Date | null = null;
    if (body.dueDate !== null && body.dueDate !== "") {
      const d = new Date(String(body.dueDate));
      if (Number.isNaN(d.getTime())) return jsonError("Hindi valid ang due date", 400);
      dueDate = d;
    }

    const updated = await db.utangTransaction.update({
      where: { id },
      data: { dueDate },
    });

    return NextResponse.json({
      ok: true,
      transaction: {
        id: updated.id,
        customerId: updated.customerId,
        type: updated.type,
        amount: updated.amount,
        note: updated.note,
        dueDate: updated.dueDate ? updated.dueDate.toISOString() : null,
        date: updated.date.toISOString(),
        createdAt: updated.createdAt.toISOString(),
      },
    });
  } catch (err) {
    console.error("[PATCH /api/utang-txn/[id]]", err);
    return jsonError(ERR_SERVER, 500);
  }
}
