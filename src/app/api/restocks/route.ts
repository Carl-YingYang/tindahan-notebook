// ── /api/restocks — restock history (Task 1-c) ───────────────────

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureSeeded } from "@/services/seed";
import type { RestockSource } from "@/types";

export const dynamic = "force-dynamic";

const RESTOCK_SOURCES = ["manual", "receipt", "shopping_list"];

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

// GET /api/restocks?limit= → RestockDTO[] date desc (default limit 15)
// GET /api/restocks?productId=xxx → restocks containing that product (items filtered to it)
export async function GET(req: Request) {
  try {
    await ensureSeeded();
    const { searchParams } = new URL(req.url);
    const limitRaw = Number(searchParams.get("limit"));
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.floor(limitRaw) : 15;
    const productId = searchParams.get("productId") ?? undefined;

    if (productId) {
      // Per-product history: find the restock items for this product, newest first,
      // and return each parent restock with only the matching item.
      const items = await db.restockItem.findMany({
        where: { productId },
        orderBy: { createdAt: "desc" },
        take: limit,
        include: { restock: true },
      });
      // Parent restocks, newest first
      items.sort((a, b) => (a.restock.date < b.restock.date ? 1 : -1));
      const dtos: ReturnType<typeof toRestockDTO>[] = items.map((it) =>
        toRestockDTO({
          id: it.restock.id,
          source: it.restock.source,
          supplier: it.restock.supplier,
          note: it.restock.note,
          total: it.restock.total,
          date: it.restock.date,
          items: [it],
        })
      );
      return NextResponse.json(dtos);
    }

    const restocks = await db.restock.findMany({
      orderBy: { date: "desc" },
      take: limit,
      include: { items: true },
    });
    return NextResponse.json(restocks.map(toRestockDTO));
  } catch (e) {
    console.error("[GET /api/restocks]", e);
    return NextResponse.json({ error: "May problema sa server" }, { status: 500 });
  }
}

// POST /api/restocks
// {source?, supplier?, note?, date?, items: [{productId?, name, qty, unitPrice}], updateStock?}
export async function POST(req: Request) {
  try {
    const body: any = await req.json().catch(() => ({}));

    const source = body?.source ?? "manual";
    if (!RESTOCK_SOURCES.includes(source)) {
      return NextResponse.json({ error: "Hindi valid ang source" }, { status: 400 });
    }

    let date = new Date();
    if (body?.date !== undefined && body?.date !== null && body.date !== "") {
      const d = new Date(body.date);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ error: "Hindi valid ang date" }, { status: 400 });
      }
      date = d;
    }

    const rawItems: any[] = Array.isArray(body?.items) ? body.items : [];
    if (rawItems.length === 0) {
      return NextResponse.json({ error: "Kumpletohin ang items" }, { status: 400 });
    }

    const parsedItems: { productId: string | null; name: string; qty: number; unitPrice: number }[] = [];
    for (const it of rawItems) {
      const name = typeof it?.name === "string" ? it.name.trim() : "";
      const qty = Number(it?.qty);
      const unitPrice = Number(it?.unitPrice);
      const productId = typeof it?.productId === "string" && it.productId.trim() !== "" ? it.productId.trim() : null;
      const valid =
        name !== "" && Number.isFinite(qty) && qty > 0 && Number.isFinite(unitPrice) && unitPrice >= 0;
      if (!valid) {
        return NextResponse.json({ error: "Kumpletohin ang items" }, { status: 400 });
      }
      parsedItems.push({ productId, name, qty, unitPrice });
    }

    const updateStock = Boolean(body?.updateStock);
    const supplier =
      typeof body?.supplier === "string" && body.supplier.trim() !== "" ? body.supplier.trim() : null;
    const note = typeof body?.note === "string" && body.note.trim() !== "" ? body.note.trim() : null;

    const restock = await db.$transaction(async (tx) => {
      const itemCreates: {
        productId: string | null;
        name: string;
        qty: number;
        unitPrice: number;
        total: number;
      }[] = [];

      for (const it of parsedItems) {
        let productId: string | null = null;

        if (it.productId) {
          const product = await tx.product.findUnique({ where: { id: it.productId } });
          if (product) {
            await tx.product.update({
              where: { id: product.id },
              data: {
                lastRestockAt: date,
                lastRestockQty: it.qty,
                lastCost: it.unitPrice,
                ...(updateStock ? { stockStatus: "marami" } : {}),
              },
            });
            productId = product.id;
          }
        }

        // No matching product + updateStock → create the product and link it
        if (!productId && updateStock) {
          const created = await tx.product.create({
            data: {
              name: it.name,
              unit: "pcs",
              stockStatus: "marami",
              lastCost: it.unitPrice,
              lastRestockAt: date,
              lastRestockQty: it.qty,
            },
          });
          productId = created.id;
        }

        itemCreates.push({
          productId,
          name: it.name,
          qty: it.qty,
          unitPrice: it.unitPrice,
          total: round2(it.qty * it.unitPrice),
        });
      }

      const total = round2(itemCreates.reduce((sum, i) => sum + i.total, 0));

      return tx.restock.create({
        data: {
          source,
          supplier,
          note,
          total,
          date,
          items: { create: itemCreates },
        },
        include: { items: true },
      });
    });

    return NextResponse.json(toRestockDTO(restock), { status: 201 });
  } catch (e) {
    console.error("[POST /api/restocks]", e);
    return NextResponse.json({ error: "May problema sa server" }, { status: 500 });
  }
}
