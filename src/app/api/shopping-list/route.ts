// ── /api/shopping-list — restock list (Task 1-c) ─────────────────

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureSeeded } from "@/services/seed";
import type { ShoppingSource } from "@/types";

export const dynamic = "force-dynamic";

const SHOPPING_SOURCES = ["manual", "low_stock", "ai"];

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

function parseOptionalNumber(v: unknown): { ok: boolean; value: number | null } {
  if (v === undefined || v === null || v === "") return { ok: true, value: null };
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return { ok: false, value: null };
  return { ok: true, value: n };
}

function productIdOf(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

// GET /api/shopping-list → ShoppingItemDTO[] (pending first: purchased asc, createdAt desc)
export async function GET() {
  try {
    await ensureSeeded();
    const items = await db.shoppingListItem.findMany({
      orderBy: [{ purchased: "asc" }, { createdAt: "desc" }],
    });
    return NextResponse.json(items.map(toShoppingDTO));
  } catch (e) {
    console.error("[GET /api/shopping-list]", e);
    return NextResponse.json({ error: "May problema sa server" }, { status: 500 });
  }
}

// POST /api/shopping-list {productId?, name, qty?, estUnitCost?, source?}
export async function POST(req: Request) {
  try {
    const body: any = await req.json().catch(() => ({}));

    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "Kailangan ang pangalan ng item" }, { status: 400 });
    }

    const source = body?.source ?? "manual";
    if (!SHOPPING_SOURCES.includes(source)) {
      return NextResponse.json({ error: "Hindi valid ang source" }, { status: 400 });
    }

    const qty = parseOptionalNumber(body?.qty);
    if (!qty.ok) {
      return NextResponse.json({ error: "Hindi valid ang qty" }, { status: 400 });
    }
    const cost = parseOptionalNumber(body?.estUnitCost);
    if (!cost.ok) {
      return NextResponse.json({ error: "Hindi valid ang estUnitCost" }, { status: 400 });
    }

    const productId = productIdOf(body?.productId);

    // Dedupe: if a pending item for the same product (or same name) already
    // exists, bump its qty/cost instead of creating a duplicate row.
    const existingPending = await db.shoppingListItem.findFirst({
      where: {
        purchased: false,
        ...(productId
          ? { productId }
          : { name: { equals: name } }),
      },
    });

    if (existingPending) {
      const newQty = (existingPending.qty ?? 1) + (qty.value ?? 1);
      const effCost = cost.value ?? existingPending.estUnitCost ?? 0;
      const updated = await db.shoppingListItem.update({
        where: { id: existingPending.id },
        data: {
          qty: newQty,
          estUnitCost: effCost,
          estTotal: round2(newQty * effCost),
        },
      });
      return NextResponse.json({ ...toShoppingDTO(updated), duplicate: true }, { status: 200 });
    }

    const created = await db.shoppingListItem.create({
      data: {
        productId,
        name,
        qty: qty.value,
        estUnitCost: cost.value,
        estTotal: round2((qty.value ?? 1) * (cost.value ?? 0)),
        source,
      },
    });

    return NextResponse.json(toShoppingDTO(created), { status: 201 });
  } catch (e) {
    console.error("[POST /api/shopping-list]", e);
    return NextResponse.json({ error: "May problema sa server" }, { status: 500 });
  }
}
