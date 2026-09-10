import { roundMoney } from "@/logic/format";

/** Error whose message is a user-facing Taglish string (surfaced via toast). */
export class AppError extends Error {}

/** Accepts number | numeric string (₱, commas, spaces tolerated); > 0 or null. */
export function parsePositiveAmount(v: unknown): number | null {
  let n: number;
  if (typeof v === "number") {
    n = v;
  } else if (typeof v === "string") {
    n = parseFloat(v.replace(/[₱,\s]/g, ""));
  } else {
    return null;
  }
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function parseNonNegativeAmount(v: unknown): number | null {
  let n: number;
  if (typeof v === "number") {
    n = v;
  } else if (typeof v === "string") {
    n = parseFloat(v.replace(/[₱,\s]/g, ""));
  } else {
    return null;
  }
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Date | ISO string → ISO string (invalid/missing → now). */
export function toIso(v: unknown): string {
  if (v instanceof Date) {
    return Number.isNaN(v.getTime()) ? new Date().toISOString() : v.toISOString();
  }
  if (typeof v === "string" && v.length > 0) {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return new Date().toISOString();
}

export function toIsoOrNull(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) {
    return Number.isNaN(v.getTime()) ? null : v.toISOString();
  }
  if (typeof v === "string") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
}

export function trimmedOrNull(v: unknown, max = 200): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  return t.slice(0, max);
}

export { roundMoney };
