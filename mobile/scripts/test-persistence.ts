/**
 * Tindahan Ko — device-free persistence & offline test harness.
 *
 * Runs the REAL app data layer (migrations + all repos + AI service) under bun,
 * with expo-sqlite shimmed onto a real SQLite file — proving the exact behaviors
 * that must survive on an Android device:
 *   1. 10-table schema migrates cleanly on first launch
 *   2. utang add → partial payment → balance math
 *   3. benta/gastos + day/summary totals (Manila-day anchored)
 *   4. product stock status + restock list checkout → history + status flip
 *   5. DATABASE CLOSE + REOPEN (app restart simulation) → zero data loss
 *   6. Suki AI graceful offline/no-key fallback (exact Taglish strings)
 *   7. deterministic restock budget allocator
 *
 * Usage: bun scripts/test-persistence.ts
 */
import { mock } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";

const DB_DIR = "/tmp/tindahan-persistence-test";
rmSync(DB_DIR, { recursive: true, force: true });
mkdirSync(DB_DIR, { recursive: true });
const DB_FILE = `${DB_DIR}/tindahan.db`;

/* ---------- SQLite backend: node:sqlite or bun:sqlite ---------- */
type Row = Record<string, unknown>;
interface Backing {
  exec(sql: string): void;
  run(sql: string, ...p: unknown[]): unknown;
  get(sql: string, ...p: unknown[]): Row | undefined;
  all(sql: string, ...p: unknown[]): Row[];
  close(): void;
}
async function openBacking(file: string): Promise<Backing> {
  let d: any;
  try {
    d = new ((await import("node:sqlite")).DatabaseSync as any)(file);
    return {
      exec: (sql) => d.exec(sql),
      run: (sql, ...p) => d.prepare(sql).run(...p),
      get: (sql, ...p) => d.prepare(sql).get(...p),
      all: (sql, ...p) => d.prepare(sql).all(...p),
      close: () => d.close(),
    };
  } catch {
    d = new ((await import("bun:sqlite")).Database as any)(file);
    return {
      exec: (sql) => d.exec(sql),
      run: (sql, ...p) => d.run(sql, ...p),
      get: (sql, ...p) => d.query(sql).get(...p),
      all: (sql, ...p) => d.query(sql).all(...p),
      close: () => d.close(),
    };
  }
}

let backing = await openBacking(DB_FILE);

function norm(args: unknown[]): unknown[] {
  if (args.length === 1 && Array.isArray(args[0])) return args[0] as unknown[];
  return args;
}

const shim = {
  execSync(sql: string) {
    backing.exec(sql);
  },
  runSync(sql: string, ...args: unknown[]) {
    const r = backing.run(sql, ...norm(args)) as { changes: number | bigint; lastInsertRowid: number | bigint };
    return { changes: Number(r?.changes ?? 0), lastInsertRowId: Number(r?.lastInsertRowid ?? 0) };
  },
  getFirstSync(sql: string, ...args: unknown[]) {
    return backing.get(sql, ...norm(args)) ?? null;
  },
  getAllSync(sql: string, ...args: unknown[]) {
    return backing.all(sql, ...norm(args));
  },
  withTransactionSync<T>(fn: () => T): T {
    backing.exec("BEGIN IMMEDIATE");
    try {
      const out = fn();
      backing.exec("COMMIT");
      return out;
    } catch (e) {
      backing.exec("ROLLBACK");
      throw e;
    }
  },
};

mock.module("expo-sqlite", () => ({ openDatabaseSync: (_name: string) => shim }));
// expo-constants pulls react-native (flow) into the bun graph — settings only
// reads Constants.expoConfig?.extra, which is empty in tests.
mock.module("expo-constants", () => ({ default: { expoConfig: { extra: {} } } }));

/** Simulate an app restart: physically close + reopen the same database file. */
async function restartApp() {
  backing.close();
  backing = await openBacking(DB_FILE);
}

