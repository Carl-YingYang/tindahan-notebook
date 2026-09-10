import type { RestockSource, ShoppingSource, StockStatus, UtangTxnType } from "@/logic/constants";

export interface CustomerSummary {
  id: string;
  name: string;
  note: string | null;
  /** joined per-txn notes blob (newest first, " · ") — powers search */
  notes: string;
  balance: number;
  totalUtang: number;
  totalPaid: number;
  txnCount: number;
  lastActivityAt: string | null;
  /** earliest due among utang records — only surfaced when balance > 0 */
  dueDate: string | null;
  createdAt: string;
}

export interface UtangTxn {
  id: string;
  customerId: string;
  type: UtangTxnType;
  amount: number;
  note: string | null;
  dueDate: string | null;
  date: string;
  createdAt: string;
}

export interface CustomerDetail {
  customer: CustomerSummary;
  transactions: UtangTxn[];
  balance: number;
}

export interface Sale {
  id: string;
  amount: number;
  category: string | null;
  note: string | null;
  date: string;
  createdAt: string;
}

export type Expense = Sale;

export interface DayDetail {
  date: string;
  sales: Sale[];
  expenses: Expense[];
  totals: { benta: number; gastos: number; net: number };
}

export interface DailyBucket {
  /** yyyy-mm-dd Manila */
  date: string;
  label: string;
  benta: number;
  gastos: number;
}

export interface SummaryData {
  today: { benta: number; gastos: number; net: number };
  week: { benta: number; gastos: number; net: number };
  weekDaily: DailyBucket[];
  utang: {
    outstanding: number;
    customerCount: number;
    topCustomers: { id: string; name: string; balance: number }[];
    dueCount: number;
    dueTotal: number;
  };
  stock: { marami: number; sakto: number; paubos: number; ubos: number; total: number };
  shopping: { pendingCount: number; pendingEstTotal: number };
}

export interface MonthDailyRow {
  date: string;
  label: string;
  day: number;
  benta: number;
  gastos: number;
  net: number;
}

export interface MonthReport {
  month: string;
  label: string;
  benta: number;
  gastos: number;
  net: number;
  salesCount: number;
  expensesCount: number;
  activeDays: number;
  daysInMonth: number;
  avgDailyNet: number;
  bestDay: { date: string; benta: number } | null;
  gastosByCategory: { category: string; total: number }[];
  bentaByCategory: { category: string; total: number }[];
  daily: MonthDailyRow[];
  topExpenses: Expense[];
  transactions: Array<{ kind: "benta" | "gastos"; id: string; amount: number; category: string | null; note: string | null; date: string }>;
}

export interface Product {
  id: string;
  name: string;
  unit: string | null;
  stockStatus: StockStatus;
  lastRestockAt: string | null;
  lastRestockQty: number | null;
  lastCost: number | null;
  typicalIntervalDays: number | null;
  note: string | null;
  createdAt: string;
  daysSinceRestock: number | null;
}

export interface RestockItemDTO {
  id: string;
  productId: string | null;
  name: string;
  qty: number;
  unitPrice: number;
  total: number;
  createdAt: string;
}

export interface RestockDTO {
  id: string;
  source: RestockSource;
  supplier: string | null;
  note: string | null;
  total: number;
  date: string;
  createdAt: string;
  items: RestockItemDTO[];
}

export interface ProductRestockEntry {
  restock: RestockDTO;
  item: RestockItemDTO;
}

export interface ShoppingItemDTO {
  id: string;
  productId: string | null;
  name: string;
  qty: number | null;
  estUnitCost: number | null;
  estTotal: number;
  purchased: boolean;
  source: ShoppingSource;
  purchasedAt: string | null;
  createdAt: string;
}

export interface AiMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface AiSettings {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface NewRestockItemInput {
  productId?: string | null;
  name: string;
  qty: number;
  unitPrice: number;
}
