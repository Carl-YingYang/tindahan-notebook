import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 60;

// GET /api/expenses?limit= → Expense[] (newest first)
export async function GET(req: Request) {
  try {
    const rawLimit = new URL(req.url).searchParams.get("limit");
    const parsed = rawLimit ? parseInt(rawLimit, 10) : NaN;
    const limit =
      Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 500) : DEFAULT_LIMIT;

    const rows = await db.expense.findMany({
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
    console.error("[GET /api/expenses]", e);
    return NextResponse.json({ error: "May problema sa server" }, { status: 500 });
  }
}

// POST /api/expenses {amount, category, note?, date?} → Expense
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as {
      amount?: unknown;
      category?: unknown;
      note?: unknown;
      date?: unknown;
    } | null;

    const amount = typeof body?.amount === "string" ? Number(body.amount) : body?.amount;
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Ilagay ang tamang halaga" }, { status: 400 });
    }

    const category =
      typeof body?.category === "string" && body.category.trim()
        ? body.category.trim()
        : "Iba pa"; // default kung walang category
    const note =
      typeof body?.note === "string" && body.note.trim() ? body.note.trim() : null;

    let date = new Date();
    if (typeof body?.date === "string" && body.date) {
      const parsedDate = new Date(body.date);
      if (!Number.isNaN(parsedDate.getTime())) date = parsedDate;
    }

    const created = await db.expense.create({
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
    console.error("[POST /api/expenses]", e);
    return NextResponse.json({ error: "May problema sa server" }, { status: 500 });
  }
}
