// ── OCR: supplier receipt extraction (backend ONLY) ──────────────
// POST { imageBase64 } → { items, rawText?, provider }
// The frontend ALWAYS shows a review screen — this only extracts.

import { NextRequest, NextResponse } from "next/server";
import { ocrProvider } from "@/services/ocr";

export const dynamic = "force-dynamic";

// ~8MB of base64 (matches the route-handler body budget).
const MAX_BASE64_LENGTH = 8 * 1024 * 1024;

export async function POST(req: NextRequest) {
  let body: { imageBase64?: unknown } | null = null;
  try {
    body = (await req.json()) as { imageBase64?: unknown } | null;
  } catch {
    body = null;
  }

  const imageBase64 = typeof body?.imageBase64 === "string" ? body.imageBase64 : "";
  if (!imageBase64.trim()) {
    return NextResponse.json({ error: "Kailangan ng larawan ng resibo" }, { status: 400 });
  }
  if (imageBase64.length > MAX_BASE64_LENGTH) {
    return NextResponse.json(
      { error: "Masyadong malaki ang larawan. Subukan ang mas maliit na photo." },
      { status: 413 }
    );
  }

  try {
    const { items, rawText } = await ocrProvider.extractReceipt(imageBase64);
    return NextResponse.json({ items, rawText, provider: ocrProvider.name });
  } catch (err) {
    console.error("[api/ocr/receipt] extraction failed:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: "Hindi ma-access ang OCR service ngayon. Subukan ulit o i-type manually." },
      { status: 503 }
    );
  }
}
