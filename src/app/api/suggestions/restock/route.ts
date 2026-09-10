// ── /api/suggestions/restock — budget-based suggestion (Task 1-c) ──
// Route owned by Task 1-c; logic lives in src/services/restock-suggester.ts (Task 1-d).
// The service is imported lazily so this route still boots (503) while Task 1-d lands.

import { NextResponse } from "next/server";
import { ensureSeeded } from "@/services/seed";
import type { RestockSuggestion } from "@/types";

export const dynamic = "force-dynamic";

type SuggesterModule = {
  suggestRestock: (budget: number) => Promise<RestockSuggestion>;
};

/** Missing / empty / non-numeric budget → null (caller sends 400 "Ilagay ang budget") */
function parseBudget(raw: unknown): number | null {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isNaN(n) ? null : n;
}

async function runSuggestion(budget: number): Promise<NextResponse> {
  // Lazy dynamic import — module is owned by Task 1-d and may not exist yet.
  // @ts-ignore — restock-suggester may not exist yet (provided by Task 1-d)
  const mod = (await import("@/services/restock-suggester").catch(() => null)) as SuggesterModule | null;
  if (!mod || typeof mod.suggestRestock !== "function") {
    return NextResponse.json({ error: "Hindi pa available ang suggestion service" }, { status: 503 });
  }
  try {
    await ensureSeeded();
    const suggestion: RestockSuggestion = await mod.suggestRestock(budget);
    return NextResponse.json(suggestion);
  } catch (e) {
    console.error("[/api/suggestions/restock] suggestRestock failed", e);
    return NextResponse.json({ error: "May problema sa server" }, { status: 500 });
  }
}

// GET /api/suggestions/restock?budget=NNN
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const budget = parseBudget(searchParams.get("budget"));
    if (budget === null) {
      return NextResponse.json({ error: "Ilagay ang budget" }, { status: 400 });
    }
    return await runSuggestion(budget);
  } catch (e) {
    console.error("[GET /api/suggestions/restock]", e);
    return NextResponse.json({ error: "May problema sa server" }, { status: 500 });
  }
}

// POST /api/suggestions/restock {budget}
export async function POST(req: Request) {
  try {
    const body: any = await req.json().catch(() => ({}));
    const budget = parseBudget(body?.budget);
    if (budget === null) {
      return NextResponse.json({ error: "Ilagay ang budget" }, { status: 400 });
    }
    return await runSuggestion(budget);
  } catch (e) {
    console.error("[POST /api/suggestions/restock]", e);
    return NextResponse.json({ error: "May problema sa server" }, { status: 500 });
  }
}
