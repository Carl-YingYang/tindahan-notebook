import { db } from "@/db/client";
import { newId } from "@/logic/id";
import { KEYS, getSetting } from "@/db/repos/settings";
import { refreshAll } from "@/store/data";

/**
 * OPTIONAL demo seed — never runs in production unless triggered from
 * Settings ("Load demo data") or explicitly via seedDemo(force).
 * Mirrors the web prototype's seed (src/services/seed.ts) exactly.
 */

function daysAgo(days: number, hour = 9): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

export function isSeeded(): boolean {
  return getSetting(KEYS.seeded) === "1";
}

function resetAll(): void {
  const tables = [
    "restock_items",
    "restocks",
    "shopping_list_items",
    "utang_transactions",
    "sales",
    "expenses",
    "products",
    "customers",
    "ai_conversations",
    "app_settings",
  ];
  db.execSync(`PRAGMA foreign_keys = OFF`);
  for (const t of tables) db.execSync(`DELETE FROM ${t}`);
  db.execSync(`PRAGMA foreign_keys = ON`);
}

export function seedDemo(force = false): void {
  if (!force && isSeeded()) return;
  if (force) resetAll();

  const now = new Date().toISOString();
  const ins = (sql: string, args: unknown[]) => db.runSync(sql, args as never[]);

  // ---- products (10) ----
  const products: Array<[string, string, string, number, number | null, string | null, number | null]> = [
    ["Coke Mismo", "bote", "paubos", 12.5, 24, daysAgo(12), 7],
    ["Lucky Me Pancit Canton", "pack", "sakto", 9, 48, daysAgo(12), 10],
    ["Coffee 3-in-1 sachet", "sachet", "paubos", 7.5, 60, daysAgo(15), 12],
    ["Bear Brand sachet", "sachet", "marami", 11, 36, daysAgo(12), 14],
    ["Sky Flakes", "pack", "sakto", 8, 40, daysAgo(12), 10],
    ["Piattos", "pcs", "marami", 12, 30, daysAgo(8), 9],
    ["Yakult", "bote", "sakto", 8, 24, daysAgo(6), 7],
    ["Safeguard", "pcs", "ubos", 25, 12, daysAgo(25), 20],
    ["Kopiko Brown Coffee", "sachet", "marami", 8, 30, daysAgo(5), 12],
    ["Rebisco Crackers", "pack", "sakto", 7, 36, daysAgo(20), 15],
  ];
  const pid: Record<string, string> = {};
  for (const [name, unit, status, cost, qty, restockAt, interval] of products) {
    const id = newId();
    pid[name] = id;
    ins(
      `INSERT INTO products (id, name, unit, stock_status, last_restock_at, last_restock_qty, last_cost, typical_interval_days, note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
      [id, name, unit, status, restockAt, qty, cost, interval, now, now]
    );
  }

  // ---- restocks (3, manual) ----
  const restock = (supplier: string, note: string | null, dateIso: string, items: Array<[string, string, number, number]>) => {
    const rid = newId();
    let total = 0;
    for (const [productName, _label, qty, price] of items) {
      const it = round2(qty * price);
      total = round2(total + it);
      ins(
        `INSERT INTO restock_items (id, restock_id, product_id, name, qty, unit_price, total, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [newId(), rid, pid[productName] ?? null, productName, qty, price, it, dateIso]
      );
    }
    ins(
      `INSERT INTO restocks (id, source, supplier, note, total, date, created_at) VALUES (?, 'manual', ?, ?, ?, ?, ?)`,
      [rid, supplier, note, total, dateIso, now]
    );
  };
  restock("Tindahan ni Aling Rosa", "Linggong restock", daysAgo(12, 9), [
    ["Coke Mismo", "", 24, 12.5],
    ["Lucky Me Pancit Canton", "", 48, 9],
    ["Bear Brand sachet", "", 36, 11],
    ["Sky Flakes", "", 40, 8],
    ["Piattos", "", 30, 12],
  ]);
  restock("Yakult lady", "Weekly Yakult", daysAgo(6, 8), [["Yakult", "", 24, 8]]);
  restock("Grocery depot", null, daysAgo(25, 10), [
    ["Safeguard", "", 12, 25],
    ["Rebisco Crackers", "", 36, 7],
  ]);

  // ---- customers (4) ----
  const customers: Array<[string, string | null]> = [
    ["Juan Dela Cruz", "Kapitbahay sa may kanto"],
    ["Maria Santos", null],
    ["Pedro Reyes", "Tricycle driver"],
    ["Kap Bogart", null],
  ];
  const cid: Record<string, string> = {};
  for (const [name, note] of customers) {
    const id = newId();
    cid[name] = id;
    ins(
      `INSERT INTO customers (id, name, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
      [id, name, note, now, now]
    );
  }

  // ---- utang txns ----
  const txn = (customer: string, type: "utang" | "payment", amount: number, note: string, dateIso: string, due?: string) => {
    ins(
      `INSERT INTO utang_transactions (id, customer_id, type, amount, note, due_date, date, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [newId(), cid[customer], type, amount, note, due ?? null, dateIso, now]
    );
  };
  txn("Juan Dela Cruz", "utang", 120, "2 Lucky Me, 1 Coke", daysAgo(3), daysAgo(1));
  txn("Juan Dela Cruz", "utang", 85, "Kape at tinapay", daysAgo(1));
  txn("Juan Dela Cruz", "payment", 50, "Hulog muna", daysAgo(0, 8));
  txn("Maria Santos", "utang", 200, "Grocery-list", daysAgo(5));
  txn("Maria Santos", "payment", 200, "Bayad na", daysAgo(2));
  txn("Pedro Reyes", "utang", 60, "2 Kopiko, 1 Yakult", daysAgo(2), daysAgo(0));
  txn("Kap Bogart", "utang", 500, "Para sa handaan", daysAgo(10), daysAhead(5));
  txn("Kap Bogart", "payment", 150, "Parte", daysAgo(4));

  // ---- sales (13 over 7 days) ----
  const sales: Array<[number, string | null, string | null, number]> = [
    [240, "Tindahan", null, 6],
    [150, "Load", "GCash load", 6],
    [320, "Tindahan", null, 5],
    [95, "Tindahan", "Meryenda ng bata", 5],
    [410, "Tindahan", "Kap Bogart handaan", 4],
    [180, "Tindahan", null, 4],
    [120, "Load", null, 3],
    [265, "Tindahan", null, 2],
    [90, "Tindahan", "Yakult at Sky Flakes", 2],
    [340, "Tindahan", null, 1],
    [110, "Load", "Regular suki", 1],
    [185, "Tindahan", "Umaga pa lang", 0],
    [75, "Tindahan", "Coke at chichirya", 0],
  ];
  for (const [amount, category, note, ago] of sales) {
    ins(
      `INSERT INTO sales (id, amount, category, note, date, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [newId(), amount, category, note, daysAgo(ago, 11 + (ago % 5)), now]
    );
  }

  // ---- expenses (5) ----
  const expenses: Array<[number, string, string | null, number]> = [
    [1200, "Restock", "Aling Rosa", 12],
    [350, "Kuryente", "Meralco", 7],
    [60, "Transportasyon", "Tricycle papuntang depot", 5],
    [100, "Load", "Pang-load na wallet", 3],
    [40, "Transportasyon", null, 1],
  ];
  for (const [amount, category, note, ago] of expenses) {
    ins(
      `INSERT INTO expenses (id, amount, category, note, date, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [newId(), amount, category, note, daysAgo(ago, 10), now]
    );
  }

  // ---- shopping list (3) ----
  const shop: Array<[string, string | null, number, number, string]> = [
    ["Coke Mismo", pid["Coke Mismo"], 24, 12.5, "low_stock"],
    ["Safeguard", pid["Safeguard"], 12, 25, "low_stock"],
    ["Plastic bag (malaki)", null, 50, 1, "manual"],
  ];
  for (const [name, productId, qty, cost, source] of shop) {
    ins(
      `INSERT INTO shopping_list_items (id, product_id, name, qty, est_unit_cost, est_total, purchased, source, purchased_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, NULL, ?, ?)`,
      [newId(), productId, name, qty, cost, round2(qty * cost), source, now, now]
    );
  }

  db.runSync(
    `INSERT INTO app_settings (key, value) VALUES (?, '1')
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [KEYS.seeded]
  );
  refreshAll();
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function daysAhead(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}
