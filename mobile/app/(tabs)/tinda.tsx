import React, { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Package, Pencil, Plus, Search, ShoppingBasket } from "lucide-react-native";
import { Badge, Button, Card, EmptyState, ScreenHeader, Dot } from "@/components/shared/ui";
import { StockStatusBadge, StockSegmentControl } from "@/components/shared/stock-badge";
import { ProductDrawer } from "@/components/screens/tinda/product-drawer";
import { useTheme } from "@/theme/theme";
import { useToast } from "@/components/shared/toast";
import { useDbQuery, refreshAll } from "@/store/data";
import { listProducts, setStockStatus, deleteProduct } from "@/db/repos/products";
import { addShoppingItem } from "@/db/repos/shopping";
import { AppError } from "@/db/repos/helpers";
import { STOCK_STATUSES, stockStatusMeta, DEFAULT_RESTOCK_QTY, type StockStatus } from "@/logic/constants";
import { formatShortDate, peso } from "@/logic/format";
import { radius } from "@/theme/tokens";

export default function TindaScreen() {
  const { palette } = useTheme();
  const toast = useToast();
  const products = useDbQuery(() => listProducts(), []);
  const [filter, setFilter] = useState<StockStatus | "lahat">("lahat");
  const [search, setSearch] = useState("");
  const [drawerId, setDrawerId] = useState<string | null>(null); // "new" for create
  const [busyRow, setBusyRow] = useState<string | null>(null);

  const counts = useMemo(() => {
    const map: Record<string, number> = { lahat: products?.length ?? 0 };
    for (const s of STOCK_STATUSES) {
      map[s.value] = (products ?? []).filter((p) => p.stockStatus === s.value).length;
    }
    return map;
  }, [products]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (products ?? []).filter(
      (p) =>
        (filter === "lahat" || p.stockStatus === filter) &&
        (!q || p.name.toLowerCase().includes(q))
    );
  }, [products, filter, search]);

  const changeStatus = (id: string, name: string, next: StockStatus) => {
    try {
      setStockStatus(id, next);
      refreshAll();
      toast.success(`${name}: ${stockStatusMeta(next).label}`);
    } catch (e) {
      toast.error(e instanceof AppError ? e.message : "May problema sa server");
    }
  };

  const addToRestock = async (id: string, name: string, qty: number | null, cost: number | null) => {
    setBusyRow(id);
    try {
      addShoppingItem({
        productId: id,
        name,
        qty: qty ?? DEFAULT_RESTOCK_QTY,
        estUnitCost: cost ?? 0,
        source: "low_stock",
      });
      toast.success("Naidagdag sa restock list!");
    } catch (e) {
      toast.error(e instanceof AppError ? e.message : "May problema sa server");
    } finally {
      setBusyRow(null);
    }
  };

  const confirmDelete = (id: string, name: string) => {
    Alert.alert(
      `Burahin si ${name}?`,
      "Hindi na ito maibabalik. Mawawala siya sa listahan ng paninda mo.",
      [
        { text: "Kanselahin", style: "cancel" },
        {
          text: "Burahin",
          style: "destructive",
          onPress: () => {
            try {
              deleteProduct(id);
              refreshAll();
              toast.success("Nabura ang paninda");
              setDrawerId(null);
            } catch (e) {
              toast.error(e instanceof AppError ? e.message : "May problema sa server");
            }
          },
        },
      ]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.background }}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader
          title="Mga Paninda"
          subtitle="Stock status — isang tap lang"
          right={
            <Button
              title="+ Add"
              size="sm"
              icon={<Plus size={14} color={palette.primaryForeground} />}
              onPress={() => setDrawerId("new")}
            />
          }
        />

        {/* Status filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          <FilterChip label={`Lahat (${counts.lahat})`} active={filter === "lahat"} onPress={() => setFilter("lahat")} />
          {STOCK_STATUSES.map((s) => (
            <FilterChip
              key={s.value}
              label={`${s.label} (${counts[s.value] ?? 0})`}
              active={filter === s.value}
              onPress={() => setFilter(s.value)}
            />
          ))}
        </ScrollView>

        {/* Search */}
        <View style={[styles.searchBox, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Search size={16} color={palette.mutedForeground} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Hanapin ang paninda…"
            placeholderTextColor={palette.mutedForeground}
            style={{ flex: 1, fontSize: 13.5, color: palette.foreground, paddingVertical: 10 }}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>

        {(products ?? []).length === 0 ? (
          <EmptyState
            icon={<Package size={28} color={palette.mutedForeground} />}
            title="Wala pang paninda"
            subtitle="Idagdag ang mga paninda mo para masubaybayan ang stock."
            action={<Button title="Add Paninda" onPress={() => setDrawerId("new")} />}
          />
        ) : filtered.length === 0 ? (
          <Text style={{ textAlign: "center", fontSize: 13, color: palette.mutedForeground, paddingVertical: 20 }}>
            Walang tumugma.
          </Text>
        ) : (
          <View style={{ gap: 10 }}>
            {filtered.map((p) => {
              const meta = stockStatusMeta(p.stockStatus);
              return (
                <Card key={p.id} style={{ gap: 10 }}>
                  <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text style={{ fontSize: 14.5, fontWeight: "800", color: palette.foreground, flexShrink: 1 }} numberOfLines={1}>
                          {p.name}
                        </Text>
                        {p.unit ? (
                          <Text style={{ fontSize: 11.5, color: palette.mutedForeground }}>· {p.unit}</Text>
                        ) : null}
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
                        <StockStatusBadge status={p.stockStatus} />
                      </View>
                      <Text style={{ fontSize: 11, color: palette.mutedForeground, marginTop: 4 }} numberOfLines={1}>
                        {p.lastRestockAt
                          ? `Huling restock: ${formatShortDate(p.lastRestockAt)}${p.lastRestockQty ? ` · ${Math.round(p.lastRestockQty)} ${p.unit ?? ""}` : ""}`
                          : "Hindi pa nare-restock"}
                        {p.lastCost ? ` · Presyo: ${peso(p.lastCost)}` : ""}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => setDrawerId(p.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`I-edit si ${p.name}`}
                      hitSlop={8}
                      style={{ padding: 6 }}
                    >
                      <Pencil size={15} color={palette.mutedForeground} />
                    </Pressable>
                  </View>

                  <StockSegmentControl
                    value={p.stockStatus}
                    onChange={(next) => changeStatus(p.id, p.name, next)}
                  />

                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <Button
                      title="Sa Restock List"
                      variant="outline"
                      size="sm"
                      icon={<Plus size={13} color={palette.foreground} />}
                      busy={busyRow === p.id}
                      style={{ flex: 1 }}
                      onPress={() => addToRestock(p.id, p.name, p.lastRestockQty, p.lastCost)}
                    />
                    <Button
                      title="Edit"
                      variant="ghost"
                      size="sm"
                      icon={<Pencil size={13} color={palette.foreground} />}
                      style={{ flex: 1 }}
                      onPress={() => setDrawerId(p.id)}
                    />
                  </View>
                </Card>
              );
            })}
          </View>
        )}
      </ScrollView>

      <ProductDrawer
        visible={drawerId !== null}
        productId={drawerId !== "new" ? drawerId : null}
        onClose={() => setDrawerId(null)}
        onDelete={confirmDelete}
      />
    </View>
  );
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { palette } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      style={{
        backgroundColor: active ? palette.primary : "transparent",
        borderColor: active ? palette.primary : palette.border,
        borderWidth: 1,
        borderRadius: radius.pill,
        paddingHorizontal: 12,
        paddingVertical: 7,
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: active ? "800" : "600", color: active ? palette.primaryForeground : palette.mutedForeground }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 120, gap: 12 },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    minHeight: 44,
  },
});
