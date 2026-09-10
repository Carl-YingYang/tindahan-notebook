import { NextResponse } from "next/server";
import { ensureSeeded, resetAndSeed } from "@/services/seed";

export const dynamic = "force-dynamic";

// POST /api/seed {force?: boolean} → {ok:true}
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as { force?: unknown } | null;
    const force = body?.force === true;

    if (force) {
      await resetAndSeed();
    } else {
      await ensureSeeded();
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[POST /api/seed]", e);
    return NextResponse.json({ error: "May problema sa server" }, { status: 500 });
  }
}
