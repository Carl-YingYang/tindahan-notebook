import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// DELETE /api/sales/[id] → {ok:true} | 404
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await db.sale.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Hindi nahanap" }, { status: 404 });
    }

    await db.sale.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[DELETE /api/sales/:id]", e);
    return NextResponse.json({ error: "May problema sa server" }, { status: 500 });
  }
}
