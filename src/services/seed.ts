import { db } from "@/lib/db";

// ── Realistic sample data for a Filipino sari-sari store ─────────
// ensureSeeded() is idempotent: it only runs once (app_settings flag)
// and is safe to call at the top of every GET route.

const DAYS = 24 * 60 * 60 * 1000;

function daysAgo(n: number, hour = 10): Date {
  const d = new Date(Date.now() - n * DAYS);
  d.setHours(hour, Math.floor(Math.random() * 50), 0, 0);
  return d;
}

export async function ensureSeeded(): Promise<void> {
  try {
    const flag = await db.appSetting.findUnique({ where: { key: "seeded" } });
    if (flag) return;
    await seedAll();
    await db.appSetting.upsert({
      where: { key: "seeded" },
      create: { key: "seeded", value: "1" },
      update: { value: "1" },
    });
  } catch (e) {
    console.error("[seed] failed:", e);
  }
}

export async function resetAndSeed(): Promise<void> {
  await db.$transaction([
    db.aiConversation.deleteMany(),
    db.shoppingListItem.deleteMany(),
    db.restockItem.deleteMany(),
    db.restock.deleteMany(),
    db.utangTransaction.deleteMany(),
    db.customer.deleteMany(),
    db.sale.deleteMany(),
    db.expense.deleteMany(),
    db.product.deleteMany(),
    db.appSetting.deleteMany(),
  ]);
  await seedAll();
  await db.appSetting.upsert({
    where: { key: "seeded" },
    create: { key: "seeded", value: "1" },
    update: { value: "1" },
  });
}

