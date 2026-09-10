import { db } from "@/db/client";
import { newId } from "@/logic/id";
import { daysSince } from "@/logic/format";
import type { Product } from "@/types";
import type { StockStatus } from "@/logic/constants";
import { AppError, parseNonNegativeAmount, toIsoOrNull, trimmedOrNull } from "./helpers";
import { refreshAll } from "@/store/data";

const VALID_STATUSES: StockStatus[] = ["marami", "sakto", "paubos", "ubos"];

function serializeProduct(row: any): Product {
  return {
    id: String(row.id),
    name: String(row.name),
    unit: row.unit ?? null,
    stockStatus: (VALID_STATUSES as string[]).includes(row.stock_status)
      ? (row.stock_status as StockStatus)
      : "sakto",
    lastRestockAt: row.last_restock_at ?? null,
    lastRestockQty: row.last_restock_qty ?? null,
    lastCost: row.last_cost ?? null,
    typicalIntervalDays: row.typical_interval_days ?? null,
    note: row.note ?? null,
    createdAt: String(row.created_at),
    daysSinceRestock: daysSince(row.last_restock_at),
  };
}

function normalizeInterval(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

export function listProducts(): Product[] {
  return db
    .getAllSync<any>(`SELECT * FROM products`)
    .map(serializeProduct)
    .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
}

function nameTaken(name: string, excludeId?: string): boolean {
  const all = db.getAllSync<{ id: string; name: string }>(`SELECT id, name FROM products`);
  const lower = name.toLowerCase();
  return all.some((p) => p.name.toLowerCase() === lower && p.id !== excludeId);
}

export function createProduct(input: {
  name: unknown;
  unit?: unknown;
  stockStatus?: unknown;
  lastCost?: unknown;
  note?: unknown;
  typicalIntervalDays?: unknown;
}): Product {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name) throw new AppError("Ilagay ang pangalan ng product");
  const status = (typeof input.stockStatus === "string" && (VALID_STATUSES as string[]).includes(input.stockStatus)
    ? input.stockStatus
    : input.stockStatus === undefined || input.stockStatus === null || input.stockStatus === ""
    ? "sakto"
    : null) as StockStatus | null;
  if (!status) throw new AppError("Hindi valid ang stockStatus");
  if (nameTaken(name)) throw new AppError("May product na ganito sa tinda");

  const id = newId();
  const now = new Date().toISOString();
  const lastCost = parseNonNegativeAmount(input.lastCost ?? null);
  db.runSync(
    `INSERT INTO products (id, name, unit, stock_status, last_restock_at, last_restock_qty, last_cost, typical_interval_days, note, created_at, updated_at)
     VALUES (?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?)`,
    [
      id,
      name,
      trimmedOrNull(input.unit, 30),
      status,
      lastCost,
      normalizeInterval(input.typicalIntervalDays),
      trimmedOrNull(input.note, 200),
      now,
      now,
    ]
  );
  refreshAll();
  const row = db.getFirstSync<any>(`SELECT * FROM products WHERE id = ?`, [id]);
  return serializeProduct(row);
}

export function updateProduct(
  id: string,
  patch: {
    name?: unknown;
    unit?: unknown;
    stockStatus?: unknown;
    lastCost?: unknown;
    note?: unknown;
    typicalIntervalDays?: unknown;
  }
): Product {
  const existing = db.getFirstSync<any>(`SELECT * FROM products WHERE id = ?`, [id]);
  if (!existing) throw new AppError("Hindi nahanap ang product");

  const next: Record<string, unknown> = {};
  if (patch.name !== undefined) {
    const name = typeof patch.name === "string" ? patch.name.trim() : "";
    if (!name) throw new AppError("Ilagay ang pangalan ng product");
    if (nameTaken(name, id)) throw new AppError("May product na ganito sa tinda");
    next.name = name;
  }
  if (patch.unit !== undefined) next.unit = trimmedOrNull(patch.unit, 30);
  if (patch.stockStatus !== undefined) {
    const status = typeof patch.stockStatus === "string" ? patch.stockStatus : "";
    if (!(VALID_STATUSES as string[]).includes(status)) throw new AppError("Hindi valid ang stockStatus");
    next.stock_status = status;
  }
  if (patch.lastCost !== undefined) next.last_cost = parseNonNegativeAmount(patch.lastCost);
  if (patch.note !== undefined) next.note = trimmedOrNull(patch.note, 200);
  if (patch.typicalIntervalDays !== undefined) next.typical_interval_days = normalizeInterval(patch.typicalIntervalDays);

  if (Object.keys(next).length > 0) {
    next.updated_at = new Date().toISOString();
    const sets = Object.keys(next).map((k) => `${k} = ?`).join(", ");
    db.runSync(`UPDATE products SET ${sets} WHERE id = ?`, [...Object.values(next), id] as never[]);
    refreshAll();
  }
  return serializeProduct(db.getFirstSync<any>(`SELECT * FROM products WHERE id = ?`, [id]));
}

export function setStockStatus(id: string, status: string): Product {
  return updateProduct(id, { stockStatus: status });
}

export function deleteProduct(id: string): void {
  const exists = db.getFirstSync(`SELECT id FROM products WHERE id = ?`, [id]);
  if (!exists) throw new AppError("Hindi nahanap ang product");
  db.runSync(`DELETE FROM products WHERE id = ?`, [id]);
  refreshAll();
}
