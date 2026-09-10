import type { AvatarToneKey } from "./format";

export type StockStatus = "marami" | "sakto" | "paubos" | "ubos";
export type UtangTxnType = "utang" | "payment";
export type RestockSource = "manual" | "receipt" | "shopping_list";
export type ShoppingSource = "manual" | "low_stock" | "ai";
export type ToneKey = AvatarToneKey;

export interface StockStatusMeta {
  value: StockStatus;
  label: string;
  short: string;
  tone: ToneKey;
  rank: number;
}

/** 4 statuses, one tap each — labels must match the web prototype verbatim. */
export const STOCK_STATUSES: StockStatusMeta[] = [
  { value: "marami", label: "Marami pa", short: "Marami", tone: "emerald", rank: 0 },
  { value: "sakto", label: "Sakto lang", short: "Sakto", tone: "amber", rank: 1 },
  { value: "paubos", label: "Paubos", short: "Paubos", tone: "orange", rank: 2 },
  { value: "ubos", label: "Ubos", short: "Ubos", tone: "rose", rank: 3 },
];

export function stockStatusMeta(status: string): StockStatusMeta {
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

export const PRODUCT_UNITS = [
  "pcs", "pack", "bote", "sachet", "reso", "dosena", "kilo",
] as const;

export const DEFAULT_RESTOCK_QTY = 12;

export const RESTOCK_SOURCE_META: Record<
  RestockSource,
  { label: string; tone: ToneKey }
> = {
  manual: { label: "Manual", tone: "emerald" },
  receipt: { label: "Resibo", tone: "amber" },
  shopping_list: { label: "List", tone: "orange" },
};
