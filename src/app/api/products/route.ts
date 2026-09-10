// ── /api/products — Tinda catalog (Task 1-c) ─────────────────────

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { daysSince } from "@/lib/format";
import { ensureSeeded } from "@/services/seed";
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

// GET /api/products → Product[] sorted alphabetically (case-insensitive)
export async function GET() {
  try {
    await ensureSeeded();
    const products = await db.product.findMany();
    products.sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
    return NextResponse.json(products.map(toProductDTO));
  } catch (e) {
    console.error("[GET /api/products]", e);
    return NextResponse.json({ error: "May problema sa server" }, { status: 500 });
  }
}

// POST /api/products {name, unit?, stockStatus?, lastCost?, note?, typicalIntervalDays?}
export async function POST(req: Request) {
  try {
    const body: any = await req.json().catch(() => ({}));

    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "Ilagay ang pangalan ng product" }, { status: 400 });
    }

    const stockStatus = body?.stockStatus ?? "sakto";
    if (!STOCK_STATUSES.includes(stockStatus)) {
      return NextResponse.json({ error: "Hindi valid ang stockStatus" }, { status: 400 });
    }

    // Case-insensitive duplicate check (SQLite has no insensitive filter via Prisma)
    const existing = await db.product.findMany({ select: { name: true } });
    if (existing.some((p) => p.name.trim().toLowerCase() === name.toLowerCase())) {
      return NextResponse.json({ error: "May product na ganito sa tinda" }, { status: 409 });
    }

    const interval = numOrNull(body?.typicalIntervalDays);
    const created = await db.product.create({
      data: {
        name,
        unit: typeof body?.unit === "string" && body.unit.trim() !== "" ? body.unit.trim() : null,
        stockStatus,
        lastCost: numOrNull(body?.lastCost),
        note: typeof body?.note === "string" && body.note.trim() !== "" ? body.note.trim() : null,
        typicalIntervalDays: interval === null ? null : Math.round(interval),
      },
    });

    return NextResponse.json(toProductDTO(created), { status: 201 });
  } catch (e) {
    console.error("[POST /api/products]", e);
    return NextResponse.json({ error: "May problema sa server" }, { status: 500 });
  }
}
