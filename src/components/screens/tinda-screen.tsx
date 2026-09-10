"use client";

// ── TINDA SCREEN — products + one-tap stock status (Task 2-c) ────

import { useMemo, useState } from "react";
import { Plus, Search, ShoppingBasket } from "lucide-react";

import { ScreenHeader } from "@/components/shared/screen-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useProducts } from "@/hooks/use-store";
import type { Product } from "@/types";

import {
  StatusFilterChips,
  type StatusCounts,
  type StatusFilter,
} from "@/features/products/status-filter-chips";
import { ProductCard } from "@/features/products/product-card";
import { ProductDrawer } from "@/features/products/product-drawer";

type DrawerState = { mode: "create" } | { mode: "edit"; product: Product };

const EMPTY_COUNTS: StatusCounts = { lahat: 0, marami: 0, sakto: 0, paubos: 0, ubos: 0 };

function ProductCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <Skeleton className="mt-2 h-3.5 w-48" />
      <div className="mt-3 grid grid-cols-4 gap-1">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-9 rounded-lg" />
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <Skeleton className="h-9 flex-1 rounded-lg" />
        <Skeleton className="h-9 w-24 rounded-lg" />
      </div>
    </div>
  );
}

export default function TindaScreen() {
  const { data: products, isLoading, isError, error } = useProducts();
  const [filter, setFilter] = useState<StatusFilter>("lahat");
  const [search, setSearch] = useState("");
  const [drawer, setDrawer] = useState<DrawerState | null>(null);

  const counts: StatusCounts = useMemo(() => {
    const c: StatusCounts = { ...EMPTY_COUNTS };
    for (const p of products ?? []) {
      c.lahat += 1;
      c[p.stockStatus] += 1;
    }
    return c;
  }, [products]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (products ?? []).filter(
      (p) =>
        (filter === "lahat" || p.stockStatus === filter) &&
        (!q || p.name.toLowerCase().includes(q))
    );
  }, [products, filter, search]);

  const openCreate = () => setDrawer({ mode: "create" });

  return (
    <>
      <ScreenHeader
        title="Mga Paninda"
        subtitle="Stock status — isang tap lang"
        right={
          <Button
            onClick={openCreate}
            className="h-9 rounded-xl bg-primary px-3 font-bold touch-manipulation active:scale-95"
          >
            <Plus className="size-4" />
            Add
          </Button>
        }
      />

      <div className="px-4 pt-3 pb-8">
        {/* Filter chips */}
        <StatusFilterChips value={filter} onChange={setFilter} counts={counts} />

        {/* Search */}
        <div className="relative mt-3">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Hanapin ang paninda…"
            aria-label="Hanapin ang paninda"
            className="h-11 rounded-xl pl-10"
          />
        </div>

        {/* List */}
        <div className="mt-4 space-y-2">
          {isLoading ? (
            <>
              <ProductCardSkeleton />
              <ProductCardSkeleton />
              <ProductCardSkeleton />
            </>
          ) : isError ? (
            <EmptyState
              icon={ShoppingBasket}
              title="May problema sa pag-load"
              description={
                error instanceof Error ? error.message : "Subukan ulit mamaya."
              }
            />
          ) : (products ?? []).length === 0 ? (
            <EmptyState
              icon={ShoppingBasket}
              title="Wala pang paninda"
              description="Idagdag ang mga paninda mo para masubaybayan ang stock."
              action={
                <Button
                  onClick={openCreate}
                  className="h-11 rounded-xl bg-primary px-5 font-bold touch-manipulation active:scale-[0.98]"
                >
                  <Plus className="size-4" />
                  Add Paninda
                </Button>
              }
            />
          ) : filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Walang tumugma.
            </p>
          ) : (
            filtered.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                onEdit={(prod) => setDrawer({ mode: "edit", product: prod })}
              />
            ))
          )}
        </div>
      </div>

      {/* Add / Edit drawer */}
      <ProductDrawer
        open={drawer !== null}
        onOpenChange={(o) => {
          if (!o) setDrawer(null);
        }}
        product={drawer?.mode === "edit" ? drawer.product : null}
      />
    </>
  );
}
