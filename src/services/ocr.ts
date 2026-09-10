// ── OCR abstraction layer (backend ONLY) ─────────────────────────
// Reads Philippine supplier receipts with the z-ai-web-dev-sdk VLM
// (vision chat). NEVER import this file from client code.

import ZAI from "z-ai-web-dev-sdk";
import type { OcrItem } from "@/types";

export interface OcrProvider {
  name: string;
  extractReceipt(imageBase64: string): Promise<{ items: OcrItem[]; rawText?: string }>;
}

const OCR_PROMPT = `Ikaw ay isang receipt OCR engine para sa maliit na sari-sari store sa Pilipinas.
Basahin ang Philippine supplier receipt sa larawan at i-extract ang bawat line item ng produkto.

Sumagot ng STRICT JSON LANG — walang markdown, walang code fences, walang paliwanag:
{"items":[{"name":"<product name>","qty":<number or null>,"unitPrice":<number or null>,"total":<number or null>}],"rawText":"<lahat ng text na nababasa mo sa resibo, i-preserve ang line breaks>"}

Rules:
- qty, unitPrice at total ay dapat NUMBERS (hindi strings). Kung hindi malinaw o kulang ang info, gamitin ang null.
- name: malinis na pangalan ng produkto lang (tanggalin ang presyo, "x", "@", at iba pang symbols). Max 80 characters.
- Huwag mag-imbento ng item na wala sa resibo. Huwag isama ang subtotal, tax, change, o store info bilang item.
- Kung blurrado o hindi mabasa ang ibang bahagi, ibalik lang ang mga item na kaya mong basahin nang tama, at ilagay sa rawText ang lahat ng text na nakikita mo.`;

const MAX_ITEMS = 100;
const MAX_NAME_LENGTH = 80;
const MAX_RAW_TEXT_LENGTH = 4000;

/** Accept raw base64 OR a data URL; normalize to a data URL for the VLM. */
function normalizeToDataUrl(imageBase64: string): string {
  const trimmed = imageBase64.trim();
  if (/^data:image\//i.test(trimmed)) return trimmed;
  // Raw base64: strip stray whitespace/newlines, sniff a sensible mime type.
  const compact = trimmed.replace(/\s+/g, "");
  return `data:${sniffImageMime(compact)};base64,${compact}`;
}

function sniffImageMime(b64: string): string {
  if (b64.startsWith("iVBOR")) return "image/png";
  if (b64.startsWith("/9j/")) return "image/jpeg";
  if (b64.startsWith("R0lGOD")) return "image/gif";
  if (b64.startsWith("UklGR")) return "image/webp";
  return "image/jpeg"; // camera photos are usually jpeg
}

/** Strip markdown code fences so raw model output is easier to reuse. */
function stripCodeFences(text: string): string {
  return text
    .replace(/```[a-zA-Z]*\s*\n?/g, "")
    .replace(/```/g, "")
    .trim();
}

/**
 * Find the first balanced {...} (or [...]) JSON block, skipping strings so
 * braces/brackets inside rawText don't break the scan. If a candidate block
 * fails to parse, keep scanning from the next opening bracket.
 */
function extractJsonBlock(text: string): unknown | null {
  let from = 0;
  while (from < text.length) {
    const rel = text.slice(from).search(/[{[]/);
    if (rel === -1) return null;
    const openIdx = from + rel;
    const open = text[openIdx];
    const close = open === "{" ? "}" : "]";
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = openIdx; i < text.length; i++) {
      const ch = text[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === "\\") escaped = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') inString = true;
      else if (ch === open) depth++;
      else if (ch === close) {
        depth--;
        if (depth === 0) {
          try {
            return JSON.parse(text.slice(openIdx, i + 1));
          } catch {
            break; // not valid JSON — try the next opening bracket
          }
        }
      }
    }
    from = openIdx + 1;
  }
  return null;
}

/** Coerce model output numbers defensively: "1,250.50" → 1250.5, junk → null. */
function toNumberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[₱,\s]/g, "");
    if (!cleaned) return null;
    const n = Number.parseFloat(cleaned);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function nonNegative(value: unknown): number | null {
  const n = toNumberOrNull(value);
  if (n === null || n < 0) return null;
  return round2(n);
}

/** Trim, collapse whitespace, cap length; drop empty names. */
function sanitizeName(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).replace(/\s+/g, " ").trim().slice(0, MAX_NAME_LENGTH);
  return s.length > 0 ? s : null;
}

function parseItems(parsed: unknown): OcrItem[] {
  const rawItems = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object" && Array.isArray((parsed as Record<string, unknown>).items)
      ? ((parsed as Record<string, unknown>).items as unknown[])
      : null;
  if (!rawItems) return [];
  const items: OcrItem[] = [];
  for (const entry of rawItems.slice(0, MAX_ITEMS)) {
    if (!entry || typeof entry !== "object") continue;
    const obj = entry as Record<string, unknown>;
    const name = sanitizeName(obj.name);
    if (!name) continue; // drop empty names
    items.push({
      name,
      qty: nonNegative(obj.qty),
      unitPrice: nonNegative(obj.unitPrice ?? obj.unit_price ?? obj.price),
      total: nonNegative(obj.total ?? obj.amount),
    });
  }
  return items;
}

function parseRawText(parsed: unknown): string | undefined {
  if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    const raw = obj.rawText ?? obj.raw_text;
    if (typeof raw === "string" && raw.trim()) return raw.trim().slice(0, MAX_RAW_TEXT_LENGTH);
  }
  return undefined;
}

export class VlmOcrProvider implements OcrProvider {
  name = "zai-vlm";

  async extractReceipt(imageBase64: string): Promise<{ items: OcrItem[]; rawText?: string }> {
    if (typeof imageBase64 !== "string" || !imageBase64.trim()) {
      throw new Error("OCR: empty image payload");
    }
    const dataUrl = normalizeToDataUrl(imageBase64);

    let modelOutput: string;
    try {
      const zai = await ZAI.create();
      // `model` is server-defaulted; the SDK type marks it required, hence the cast.
      const completion = await zai.chat.completions.createVision({
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: OCR_PROMPT },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        thinking: { type: "disabled" },
      } as unknown as Parameters<
        Awaited<ReturnType<typeof ZAI.create>>["chat"]["completions"]["createVision"]
      >[0]);
      const choices = (completion as { choices?: { message?: { content?: unknown } }[] } | null)?.choices;
      modelOutput = typeof choices?.[0]?.message?.content === "string" ? choices[0].message.content : "";
    } catch (err) {
      throw new Error(`OCR service failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    if (!modelOutput.trim()) {
      throw new Error("OCR service returned an empty response");
    }

    const parsed = extractJsonBlock(stripCodeFences(modelOutput));
    if (parsed === null || typeof parsed !== "object") {
      throw new Error("OCR service returned unreadable output");
    }
    return { items: parseItems(parsed), rawText: parseRawText(parsed) };
  }
}

export const ocrProvider: OcrProvider = new VlmOcrProvider();
