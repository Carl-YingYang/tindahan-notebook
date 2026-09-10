// ── /api/settings — app-level settings stored in AppSetting (key/value) ──
// Currently exposes the weekly benta target ("Target sa Benta") used by the
// Home goal card. Deterministic local storage — no AI involved.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const WEEKLY_BENTA_TARGET_KEY = "weekly_benta_target";

async function readTarget(): Promise<number | null> {
  // A missing row means "no target yet" — not an error.
  const row = await db.appSetting.findUnique({ where: { key: WEEKLY_BENTA_TARGET_KEY } });
  if (!row) return null;
  const n = Number(row.value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

// ── GET /api/settings → { weeklyBentaTarget: number | null } ─────
export async function GET() {
  try {
    const weeklyBentaTarget = await readTarget();
    return NextResponse.json({ weeklyBentaTarget });
  } catch (err) {
    console.error("[GET /api/settings]", err);
    return NextResponse.json({ error: "May problema sa server" }, { status: 500 });
  }
}

// ── PUT /api/settings { weeklyBentaTarget: number | null } ───────
// number >= 0 → saved (rounded to centavos); null → target removed.
export async function PUT(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as {
      weeklyBentaTarget?: number | string | null;
    } | null;
    if (!body || !("weeklyBentaTarget" in body)) {
      return NextResponse.json({ error: "Ilagay ang target" }, { status: 400 });
    }

    const raw = body.weeklyBentaTarget;

    // null / "" → clear the target
    if (raw === null || raw === "") {
      await db.appSetting.deleteMany({ where: { key: WEEKLY_BENTA_TARGET_KEY } });
      return NextResponse.json({ weeklyBentaTarget: null });
    }

    const n = typeof raw === "number" ? raw : Number(String(raw).replace(/[₱,\s]/g, ""));
    if (!Number.isFinite(n) || n < 0) {
      return NextResponse.json({ error: "Ilagay ang tamang halaga" }, { status: 400 });
    }

    const value = Math.round(n * 100) / 100;
    await db.appSetting.upsert({
      where: { key: WEEKLY_BENTA_TARGET_KEY },
      create: { key: WEEKLY_BENTA_TARGET_KEY, value: String(value) },
      update: { value: String(value) },
    });
    return NextResponse.json({ weeklyBentaTarget: value });
  } catch (err) {
    console.error("[PUT /api/settings]", err);
    return NextResponse.json({ error: "May problema sa server" }, { status: 500 });
  }
}
