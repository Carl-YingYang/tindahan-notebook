/** Local SQLite schema — mirrors prisma/schema.prisma of the web prototype. */

export interface Migration {
  version: number;
  statements: string[];
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    statements: [
      `CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        note TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_customers_name ON customers (name)`,
      `CREATE TABLE IF NOT EXISTS utang_transactions (
        id TEXT PRIMARY KEY NOT NULL,
        customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        amount REAL NOT NULL,
        note TEXT,
        due_date TEXT,
        date TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_utang_customer_date ON utang_transactions (customer_id, date)`,
      `CREATE INDEX IF NOT EXISTS idx_utang_due ON utang_transactions (due_date)`,
      `CREATE TABLE IF NOT EXISTS sales (
        id TEXT PRIMARY KEY NOT NULL,
        amount REAL NOT NULL,
        category TEXT,
        note TEXT,
        date TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_sales_date ON sales (date)`,
      `CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY NOT NULL,
        amount REAL NOT NULL,
        category TEXT NOT NULL,
        note TEXT,
        date TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses (date)`,
      `CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        unit TEXT,
        stock_status TEXT NOT NULL DEFAULT 'sakto',
        last_restock_at TEXT,
        last_restock_qty REAL,
        last_cost REAL,
        typical_interval_days INTEGER,
        note TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_products_stock ON products (stock_status)`,
      `CREATE TABLE IF NOT EXISTS restocks (
        id TEXT PRIMARY KEY NOT NULL,
        source TEXT NOT NULL DEFAULT 'manual',
        supplier TEXT,
        note TEXT,
        total REAL NOT NULL DEFAULT 0,
        date TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS restock_items (
        id TEXT PRIMARY KEY NOT NULL,
        restock_id TEXT NOT NULL REFERENCES restocks(id) ON DELETE CASCADE,
        product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
        name TEXT NOT NULL,
        qty REAL NOT NULL,
        unit_price REAL NOT NULL DEFAULT 0,
        total REAL NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_restock_items_restock ON restock_items (restock_id)`,
      `CREATE TABLE IF NOT EXISTS shopping_list_items (
        id TEXT PRIMARY KEY NOT NULL,
        product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
        name TEXT NOT NULL,
        qty REAL,
        est_unit_cost REAL,
        est_total REAL NOT NULL DEFAULT 0,
        purchased INTEGER NOT NULL DEFAULT 0,
        source TEXT NOT NULL DEFAULT 'manual',
        purchased_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_shopping_purchased ON shopping_list_items (purchased)`,
      `CREATE TABLE IF NOT EXISTS ai_conversations (
        id TEXT PRIMARY KEY NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      )`,
    ],
  },
];
