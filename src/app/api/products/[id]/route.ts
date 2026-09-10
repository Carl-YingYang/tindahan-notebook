// ── /api/products/[id] — update / remove a product (Task 1-c) ────

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { daysSince } from "@/lib/format";
import type { StockStatus } from "@/types";

export const dynamic = "force-dynamic";

const STOCK_STATUSES = ["marami", "sakto", "paubos", "ubos"];

type ProductRow = {
  id: string;
  name: string;
  unit: string | null;
  stockStatus: string;
  lastRestockAt: Date | null;
  lastRestockQty: number | null;
  lastCost: number | null;
  typicalIntervalDays: number | null;
  note: string | null;
  createdAt: Date;
};

function toProductDTO(p: ProductRow) {
  return {
    id: p.id,
    name: p.name,
    unit: p.unit,
    stockStatus: p.stockStatus as StockStatus,
    lastRestockAt: p.lastRestockAt ? p.lastRestockAt.toISOString() : null,
    lastRestockQty: p.lastRestockQty,
    lastCost: p.lastCost,
    typicalIntervalDays: p.typicalIntervalDays,
    note: p.note,
    daysSinceRestock: daysSince(p.lastRestockAt ? p.lastRestockAt.toISOString() : null),
    createdAt: p.createdAt.toISOString(),
  };
}

function numOrNull(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// PATCH /api/products/[id] — any of {name, unit, stockStatus, lastCost, note, typicalIntervalDays}
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body: any = await req.json().catch(() => ({}));

    const product = await db.product.findUnique({ where: { id } });
    if (!product) {
      return NextResponse.json({ error: "Hindi nahanap ang product" }, { status: 404 });
    }

    const data: {
      name?: string;
      unit?: string | null;
      stockStatus?: string;
      lastCost?: number | null;
      note?: string | null;
      typicalIntervalDays?: number | null;
    } = {};

    if (body?.name !== undefined) {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name) {
        return NextResponse.json({ error: "Ilagay ang pangalan ng product" }, { status: 400 });
      }
      // Reject renames that collide with a different product (case-insensitive)
      if (name.toLowerCase() !== product.name.trim().toLowerCase()) {
        const others = await db.product.findMany({ select: { id: true, name: true } });
        const dup = others.some(
          (p) => p.id !== id && p.name.trim().toLowerCase() === name.toLowerCase()
        );
        if (dup) {
          return NextResponse.json({ error: "May product na ganito sa tinda" }, { status: 409 });
        }
      }
      data.name = name;
    }

    if (body?.unit !== undefined) {
      data.unit = typeof body.unit === "string" && body.unit.trim() !== "" ? body.unit.trim() : null;
    }

    if (body?.stockStatus !== undefined) {
      if (!STOCK_STATUSES.includes(body.stockStatus)) {
        return NextResponse.json({ error: "Hindi valid ang stockStatus" }, { status: 400 });
      }
      data.stockStatus = body.stockStatus;
    }

    if (body?.lastCost !== undefined) {
      data.lastCost = numOrNull(body.lastCost);
    }

    if (body?.note !== undefined) {
      data.note = typeof body.note === "string" && body.note.trim() !== "" ? body.note.trim() : null;
    }

    if (body?.typicalIntervalDays !== undefined) {
      const n = numOrNull(body.typicalIntervalDays);
      data.typicalIntervalDays = n === null ? null : Math.round(n);
    }

    const updated = await db.product.update({ where: { id }, data });
    return NextResponse.json(toProductDTO(updated));
  } catch (e) {
    console.error("[PATCH /api/products/[id]]", e);
    return NextResponse.json({ error: "May problema sa server" }, { status: 500 });
  }
}

// DELETE /api/products/[id] — schema onDelete: SetNull handles restock items & shopping items
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const product = await db.product.findUnique({ where: { id }, select: { id: true } });
    if (!product) {
      return NextResponse.json({ error: "Hindi nahanap ang product" }, { status: 404 });
    }
    await db.product.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[DELETE /api/products/[id]]", e);
    return NextResponse.json({ error: "May problema sa server" }, { status: 500 });
  }
}
