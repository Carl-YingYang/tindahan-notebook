"use client";

// ── TanStack Query data hooks for the whole app ──────────────────
// One shared hook module keeps query keys consistent across screens.

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";
import type {
  AiMessage,
  CustomerDetail,
  CustomerSummary,
  Expense,
  Product,
  RestockDTO,
  RestockSuggestion,
  Sale,
  ShoppingItemDTO,
  SummaryData,
} from "@/types";

export const qk = {
  summary: ["summary"] as const,
  customers: ["customers"] as const,
  customer: (id: string) => ["customer", id] as const,
  sales: ["sales"] as const,
  expenses: ["expenses"] as const,
  products: ["products"] as const,
  restocks: ["restocks"] as const,
  shoppingList: ["shopping-list"] as const,
  aiMessages: ["ai-messages"] as const,
  settings: ["settings"] as const,
};

/** Invalidate everything — V1 keeps it simple and always-consistent. */
export function useRefreshAll() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries();
}

export function useSummary() {
  return useQuery({
    queryKey: qk.summary,
    queryFn: () => apiGet<SummaryData>("/api/summary"),
    staleTime: 5_000,
  });
}

export function useCustomers() {
  return useQuery({
    queryKey: qk.customers,
    queryFn: () => apiGet<CustomerSummary[]>("/api/customers"),
  });
}

export function useCustomerDetail(id: string | null) {
  return useQuery({
    queryKey: qk.customer(id ?? "none"),
    queryFn: () => apiGet<CustomerDetail>(`/api/customers/${id}`),
    enabled: !!id,
  });
}

export function useSales() {
  return useQuery({
    queryKey: qk.sales,
    queryFn: () => apiGet<Sale[]>("/api/sales?limit=60"),
  });
}

export function useExpenses() {
  return useQuery({
    queryKey: qk.expenses,
    queryFn: () => apiGet<Expense[]>("/api/expenses?limit=60"),
  });
}

export function useProducts() {
  return useQuery({
    queryKey: qk.products,
    queryFn: () => apiGet<Product[]>("/api/products"),
  });
}

export function useRestocks() {
  return useQuery({
    queryKey: qk.restocks,
    queryFn: () => apiGet<RestockDTO[]>("/api/restocks?limit=15"),
  });
}

export function useShoppingList() {
  return useQuery({
    queryKey: qk.shoppingList,
    queryFn: () => apiGet<ShoppingItemDTO[]>("/api/shopping-list"),
  });
}

export function useAiMessages() {
  return useQuery({
    queryKey: qk.aiMessages,
    queryFn: () => apiGet<AiMessage[]>("/api/ai/chat"),
  });
}

export async function fetchRestockSuggestion(budget: number): Promise<RestockSuggestion> {
  return apiPost<RestockSuggestion>("/api/suggestions/restock", { budget });
}

export interface AppSettings {
  weeklyBentaTarget: number | null;
}

export function useSettings() {
  return useQuery({
    queryKey: qk.settings,
    queryFn: () => apiGet<AppSettings>("/api/settings"),
    staleTime: 30_000,
  });
}

/** Save the weekly benta target (null clears it). Updates the cache in place. */
export function useSetWeeklyTarget() {
  const qc = useQueryClient();
  return async function (weeklyBentaTarget: number | null) {
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weeklyBentaTarget }),
    });
    const data = (await res.json().catch(() => null)) as
      | (AppSettings & { error?: string })
      | null;
    if (!res.ok) {
      throw new Error(data?.error || "May problema sa server");
    }
    qc.setQueryData<AppSettings>(qk.settings, {
      weeklyBentaTarget: data?.weeklyBentaTarget ?? null,
    });
    return data?.weeklyBentaTarget ?? null;
  };
}
