// ── /api/shopping-list/[id] — update / remove an item (Task 1-c) ─

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { ShoppingSource } from "@/types";

export const dynamic = "force-dynamic";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

type ShoppingRow = {
  id: string;
  productId: string | null;
  name: string;
  qty: number | null;
  estUnitCost: number | null;
  estTotal: number;
  purchased: boolean;
  source: string;
  createdAt: Date;
};

function toShoppingDTO(i: ShoppingRow) {
  return {
    id: i.id,
    productId: i.productId,
    name: i.name,
    qty: i.qty,
    estUnitCost: i.estUnitCost,
    estTotal: i.estTotal,
    purchased: i.purchased,
    source: i.source as ShoppingSource,
    createdAt: i.createdAt.toISOString(),
  };
}

// PATCH /api/shopping-list/[id] — any of {purchased, qty, estUnitCost, name}
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body: any = await req.json().catch(() => ({}));

    const item = await db.shoppingListItem.findUnique({ where: { id } });
    if (!item) {
      return NextResponse.json({ error: "Hindi nahanap ang item" }, { status: 404 });
    }

    const data: {
      name?: string;
      qty?: number | null;
      estUnitCost?: number | null;
      estTotal?: number;
      purchased?: boolean;
      purchasedAt?: Date | null;
    } = {};
    let recompute = false;

    if (body?.name !== undefined) {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name) {
        return NextResponse.json({ error: "Kailangan ang pangalan ng item" }, { status: 400 });
      }
      data.name = name;
    }

    if (body?.qty !== undefined) {
      const n = Number(body.qty);
      if (!Number.isFinite(n) || n < 0) {
        return NextResponse.json({ error: "Hindi valid ang qty" }, { status: 400 });
      }
      data.qty = n;
      recompute = true;
    }

    if (body?.estUnitCost !== undefined) {
      const n = Number(body.estUnitCost);
      if (!Number.isFinite(n) || n < 0) {
        return NextResponse.json({ error: "Hindi valid ang estUnitCost" }, { status: 400 });
      }
      data.estUnitCost = n;
      recompute = true;
    }

    if (recompute) {
      const effQty = data.qty !== undefined ? (data.qty as number) : item.qty ?? 1;
      const effCost = data.estUnitCost !== undefined ? (data.estUnitCost as number) : item.estUnitCost ?? 0;
      data.estTotal = round2(effQty * effCost);
    }

    if (body?.purchased !== undefined) {
      const purchased = Boolean(body.purchased);
      data.purchased = purchased;
      data.purchasedAt = purchased ? new Date() : null;
    }

    const updated = await db.shoppingListItem.update({ where: { id }, data });
    return NextResponse.json(toShoppingDTO(updated));
  } catch (e) {
    console.error("[PATCH /api/shopping-list/[id]]", e);
    return NextResponse.json({ error: "May problema sa server" }, { status: 500 });
  }
}

// DELETE /api/shopping-list/[id] — idempotent (deleting a missing item is OK)
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    try {
      await db.shoppingListItem.delete({ where: { id } });
    } catch (err: unknown) {
      // P2025 = record not found (race with checkout/other delete) — treat as success
      if (
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        (err as { code?: string }).code === "P2025"
      ) {
        return NextResponse.json({ ok: true, alreadyGone: true });
      }
      throw err;
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[DELETE /api/shopping-list/[id]]", e);
    return NextResponse.json({ error: "May problema sa server" }, { status: 500 });
  }
}
