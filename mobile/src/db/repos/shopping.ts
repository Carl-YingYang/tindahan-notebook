import { db } from "@/db/client";
import { newId } from "@/logic/id";
import { roundMoney } from "@/logic/format";
import type { RestockDTO, ShoppingItemDTO } from "@/types";
import type { ShoppingSource } from "@/logic/constants";
import { AppError, trimmedOrNull } from "./helpers";
import { refreshAll } from "@/store/data";

const VALID_SOURCES: ShoppingSource[] = ["manual", "low_stock", "ai"];

function serializeItem(row: any): ShoppingItemDTO {
  return {
    id: String(row.id),
    productId: row.product_id ?? null,
    name: String(row.name),
    qty: row.qty ?? null,
    estUnitCost: row.est_unit_cost ?? null,
    estTotal: Number(row.est_total) || 0,
    purchased: Number(row.purchased) === 1,
    source: (VALID_SOURCES as string[]).includes(row.source) ? row.source : "manual",
    purchasedAt: row.purchased_at ?? null,
    createdAt: String(row.created_at),
  };
}

function effTotal(qty: number | null, cost: number | null): number {
  return roundMoney((qty ?? 1) * (cost ?? 0));
}

function cleanQty(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function listShoppingItems(): ShoppingItemDTO[] {
  return db
    .getAllSync<any>(
      `SELECT * FROM shopping_list_items ORDER BY purchased ASC, created_at DESC`
    )
    .map(serializeItem);
}

export interface AddShoppingInput {
  productId?: string | null;
  name: unknown;
  qty?: unknown;
  estUnitCost?: unknown;
  source?: unknown;
}

/** Mirrors POST /api/shopping-list — dedupes against pending rows by bumping qty. */
export function addShoppingItem(
  input: AddShoppingInput
): { item: ShoppingItemDTO; duplicate: boolean } {
  const name = typeof input.name === "string" ? input.name.trim().slice(0, 80) : "";
  if (!name) throw new AppError("Kailangan ang pangalan ng item");
  const source = typeof input.source === "string" ? (input.source as ShoppingSource) : "manual";
  if (!(VALID_SOURCES as string[]).includes(source)) throw new AppError("Hindi valid ang source");

  const productId = typeof input.productId === "string" && input.productId ? input.productId : null;
  const qty = cleanQty(input.qty);
  const cost = cleanQty(input.estUnitCost);

  // dedupe: same productId, or same lowercased name when no productId
  const pending = db.getAllSync<any>(`SELECT * FROM shopping_list_items WHERE purchased = 0`);
  const lower = name.toLowerCase();
  const existing = pending.find((r) =>
    productId ? r.product_id === productId : String(r.name).toLowerCase() === lower
  );

  if (existing) {
    const newQty = (existing.qty ?? 1) + (qty ?? 1);
    const effCost = cost ?? (existing.est_unit_cost ?? null);
    db.runSync(
      `UPDATE shopping_list_items SET qty = ?, est_unit_cost = ?, est_total = ?, updated_at = ? WHERE id = ?`,
      [newQty, effCost, effTotal(newQty, effCost), new Date().toISOString(), existing.id]
    );
    refreshAll();
    return {
      item: serializeItem(db.getFirstSync<any>(`SELECT * FROM shopping_list_items WHERE id = ?`, [existing.id])),
      duplicate: true,
    };
  }

  const id = newId();
  const now = new Date().toISOString();
  db.runSync(
    `INSERT INTO shopping_list_items (id, product_id, name, qty, est_unit_cost, est_total, purchased, source, purchased_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?, NULL, ?, ?)`,
    [id, productId, name, qty, cost, effTotal(qty, cost), source, now, now]
  );
  refreshAll();
  return { item: serializeItem(db.getFirstSync<any>(`SELECT * FROM shopping_list_items WHERE id = ?`, [id])), duplicate: false };
}

export function updateShoppingItem(
  id: string,
  patch: { name?: unknown; qty?: unknown; estUnitCost?: unknown; purchased?: unknown }
): ShoppingItemDTO {
  const existing = db.getFirstSync<any>(`SELECT * FROM shopping_list_items WHERE id = ?`, [id]);
  if (!existing) throw new AppError("Hindi nahanap ang item");

  const next: Record<string, unknown> = {};
  if (patch.name !== undefined) {
    const name = trimmedOrNull(patch.name, 80);
    if (!name) throw new AppError("Kailangan ang pangalan ng item");
    next.name = name;
  }
  let qtyChanged = false;
  if (patch.qty !== undefined) {
    const n = typeof patch.qty === "number" ? patch.qty : parseFloat(String(patch.qty));
    if (!Number.isFinite(n) || n < 0) throw new AppError("Hindi valid ang qty");
    next.qty = n;
    qtyChanged = true;
  }
  let costChanged = false;
  if (patch.estUnitCost !== undefined) {
    const n = typeof patch.estUnitCost === "number" ? patch.estUnitCost : parseFloat(String(patch.estUnitCost));
    if (!Number.isFinite(n) || n < 0) throw new AppError("Hindi valid ang estUnitCost");
    next.est_unit_cost = n;
    costChanged = true;
  }
  if (patch.purchased !== undefined) {
    const purchased = patch.purchased === true || patch.purchased === 1;
    next.purchased = purchased ? 1 : 0;
    next.purchased_at = purchased ? new Date().toISOString() : null;
  }
  if (qtyChanged || costChanged) {
    const qty = (next.qty ?? existing.qty) as number | null;
    const cost = (next.est_unit_cost ?? existing.est_unit_cost) as number | null;
    next.est_total = effTotal(qty, cost);
  }
  next.updated_at = new Date().toISOString();

  const sets = Object.keys(next).map((k) => `${k} = ?`).join(", ");
  db.runSync(`UPDATE shopping_list_items SET ${sets} WHERE id = ?`, [...Object.values(next), id] as never[]);
  refreshAll();
  return serializeItem(db.getFirstSync<any>(`SELECT * FROM shopping_list_items WHERE id = ?`, [id]));
}

export function deleteShoppingItem(id: string): { ok: true; alreadyGone?: boolean } {
  const exists = db.getFirstSync(`SELECT id FROM shopping_list_items WHERE id = ?`, [id]);
  if (!exists) return { ok: true, alreadyGone: true };
  db.runSync(`DELETE FROM shopping_list_items WHERE id = ?`, [id]);
  refreshAll();
  return { ok: true };
}

export interface BulkShoppingInput {
  productId?: string | null;
  name: unknown;
  qty?: unknown;
  estUnitCost?: unknown;
  source?: unknown;
}

/** Mirrors POST /api/shopping-list/bulk — merge into pending rows where possible. */
export function bulkAddShoppingItems(items: BulkShoppingInput[]): { count: number } {
  const clean = (Array.isArray(items) ? items : []).filter(
    (it) => typeof it.name === "string" && it.name.trim().length > 0
  );
  if (clean.length === 0) throw new AppError("Kumpletohin ang items");

  let count = 0;
  for (const it of clean) {
    try {
      addShoppingItem(it);
      count++;
    } catch {
      // skip malformed line, keep bulk resilient
    }
  }
  return { count };
}

/** Mirrors POST /api/shopping-list/checkout — purchased items → one restock record. */
export function checkoutShoppingList(): RestockDTO {
  const purchased = db
    .getAllSync<any>(`SELECT * FROM shopping_list_items WHERE purchased = 1 ORDER BY created_at ASC`);
  if (purchased.length === 0) throw new AppError("Wala pang naka-mark na nabili");

  const restockId = newId();
  const now = new Date().toISOString();
  let total = 0;

  db.withTransactionSync(() => {
    // Parent row FIRST — restock_items.restock_id is an immediate FK
    // (PRAGMA foreign_keys = ON) and inserting items before the restocks
    // row would fail with SQLITE_CONSTRAINT_FOREIGNKEY.
    db.runSync(
      `INSERT INTO restocks (id, source, supplier, note, total, date, created_at) VALUES (?, 'shopping_list', NULL, 'Galing sa restock list', 0, ?, ?)`,
      [restockId, now, now]
    );
    for (const item of purchased) {
      const qty = item.qty ?? 1;
      const unitPrice = item.est_unit_cost ?? 0;
      let productId: string | null = item.product_id ?? null;

      if (productId) {
        const product = db.getFirstSync<{ id: string }>(`SELECT id FROM products WHERE id = ?`, [productId]);
        if (product) {
          db.runSync(
            `UPDATE products SET last_restock_at = ?, last_restock_qty = ?, last_cost = ?, stock_status = 'marami', updated_at = ? WHERE id = ?`,
            [now, qty, unitPrice, now, product.id]
          );
        } else {
          productId = null;
        }
      }
      if (!productId) {
        const pid = newId();
        db.runSync(
          `INSERT INTO products (id, name, unit, stock_status, last_restock_at, last_restock_qty, last_cost, typical_interval_days, note, created_at, updated_at)
           VALUES (?, ?, 'pcs', 'marami', ?, ?, ?, NULL, NULL, ?, ?)`,
          [pid, String(item.name), now, qty, unitPrice, now, now]
        );
        productId = pid;
      }

      const itemTotal = roundMoney(qty * unitPrice);
      total = roundMoney(total + itemTotal);
      db.runSync(
        `INSERT INTO restock_items (id, restock_id, product_id, name, qty, unit_price, total, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [newId(), restockId, productId, String(item.name), qty, unitPrice, itemTotal, now]
      );
    }

    db.runSync(`UPDATE restocks SET total = ? WHERE id = ?`, [total, restockId]);
    db.runSync(
      `DELETE FROM shopping_list_items WHERE id IN (${purchased.map(() => "?").join(",")})`,
      purchased.map((p) => p.id)
    );
  });
  refreshAll();

  const row = db.getFirstSync<any>(`SELECT * FROM restocks WHERE id = ?`, [restockId]);
  const items: import("@/types").RestockItemDTO[] = db
    .getAllSync<any>(`SELECT * FROM restock_items WHERE restock_id = ? ORDER BY created_at ASC`, [restockId])
    .map((r: any) => ({
      id: String(r.id),
      productId: r.product_id ?? null,
      name: String(r.name),
      qty: Number(r.qty) || 0,
      unitPrice: Number(r.unit_price) || 0,
      total: Number(r.total) || 0,
      createdAt: String(r.created_at),
    }));
  return {
    id: restockId,
    source: "shopping_list",
    supplier: null,
    note: "Galing sa restock list",
    total,
    date: now,
    createdAt: now,
    items,
  };
}
