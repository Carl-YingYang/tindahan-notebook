/**
 * Deterministic receipt-text → items parser (pure, testable).
 * Feeds the MANDATORY editable review screen — OCR output is never saved
 * without user confirmation.
 */

import type { OcrItem, OcrResult } from "./types";

const MAX_ITEMS = 100;
const MAX_NAME_LENGTH = 80;

function toNumberOrNull(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const n = parseFloat(v.replace(/[₱,\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function cleanName(raw: string): string {
  return raw
    .replace(/[\u20B1$]/g, " ")
    .replace(/\b(subtotal|sub-total|total|change|vat|cash|due)\b/gi, " ")
    .replace(/\b\d{1,3}(?:[,.]\d{3})*(?:[.,]\d{2})?\b/g, " ")
    .replace(/x{1,2}\s*$/i, " ")
    .replace(/[^\p{L}\p{N}\s&'.()-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_NAME_LENGTH);
}

/**
 * Line heuristic parser for on-device OCR text (ML Kit blocks):
 *  - "Coke Mismo x2 25.00" / "2 x Coke Mismo ₱25" / "Coke Mismo .... 25.00"
 * Returns items with whatever numbers were found; the review screen
 * lets the user fix everything.
 */
export function parseReceiptText(rawText: string): OcrItem[] {
  if (!rawText || typeof rawText !== "string") return [];
  const lines = rawText.split(/\r?\n/);
  const items: OcrItem[] = [];

  for (const line of lines) {
    if (items.length >= MAX_ITEMS) break;
    const trimmed = line.trim();
    if (trimmed.length < 4) continue;

    // trailing amount (last number-ish token, optionally ₱-prefixed)
    const amountMatch = trimmed.match(/(₱?\s*\d{1,6}(?:[.,]\d{2})?)\s*$/);
    let total: number | null = null;
    let namePart = trimmed;
    if (amountMatch) {
      total = toNumberOrNull(amountMatch[1]);
      namePart = trimmed.slice(0, amountMatch.index ?? 0);
    }

    // qty prefix: "2 x", "2x", "x2"
    let qty: number | null = null;
    const qx = namePart.match(/^\s*(\d{1,3})\s*[xX×]\s*/);
    const xq = namePart.match(/^\s*[xX×]\s*(\d{1,3})\s*/);
    if (qx) {
      qty = parseInt(qx[1], 10);
      namePart = namePart.slice(qx[0].length);
    } else if (xq) {
      qty = parseInt(xq[1], 10);
      namePart = namePart.slice(xq[0].length);
    }

    const name = cleanName(namePart);
    if (!name || name.length < 2 || /^\d+$/.test(name)) continue;
    if (total === null && qty === null) continue;

    let unitPrice: number | null = null;
    if (total && qty && qty > 0) unitPrice = Math.round((total / qty) * 100) / 100;

    items.push({
      name,
      qty: qty && qty > 0 ? qty : null,
      unitPrice: unitPrice && unitPrice > 0 ? unitPrice : null,
      total: total && total > 0 ? total : null,
    });
  }
  return items;
}

/** Normalize an on-device OCR result into the shared shape. */
export function normalizeOcrResult(text: string, provider: string): OcrResult {
  const rawText = (text ?? "").slice(0, 4000);
  const items = parseReceiptText(rawText).map((it) => ({
    name: it.name,
    qty: it.qty && it.qty > 0 ? it.qty : 1,
    unitPrice: it.unitPrice && it.unitPrice > 0 ? it.unitPrice : 0,
    total: it.total && it.total > 0 ? it.total : (it.qty ?? 1) * (it.unitPrice ?? 0),
  }));
  return { items, rawText, provider };
}
