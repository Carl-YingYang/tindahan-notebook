// ── Shared types for Tindahan Ko ─────────────────────────────────
// Dates are serialized as ISO strings over the API.

export type StockStatus = "marami" | "sakto" | "paubos" | "ubos";
export type UtangTxnType = "utang" | "payment";
export type RestockSource = "manual" | "receipt" | "shopping_list";
export type ShoppingSource = "manual" | "low_stock" | "ai";

// ── Utang ────────────────────────────────────────────────────────

export interface CustomerSummary {
  id: string;
  name: string;
  note?: string | null;
  /** Joined notes from the customer's transactions (powers note search) */
  notes?: string;
  balance: number;
  totalUtang: number;
  totalPaid: number;
  txnCount: number;
  lastActivityAt: string | null;
  /** Earliest "kailan bayad" among the customer's utang records (only when balance > 0) */
  dueDate?: string | null;
  createdAt: string;
}

export interface UtangTxn {
  id: string;
  customerId: string;
  type: UtangTxnType;
  amount: number;
  note?: string | null;
  dueDate?: string | null;
  date: string;
  createdAt: string;
}

export interface CustomerDetail {
  customer: CustomerSummary;
  transactions: UtangTxn[];
  balance: number;
}

// ── Benta / Gastos ───────────────────────────────────────────────

export interface Sale {
  id: string;
  amount: number;
  category?: string | null;
  note?: string | null;
  date: string;
}

export interface Expense {
  id: string;
  amount: number;
  category: string;
  note?: string | null;
  date: string;
}

export interface DayTotals {
  benta: number;
  gastos: number;
  net: number;
}

export interface DailyBucket {
  date: string; // yyyy-mm-dd (Manila)
  label: string; // Mon, Tue...
  benta: number;
  gastos: number;
}

export interface SummaryData {
  today: DayTotals;
  week: DayTotals;
  weekDaily: DailyBucket[];
  utang: {
    outstanding: number;
    customerCount: number;
    topCustomers: { id: string; name: string; balance: number }[];
    /** Suki (balance > 0) whose earliest due date is today or earlier */
    dueCount: number;
    dueTotal: number;
  };
  stock: {
    marami: number;
    sakto: number;
    paubos: number;
    ubos: number;
    total: number;
  };
  shopping: {
    pendingCount: number;
    pendingEstTotal: number;
  };
}

// ── Tinda / Products ─────────────────────────────────────────────

export interface Product {
  id: string;
  name: string;
  unit?: string | null;
  stockStatus: StockStatus;
  lastRestockAt: string | null;
  lastRestockQty: number | null;
  lastCost: number | null;
  typicalIntervalDays: number | null;
  note?: string | null;
  daysSinceRestock: number | null;
  createdAt: string;
}

// ── Restocks ─────────────────────────────────────────────────────

export interface RestockItemDTO {
  id?: string;
  productId?: string | null;
  name: string;
  qty: number;
  unitPrice: number;
  total: number;
}

export interface RestockDTO {
  id: string;
  source: RestockSource;
  supplier?: string | null;
  note?: string | null;
  total: number;
  date: string;
  items: RestockItemDTO[];
}

// ── Shopping / Restock List ──────────────────────────────────────

export interface ShoppingItemDTO {
  id: string;
  productId?: string | null;
  name: string;
  qty?: number | null;
  estUnitCost?: number | null;
  estTotal: number;
  purchased: boolean;
  source: ShoppingSource;
  createdAt: string;
}

// ── Suki AI ──────────────────────────────────────────────────────

export interface SuggestionLine {
  productId?: string | null;
  name: string;
  qty: number;
  estUnitCost: number;
  estTotal: number;
  reason: string; // paubos | ubos | frequent | regular
  reasonLabel: string; // Taglish reason
}

export interface RestockSuggestion {
  budget: number;
  items: SuggestionLine[];
  total: number;
  remaining: number;
}

export interface AiMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

// ── OCR ──────────────────────────────────────────────────────────

export interface OcrItem {
  name: string;
  qty?: number | null;
  unitPrice?: number | null;
  total?: number | null;
}

export interface OcrResult {
  items: OcrItem[];
  rawText?: string;
  provider: string;
}
