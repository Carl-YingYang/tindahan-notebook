import { db } from "@/db/client";
import { newId } from "@/logic/id";
import { roundMoney } from "@/logic/format";
import type { ProductRestockEntry, RestockDTO, RestockItemDTO } from "@/types";
import type { RestockSource } from "@/logic/constants";
import { AppError, toIso, trimmedOrNull } from "./helpers";
import { refreshAll } from "@/store/data";

const VALID_SOURCES: RestockSource[] = ["manual", "receipt", "shopping_list"];

function serializeItem(row: any): RestockItemDTO {
  return {
    id: String(row.id),
    productId: row.product_id ?? null,
    name: String(row.name),
    qty: Number(row.qty) || 0,
    unitPrice: Number(row.unit_price) || 0,
    total: Number(row.total) || 0,
    createdAt: String(row.created_at),
  };
}

function serializeRestock(row: any, items: RestockItemDTO[]): RestockDTO {
  return {
    id: String(row.id),
    source: (VALID_SOURCES as string[]).includes(row.source) ? row.source : "manual",
    supplier: row.supplier ?? null,
    note: row.note ?? null,
    total: Number(row.total) || 0,
    date: String(row.date),
    createdAt: String(row.created_at),
    items,
  };
}

export function listRestocks(limit = 15): RestockDTO[] {
  const restocks = db.getAllSync<any>(
    `SELECT * FROM restocks ORDER BY date DESC, created_at DESC LIMIT ?`,
    [Math.min(Math.max(1, limit), 100)]
  );
  const result: RestockDTO[] = [];
  for (const r of restocks) {
    const items = db
      .getAllSync<any>(`SELECT * FROM restock_items WHERE restock_id = ? ORDER BY created_at ASC`, [r.id])
      .map(serializeItem);
    result.push(serializeRestock(r, items));
  }
  return result;
}

/** Per-product history — each entry = parent restock with only the matching item. */
export function getProductRestockHistory(productId: string, limit = 20): ProductRestockEntry[] {
  const items = db.getAllSync<any>(
    `SELECT * FROM restock_items WHERE product_id = ? ORDER BY created_at DESC LIMIT ?`,
    [productId, Math.min(Math.max(1, limit), 100)]
  );
  const out: ProductRestockEntry[] = [];
  for (const item of items) {
    const parent = db.getFirstSync<any>(`SELECT * FROM restocks WHERE id = ?`, [item.restock_id]);
    if (!parent) continue;
    out.push({ restock: serializeRestock(parent, []), item: serializeItem(item) });
  }
  return out;
}

export interface CreateRestockInput {
  source?: unknown;
  supplier?: unknown;
  note?: unknown;
  date?: unknown;
  items: Array<{ productId?: string | null; name: unknown; qty: unknown; unitPrice: unknown }>;
  updateStock?: boolean;
}

/** Mirrors POST /api/restocks — updates stock, creates unknown products when updateStock. */
export function createRestock(input: CreateRestockInput): RestockDTO {
  const source = typeof input.source === "string" ? (input.source as RestockSource) : "manual";
  if (!(VALID_SOURCES as string[]).includes(source)) throw new AppError("Hindi valid ang source");
  const date = toIso(input.date);

  const rawItems = Array.isArray(input.items) ? input.items : [];
  if (rawItems.length === 0) throw new AppError("Kumpletohin ang items");
  const cleanItems = rawItems
    .map((it) => ({
      productId: typeof it.productId === "string" && it.productId ? it.productId : null,
      name: typeof it.name === "string" ? it.name.trim().slice(0, 80) : "",
      qty: Number(it.qty),
      unitPrice: Number(it.unitPrice) || 0,
    }))
    .filter((it) => it.name.length > 0);
  if (
    cleanItems.length === 0 ||
    cleanItems.some((it) => !Number.isFinite(it.qty) || it.qty <= 0 || it.unitPrice < 0)
  ) {
    throw new AppError("Kumpletohin ang items");
  }

  const restockId = newId();
  const now = new Date().toISOString();
  let total = 0;

  const insertedItems: RestockItemDTO[] = [];
  db.withTransactionSync(() => {
    for (const it of cleanItems) {
      let productId = it.productId;
      let product = productId
        ? db.getFirstSync<{ id: string }>(`SELECT id FROM products WHERE id = ?`, [productId])
        : null;

      if (product) {
        db.runSync(
          `UPDATE products SET last_restock_at = ?, last_restock_qty = ?, last_cost = ?${
            input.updateStock ? ", stock_status = 'marami'" : ""
          }, updated_at = ? WHERE id = ?`,
          [date, it.qty, it.unitPrice, now, product.id]
        );
        productId = product.id;
      } else if (input.updateStock) {
        // unknown item → create the product so it lands in Tinda
        const pid = newId();
        db.runSync(
          `INSERT INTO products (id, name, unit, stock_status, last_restock_at, last_restock_qty, last_cost, typical_interval_days, note, created_at, updated_at)
           VALUES (?, ?, 'pcs', 'marami', ?, ?, ?, NULL, NULL, ?, ?)`,
          [pid, it.name, date, it.qty, it.unitPrice, now, now]
        );
        productId = pid;
      } else {
        productId = null;
      }

      const itemTotal = roundMoney(it.qty * it.unitPrice);
      total = roundMoney(total + itemTotal);
      const itemId = newId();
      db.runSync(
        `INSERT INTO restock_items (id, restock_id, product_id, name, qty, unit_price, total, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [itemId, restockId, productId, it.name, it.qty, it.unitPrice, itemTotal, now]
      );
      insertedItems.push({
        id: itemId,
        productId,
        name: it.name,
        qty: it.qty,
        unitPrice: it.unitPrice,
        total: itemTotal,
        createdAt: now,
      });
    }

    db.runSync(
      `INSERT INTO restocks (id, source, supplier, note, total, date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [restockId, source, trimmedOrNull(input.supplier, 80), trimmedOrNull(input.note, 120), total, date, now]
    );
  });
  refreshAll();

  const row = db.getFirstSync<any>(`SELECT * FROM restocks WHERE id = ?`, [restockId]);
  return serializeRestock(row, insertedItems);
}

export function deleteRestock(id: string): void {
  const exists = db.getFirstSync(`SELECT id FROM restocks WHERE id = ?`, [id]);
  if (!exists) throw new AppError("Hindi nahanap ang restock");
  db.runSync(`DELETE FROM restocks WHERE id = ?`, [id]);
  refreshAll();
}
