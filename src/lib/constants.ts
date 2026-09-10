// ── Domain constants (Taglish labels) ────────────────────────────

import type { StockStatus } from "@/types";

export const STOCK_STATUSES: {
  value: StockStatus;
  label: string;
  badge: string; // light chip classes
  dot: string;
  rank: number; // urgency rank (higher = more urgent)
}[] = [
  {
    value: "marami",
    label: "Marami pa",
    badge: "bg-emerald-100 text-emerald-700 border border-emerald-200",
    dot: "bg-emerald-500",
    rank: 0,
  },
  {
    value: "sakto",
    label: "Sakto lang",
    badge: "bg-amber-100 text-amber-700 border border-amber-200",
    dot: "bg-amber-500",
    rank: 1,
  },
  {
    value: "paubos",
    label: "Paubos",
    badge: "bg-orange-100 text-orange-700 border border-orange-200",
    dot: "bg-orange-500",
    rank: 2,
  },
  {
    value: "ubos",
    label: "Ubos",
    badge: "bg-rose-100 text-rose-700 border border-rose-200",
    dot: "bg-rose-500",
    rank: 3,
  },
];

export function stockStatusMeta(status: string) {
  return STOCK_STATUSES.find((s) => s.value === status) ?? STOCK_STATUSES[1];
}

export const EXPENSE_CATEGORIES = [
  "Restock",
  "Kuryente",
  "Transportasyon",
  "Renta",
  "Load",
  "Iba pa",
] as const;

export const SALES_CATEGORIES = ["Tindahan", "Load", "Iba pa"] as const;

export const PRODUCT_UNITS = ["pcs", "pack", "bote", "sachet", "reso", "dosena", "kilo"] as const;

export const DEFAULT_RESTOCK_QTY = 12;
