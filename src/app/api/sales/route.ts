import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 60;

// GET /api/sales?limit= → Sale[] (newest first)
export async function GET(req: Request) {
  try {
    const rawLimit = new URL(req.url).searchParams.get("limit");
    const parsed = rawLimit ? parseInt(rawLimit, 10) : NaN;
    const limit =
      Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 500) : DEFAULT_LIMIT;

    const rows = await db.sale.findMany({
      orderBy: { date: "desc" },
      take: limit,
    });

    return NextResponse.json(
      rows.map((r) => ({
        id: r.id,
        amount: r.amount,
        category: r.category,
        note: r.note,
        date: r.date.toISOString(),
      }))
    );
  } catch (e) {
    console.error("[GET /api/sales]", e);
    return NextResponse.json({ error: "May problema sa server" }, { status: 500 });
  }
}

// POST /api/sales {amount, category?, note?, date?} → Sale
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as {
      amount?: unknown;
      category?: unknown;
      note?: unknown;
      date?: unknown;
    } | null;

    // Accept numbers (and tolerant numeric strings), reject everything else / <= 0
    const amount = typeof body?.amount === "string" ? Number(body.amount) : body?.amount;
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Ilagay ang tamang halaga" }, { status: 400 });
    }

    const category =
      typeof body?.category === "string" && body.category.trim()
        ? body.category.trim()
        : null;
    const note =
      typeof body?.note === "string" && body.note.trim() ? body.note.trim() : null;

    let date = new Date();
    if (typeof body?.date === "string" && body.date) {
      const parsedDate = new Date(body.date);
      if (!Number.isNaN(parsedDate.getTime())) date = parsedDate;
    }

    const created = await db.sale.create({
      data: { amount, category, note, date },
    });

    return NextResponse.json({
      id: created.id,
      amount: created.amount,
      category: created.category,
      note: created.note,
      date: created.date.toISOString(),
    });
  } catch (e) {
    console.error("[POST /api/sales]", e);
    return NextResponse.json({ error: "May problema sa server" }, { status: 500 });
  }
}