/* ---------- import the REAL app modules (after the mock) ---------- */
const { initDb } = await import("../src/db/client");
const customers = await import("../src/db/repos/customers");
const utang = await import("../src/db/repos/utang");
const records = await import("../src/db/repos/records");
const products = await import("../src/db/repos/products");
const shopping = await import("../src/db/repos/shopping");
const restocks = await import("../src/db/repos/restocks");
const settings = await import("../src/db/repos/settings");
const aiRepo = await import("../src/db/repos/ai");
const glm = await import("../src/services/ai/glm");
const { suggestRestock } = await import("../src/logic/restock-suggester");

let pass = 0,
  fail = 0;
function ok(cond: unknown, label: string, extra = "") {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else {
    fail++;
    console.error(`  ✗ FAIL: ${label} ${extra}`);
  }
}

/* ============ 1. first launch: migrations ============ */
console.log("\n[1] First launch — 10-table migration");
initDb();
const tables = (shim.getAllSync(
  `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
) as { name: string }[]).map((r) => r.name);
const expected = [
  "ai_conversations",
  "app_settings",
  "customers",
  "expenses",
  "products",
  "restock_items",
  "restocks",
  "sales",
  "shopping_list_items",
  "utang_transactions",
];
ok(
  JSON.stringify(tables) === JSON.stringify(expected),
  `all 10 tables created (${tables.length})`,
  JSON.stringify(tables)
);
const uv = shim.getFirstSync("PRAGMA user_version") as { user_version: number };
ok(uv.user_version === 1, `user_version=1 after migration (got ${uv.user_version})`);

/* ============ 2. utang flow ============ */
console.log("\n[2] Utang — add, partial payment, balance");
const nena = customers.createCustomer("Aling Nena", "Tindahan sa kanto");
ok(!!nena?.id, "customer created with id");

const dup = customers.createCustomer("aling nena"); // web parity: direct create allows same name (case-insensitive dedupe lives in the utang flow)
ok(!!dup?.id && dup.id !== nena.id, "direct create allows same name (1:1 web parity)");
const viaUtang = utang.addUtang({ customerName: "Aling Nena", amount: 50 }); // addUtang dedupes by name
ok(viaUtang.customer.id === nena.id, `addUtang with existing name reuses suki (got ${viaUtang.customer.id} vs ${nena.id})`);

utang.addUtang({ customerId: nena.id, amount: 150, note: "Kape at sardinas", dueDate: "2026-09-20" });
utang.addUtang({ customerId: nena.id, amount: "₱75" }); // peso-string like the UI sends
let row = customers.listCustomerSummaries().find((c) => c.id === nena.id)!;
ok(row.totalUtang === 275 && row.balance === 275, `totalUtang 275 (50+150+75), balance 275 (got ${row.totalUtang}/${row.balance})`);

utang.recordPayment({ customerId: nena.id, amount: 100, note: "Bayad muna" });
row = customers.listCustomerSummaries().find((c) => c.id === nena.id)!;
ok(row.totalPaid === 100 && row.balance === 175, `payment 100 → balance 175 (got ${row.totalPaid}/${row.balance})`);
ok(row.notes.includes("Kape at sardinas"), "tala blob includes utang note");
ok(row.dueDate !== null, "earliest due date surfaced");
ok(row.txnCount === 4, `txnCount 4 (got ${row.txnCount})`);

const detail = customers.getCustomerDetail(nena.id);
ok(detail?.transactions.length === 4, `detail lists 4 transactions (got ${detail?.transactions.length})`);
ok(detail?.balance === 175, `detail balance 175 (got ${detail?.balance})`);

/* ============ 3. benta / gastos / day summary ============ */
console.log("\n[3] Daily benta & gastos");
records.addSale({ amount: 250, category: "tindahan", note: "Umaga benta" });
records.addSale({ amount: 120.5, note: "Load" });
records.addExpense({ amount: 80, category: "paninda", note: "Bili yelo" });
const now = new Date();
const dayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
const day = records.getDay(dayStr);
ok(day.totals.benta === 370.5, `day benta 370.5 (got ${day.totals.benta})`);
ok(day.totals.gastos === 80, `day gastos 80 (got ${day.totals.gastos})`);
ok(day.totals.net === 290.5, `day net 290.5 (got ${day.totals.net})`);
const summary = records.getSummary();
ok(summary.today.benta === 370.5 && summary.today.gastos === 80, "summary today totals match (Manila-day anchored)");

/* ============ 4. products + restock checkout ============ */
console.log("\n[4] Paninda + restock list checkout");
products.createProduct({ name: "Coffee 3-in-1", unit: "sachet", stockStatus: "sakto", lastCost: 8 });
const sardinas = products.createProduct({ name: "Sardinas", unit: "can", stockStatus: "paubos", lastCost: 25 });
const bigas = products.createProduct({ name: "Bigas", unit: "kilo", stockStatus: "ubos", lastCost: 55 });
ok(products.listProducts().length === 3, `3 products (got ${products.listProducts().length})`);

products.setStockStatus(sardinas.id, "ubos");
ok(products.listProducts().find((p) => p.id === sardinas.id)?.stockStatus === "ubos", "one-tap status flip paubos→ubos");

shopping.addShoppingItem({ productId: sardinas.id, name: "Sardinas", qty: 10, estUnitCost: 25, source: "low_stock" });
shopping.addShoppingItem({ productId: bigas.id, name: "Bigas", qty: 5, estUnitCost: 55, source: "manual" });
let shop = shopping.listShoppingItems();
ok(shop.length === 2, `2 shopping items (got ${shop.length})`);
const dupItem = shopping.addShoppingItem({ productId: sardinas.id, name: "Sardinas", qty: 3, estUnitCost: 25, source: "low_stock" });
ok(dupItem.duplicate === true && shopping.listShoppingItems().length === 2, "duplicate item deduped (qty bumped on existing)");
shop = shopping.listShoppingItems();
ok(shop.reduce((s, i) => s + i.estTotal, 0) === 600, `est totals after bump: 13×25 + 5×55 = 600 (got ${shop.reduce((s, i) => s + i.estTotal, 0)})`);

shopping.updateShoppingItem(shop.find((i) => i.name === "Sardinas")!.id, { purchased: true });
shopping.updateShoppingItem(shop.find((i) => i.name === "Bigas")!.id, { purchased: true });
const checkout = shopping.checkoutShoppingList();
ok(checkout.total === 600, `checkout restock total 600 (got ${checkout.total})`);
const afterCheckout = products.listProducts();
ok(
  afterCheckout.find((p) => p.id === sardinas.id)?.stockStatus === "marami" &&
    afterCheckout.find((p) => p.id === bigas.id)?.stockStatus === "marami" &&
    afterCheckout.find((p) => p.name === "Coffee 3-in-1")?.stockStatus === "sakto",
  "updateStock: purchased → marami, untouched stays sakto"
);
const history = restocks.listRestocks();
ok(history.length === 1, `restock history has 1 entry (got ${history.length})`);
ok((history[0].items ?? []).length === 2, `restock has 2 items (got ${(history[0].items ?? []).length})`);
ok(restocks.getProductRestockHistory(sardinas.id).length === 1, "per-product restock history queryable");
ok(shopping.listShoppingItems().length === 0, "shopping list cleared after checkout");

/* ============ 5. THE BIG ONE — restart persistence ============ */
console.log("\n[5] App restart (close + reopen SQLite file) — no data loss");
await restartApp();
initDb(); // idempotent — must no-op against the migrated file
const uvAfter = shim.getFirstSync("PRAGMA user_version") as { user_version: number };
ok(uvAfter.user_version === 1, "user_version intact after reopen (no re-migration)");
const nenaAfter = customers.listCustomerSummaries().find((c) => c.id === nena.id);
ok(!!nenaAfter, "customer survives restart");
ok(
  nenaAfter?.totalUtang === 275 && nenaAfter?.totalPaid === 100 && nenaAfter?.balance === 175,
  `utang math intact after restart (275/100/175, got ${nenaAfter?.totalUtang}/${nenaAfter?.totalPaid}/${nenaAfter?.balance})`
);
const dayAfter = records.getDay(dayStr);
ok(dayAfter.totals.benta === 370.5 && dayAfter.totals.gastos === 80, "benta/gastos survive restart");
ok(products.listProducts().length === 3, "products survive restart");
ok(restocks.listRestocks().length === 1 && shopping.listShoppingItems().length === 0, "restock history + empty shopping list survive restart");
ok(customers.getCustomerDetail(nena.id)?.transactions.length === 4, "all 4 utang txns survive restart");

/* ============ 6. Suki AI — offline & no-key fallback ============ */
console.log("\n[6] Suki AI graceful degradation");
let threw: any = null;
try {
  await glm.glmChat("sys", "hi");
} catch (e) {
  threw = e;
}
ok(
  threw instanceof glm.AiUnavailableError && threw.message === glm.NO_KEY_MESSAGE,
  "no key → NO_KEY_MESSAGE",
  threw?.message
);

settings.setAiSettings({ apiKey: "sk-test-123", baseUrl: "http://127.0.0.1:9", model: "glm-4.6" });
threw = null;
try {
  await glm.glmChat("sys", "magkano kita ko?");
} catch (e) {
  threw = e;
}
ok(
  threw instanceof glm.AiUnavailableError && threw.message === glm.OFFLINE_MESSAGE,
  "network down → exact OFFLINE_MESSAGE",
  threw?.message
);
ok(
  glm.OFFLINE_MESSAGE === "Offline si Suki ngayon. Available pa rin ang ibang features ng app.",
  "OFFLINE_MESSAGE matches PRD wording"
);
ok(settings.getAiSettings().apiKey === "sk-test-123", "AI key round-trips from app_settings (on-device only)");

aiRepo.addAiMessage("user", "Kumita ako ngayon?");
aiRepo.addAiMessage("assistant", "OO! Tingnan natin ang talaan mo…");
await restartApp();
const convo = aiRepo.listAiMessages();
ok(convo.length === 2 && convo[0].role === "user", `ai_conversations persist across restart (got ${convo.length})`);

/* ============ 7. deterministic budget allocator ============ */
console.log("\n[7] Deterministic restock suggester (₱450 budget)");
const mk = (over: Partial<typeof sardinas & typeof bigas>) => over as never;
const suggestion = suggestRestock(
  450,
  mk({
    products: [
      { id: sardinas.id, name: "Sardinas", stockStatus: "paubos", lastRestockAt: "2026-09-08T10:00:00.000Z", lastRestockQty: 12, lastCost: 25, typicalIntervalDays: null },
      { id: bigas.id, name: "Bigas", stockStatus: "ubos", lastRestockAt: "2026-09-09T10:00:00.000Z", lastRestockQty: 10, lastCost: 55, typicalIntervalDays: null },
    ],
    restockedProductIds30d: [sardinas.id, sardinas.id],
  })
);
ok(suggestion.budget === 450, "suggestion returned for ₱450");
ok(
  suggestion.items.length > 0 && suggestion.items.every((i) => i.estTotal <= 450),
  `items fit budget (${suggestion.items.map((i) => `${i.name}:₱${i.estTotal} [${i.reason}]`).join(", ")})`
);
const itemsSum = suggestion.items.reduce((s, i) => s + i.estTotal, 0);
ok(itemsSum === suggestion.total && suggestion.total <= 450 && suggestion.remaining >= 0, `line sum matches total ≤ 450 (total ${suggestion.total}, remaining ${suggestion.remaining})`);

/* ============ done ============ */
console.log(`\n════════ RESULT: ${pass} passed, ${fail} failed ════════`);
process.exit(fail > 0 ? 1 : 0);
