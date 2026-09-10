// ── /api/shopping-list/checkout — convert marked items to a restock ──

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { RestockSource } from "@/types";

export const dynamic = "force-dynamic";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

type RestockRow = {
  id: string;
  source: string;
  supplier: string | null;
  note: string | null;
  total: number;
  date: Date;
  items: {
    id: string;
    productId: string | null;
    name: string;
    qty: number;
    unitPrice: number;
    total: number;
  }[];
};

function toRestockDTO(r: RestockRow) {
  return {
    id: r.id,
    source: r.source as RestockSource,
    supplier: r.supplier,
    note: r.note,
    total: r.total,
    date: r.date.toISOString(),
    items: r.items.map((i) => ({
      id: i.id,
      productId: i.productId,
      name: i.name,
      qty: i.qty,
      unitPrice: i.unitPrice,
      total: i.total,
    })),
  };
}

// POST /api/shopping-list/checkout → {restock: RestockDTO}
// Creates ONE restock from all purchased=true items (updateStock=true rules),
// then deletes those items.
export async function POST() {
  try {
    const purchasedItems = await db.shoppingListItem.findMany({ where: { purchased: true } });
    if (purchasedItems.length === 0) {
      return NextResponse.json({ error: "Wala pang naka-mark na nabili" }, { status: 400 });
    }

    const restock = await db.$transaction(async (tx) => {
      const itemCreates: {
        productId: string | null;
        name: string;
        qty: number;
        unitPrice: number;
        total: number;
      }[] = [];

      for (const it of purchasedItems) {
        const qty = it.qty ?? 1;
        const unitPrice = it.estUnitCost ?? 0;
        let productId: string | null = null;

        if (it.productId) {
          const product = await tx.product.findUnique({ where: { id: it.productId } });
          if (product) {
            await tx.product.update({
              where: { id: product.id },
              data: {
                lastRestockAt: new Date(),
                lastRestockQty: qty,
                lastCost: unitPrice,
                stockStatus: "marami",
              },
            });
            productId = product.id;
          }
        }

        // No linked product → create one (same rule as restocks POST with updateStock)
        if (!productId) {
          const created = await tx.product.create({
            data: {
              name: it.name,
              unit: "pcs",
              stockStatus: "marami",
              lastCost: unitPrice,
              lastRestockAt: new Date(),
              lastRestockQty: qty,
            },
          });
          productId = created.id;
        }

        itemCreates.push({
          productId,
          name: it.name,
          qty,
          unitPrice,
          total: round2(qty * unitPrice),
        });
      }

      const total = round2(itemCreates.reduce((sum, i) => sum + i.total, 0));

      const created = await tx.restock.create({
        data: {
          source: "shopping_list",
          supplier: null,
          note: "Galing sa restock list",
          total,
          date: new Date(),
          items: { create: itemCreates },
        },
        include: { items: true },
      });

      // Delete only the items snapshotted above (avoid deleting items added mid-checkout)
      await tx.shoppingListItem.deleteMany({
        where: { id: { in: purchasedItems.map((i) => i.id) } },
      });

      return created;
    });

    return NextResponse.json({ restock: toRestockDTO(restock) }, { status: 201 });
  } catch (e) {
    console.error("[POST /api/shopping-list/checkout]", e);
    return NextResponse.json({ error: "May problema sa server" }, { status: 500 });
  }
}
