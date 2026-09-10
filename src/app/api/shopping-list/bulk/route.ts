// ── /api/shopping-list/bulk — add many items (Suki AI flow) ──────

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { ShoppingSource } from "@/types";

export const dynamic = "force-dynamic";

const SHOPPING_SOURCES = ["manual", "low_stock", "ai"];

function round2(n: number): number {
  return Math.round(n * 100) / 100;
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

// POST /api/shopping-list/bulk {items: [{productId?, name, qty?, estUnitCost?, source?}]} → {count}
export async function POST(req: Request) {
  try {
    const body: any = await req.json().catch(() => ({}));
    const rawItems: any[] = Array.isArray(body?.items) ? body.items : [];
    if (rawItems.length === 0) {
      return NextResponse.json({ error: "Kumpletohin ang items" }, { status: 400 });
    }

    const rows: {
      productId: string | null;
      name: string;
      qty: number | null;
      estUnitCost: number | null;
      estTotal: number;
      source: ShoppingSource;
    }[] = [];

    for (const it of rawItems) {
      const name = typeof it?.name === "string" ? it.name.trim() : "";
      const qty = parseOptionalNumber(it?.qty);
      const cost = parseOptionalNumber(it?.estUnitCost);
      const source = it?.source ?? "manual";
      if (!name || !qty.ok || !cost.ok || !SHOPPING_SOURCES.includes(source)) {
        return NextResponse.json({ error: "Kumpletohin ang items" }, { status: 400 });
      }
      rows.push({
        productId: productIdOf(it?.productId),
        name,
        qty: qty.value,
        estUnitCost: cost.value,
        estTotal: round2((qty.value ?? 1) * (cost.value ?? 0)),
        source: source as ShoppingSource,
      });
    }

    // Dedupe against existing pending items: merge qty for same product/name
    // instead of creating duplicates.
    const pending = await db.shoppingListItem.findMany({ where: { purchased: false } });
    const byProduct = new Map(pending.filter((p) => p.productId).map((p) => [p.productId as string, p]));
    const byName = new Map(pending.filter((p) => !p.productId).map((p) => [p.name.toLowerCase(), p]));

    const creates: typeof rows = [];
    let merged = 0;
    for (const row of rows) {
      const match = row.productId ? byProduct.get(row.productId) : byName.get(row.name.toLowerCase());
      if (match) {
        const newQty = (match.qty ?? 1) + (row.qty ?? 1);
        const effCost = row.estUnitCost ?? match.estUnitCost ?? 0;
        await db.shoppingListItem.update({
          where: { id: match.id },
          data: { qty: newQty, estUnitCost: effCost, estTotal: round2(newQty * effCost) },
        });
        merged += 1;
      } else {
        creates.push(row);
      }
    }

    let count = merged;
    if (creates.length > 0) {
      const res = await db.shoppingListItem.createMany({ data: creates });
      count += res.count;
    }
    return NextResponse.json({ count }, { status: 201 });
  } catch (e) {
    console.error("[POST /api/shopping-list/bulk]", e);
    return NextResponse.json({ error: "May problema sa server" }, { status: 500 });
  }
}