async function seedAll(): Promise<void> {
  // ── Products ──────────────────────────────────────────────────
  const productDefs = [
    { name: "Coke Mismo", unit: "bote", stockStatus: "paubos", lastCost: 12.5, lastRestockQty: 24, lastRestockAt: daysAgo(12), typicalIntervalDays: 7 },
    { name: "Lucky Me Pancit Canton", unit: "pack", stockStatus: "sakto", lastCost: 9, lastRestockQty: 48, lastRestockAt: daysAgo(12), typicalIntervalDays: 10 },
    { name: "Coffee 3-in-1 sachet", unit: "sachet", stockStatus: "paubos", lastCost: 7.5, lastRestockQty: 60, lastRestockAt: daysAgo(15), typicalIntervalDays: 12 },
    { name: "Bear Brand sachet", unit: "sachet", stockStatus: "marami", lastCost: 11, lastRestockQty: 36, lastRestockAt: daysAgo(12), typicalIntervalDays: 14 },
    { name: "Sky Flakes", unit: "pack", stockStatus: "sakto", lastCost: 8, lastRestockQty: 40, lastRestockAt: daysAgo(12), typicalIntervalDays: 10 },
    { name: "Piattos", unit: "pcs", stockStatus: "marami", lastCost: 12, lastRestockQty: 30, lastRestockAt: daysAgo(8), typicalIntervalDays: 9 },
    { name: "Yakult", unit: "bote", stockStatus: "sakto", lastCost: 8, lastRestockQty: 24, lastRestockAt: daysAgo(6), typicalIntervalDays: 7 },
    { name: "Safeguard", unit: "pcs", stockStatus: "ubos", lastCost: 25, lastRestockQty: 12, lastRestockAt: daysAgo(25), typicalIntervalDays: 20 },
    { name: "Kopiko Brown Coffee", unit: "sachet", stockStatus: "marami", lastCost: 8, lastRestockQty: 30, lastRestockAt: daysAgo(5), typicalIntervalDays: 12 },
    { name: "Rebisco Crackers", unit: "pack", stockStatus: "sakto", lastCost: 7, lastRestockQty: 36, lastRestockAt: daysAgo(20), typicalIntervalDays: 15 },
  ];

  const products: Record<string, string> = {};
  for (const p of productDefs) {
    const created = await db.product.create({ data: p });
    products[p.name] = created.id;
  }

  // ── Restocks ──────────────────────────────────────────────────
  const restockDefs = [
    {
      source: "manual",
      supplier: "Tindahan ni Aling Rosa",
      note: "Linggong restock",
      date: daysAgo(12, 9),
      items: [
        { name: "Coke Mismo", qty: 24, unitPrice: 12.5 },
        { name: "Lucky Me Pancit Canton", qty: 48, unitPrice: 9 },
        { name: "Coffee 3-in-1 sachet", qty: 60, unitPrice: 7.5 },
        { name: "Bear Brand sachet", qty: 36, unitPrice: 11 },
        { name: "Sky Flakes", qty: 40, unitPrice: 8 },
      ],
    },
    {
      source: "manual",
      supplier: "Yakult lady",
      note: "Weekly Yakult",
      date: daysAgo(6, 8),
      items: [{ name: "Yakult", qty: 24, unitPrice: 8 }],
    },
    {
      source: "manual",
      supplier: "Grocery depot",
      note: null,
      date: daysAgo(25, 15),
      items: [
        { name: "Safeguard", qty: 12, unitPrice: 25 },
        { name: "Rebisco Crackers", qty: 36, unitPrice: 7 },
      ],
    },
  ];

  for (const r of restockDefs) {
    const total = r.items.reduce((s, i) => s + i.qty * i.unitPrice, 0);
    const restock = await db.restock.create({
      data: { source: r.source, supplier: r.supplier, note: r.note, date: r.date, total },
    });
    for (const item of r.items) {
      await db.restockItem.create({
        data: {
          restockId: restock.id,
          productId: products[item.name] ?? null,
          name: item.name,
          qty: item.qty,
          unitPrice: item.unitPrice,
          total: item.qty * item.unitPrice,
        },
      });
    }
  }

  // ── Customers + Utang ─────────────────────────────────────────
  const juan = await db.customer.create({ data: { name: "Juan Dela Cruz", note: " Kapitbahay sa may kanto" } });
  const maria = await db.customer.create({ data: { name: "Maria Santos" } });
  const pedro = await db.customer.create({ data: { name: "Pedro Reyes", note: "Tricycle driver" } });
  const kap = await db.customer.create({ data: { name: "Kap Bogart" } });

  const txn = (
    customerId: string,
    type: "utang" | "payment",
    amount: number,
    note: string | null,
    date: Date,
    dueDate?: Date | null
  ) =>
    db.utangTransaction.create({ data: { customerId, type, amount, note, date, dueDate: dueDate ?? null } });

  await Promise.all([
    txn(juan.id, "utang", 120, "2 Lucky Me, 1 Coke", daysAgo(3, 17), daysAgo(2, 18)), // late — demo due-date tracking
    txn(juan.id, "utang", 85, "Kape at tinapay", daysAgo(1, 8)),
    txn(juan.id, "payment", 50, "Hulog muna", daysAgo(0, 9)),
    txn(maria.id, "utang", 200, "Grocery-list", daysAgo(5, 14)),
    txn(maria.id, "payment", 200, "Bayad na", daysAgo(2, 11)),
    txn(pedro.id, "utang", 60, "2 Kopiko, 1 Yakult", daysAgo(2, 19), new Date()), // due ngayon
    txn(kap.id, "utang", 500, "Para sa handaan", daysAgo(10, 16), new Date(Date.now() + 5 * 864e5)), // due sa 5 araw
    txn(kap.id, "payment", 150, "Parte", daysAgo(4, 12)),
  ]);

  // ── Sales (last 7 days, incl. today) ──────────────────────────
  const sales: { amount: number; category: string; note: string | null; date: Date }[] = [
    { amount: 240, category: "Tindahan", note: null, date: daysAgo(6, 10) },
    { amount: 150, category: "Load", note: "GCash load", date: daysAgo(6, 15) },
    { amount: 320, category: "Tindahan", note: null, date: daysAgo(5, 11) },
    { amount: 95, category: "Tindahan", note: "Meryenda ng bata", date: daysAgo(4, 9) },
    { amount: 410, category: "Tindahan", note: "Kap Bogart handaan", date: daysAgo(4, 17) },
    { amount: 180, category: "Tindahan", note: null, date: daysAgo(3, 10) },
    { amount: 120, category: "Load", note: null, date: daysAgo(3, 14) },
    { amount: 265, category: "Tindahan", note: null, date: daysAgo(2, 10) },
    { amount: 90, category: "Tindahan", note: "Yakult atSky Flakes", date: daysAgo(1, 9) },
    { amount: 340, category: "Tindahan", note: null, date: daysAgo(1, 16) },
    { amount: 110, category: "Load", note: "Regular suki", date: daysAgo(1, 18) },
    { amount: 185, category: "Tindahan", note: "Umaga pa lang", date: daysAgo(0, 8) },
    { amount: 75, category: "Tindahan", note: "Coke at chichirya", date: daysAgo(0, 10) },
  ];
  for (const s of sales) await db.sale.create({ data: s });

  // ── Expenses ──────────────────────────────────────────────────
  const expenses: { amount: number; category: string; note: string | null; date: Date }[] = [
    { amount: 1200, category: "Restock", note: "Aling Rosa", date: daysAgo(6, 9) },
    { amount: 350, category: "Kuryente", note: "Meralco", date: daysAgo(3, 13) },
    { amount: 60, category: "Transportasyon", note: "Tricycle papuntang depot", date: daysAgo(1, 7) },
    { amount: 100, category: "Load", note: "Pang-load na wallet", date: daysAgo(1, 12) },
    { amount: 40, category: "Transportasyon", note: null, date: daysAgo(0, 7) },
  ];
  for (const e of expenses) await db.expense.create({ data: e });

  // ── Shopping / Restock list ───────────────────────────────────
  await db.shoppingListItem.createMany({
    data: [
      { productId: products["Coke Mismo"], name: "Coke Mismo", qty: 24, estUnitCost: 12.5, estTotal: 300, source: "low_stock" },
      { productId: products["Safeguard"], name: "Safeguard", qty: 12, estUnitCost: 25, estTotal: 300, source: "low_stock" },
      { productId: null, name: "Plastic bag (malaki)", qty: 50, estUnitCost: 1, estTotal: 50, source: "manual" },
    ],
  });
}
