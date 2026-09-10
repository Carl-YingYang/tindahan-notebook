// ── /api/restocks/[id] — delete a restock (Task 1-c) ─────────────

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// DELETE /api/restocks/[id] — items cascade via schema (onDelete: Cascade)
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const restock = await db.restock.findUnique({ where: { id }, select: { id: true } });
    if (!restock) {
      return NextResponse.json({ error: "Hindi nahanap ang restock" }, { status: 404 });
    }
    await db.restock.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[DELETE /api/restocks/[id]]", e);
    return NextResponse.json({ error: "May problema sa server" }, { status: 500 });
  }
}
