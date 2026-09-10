import React, { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Minus,
  PackageOpen,
  PackagePlus,
  Plus,
  ScanLine,
  Sparkles,
  Trash2,
} from "lucide-react-native";
import { useTheme } from "@/theme/theme";
import { radius } from "@/theme/tokens";
import {
  Badge,
  Button,
  Card,
  Dot,
  EmptyState,
  ScreenHeader,
  SectionHeader,
  moneyText,
} from "@/components/shared/ui";
import { StockStatusBadge } from "@/components/shared/stock-badge";
import { useToast } from "@/components/shared/toast";
import { useDbQuery } from "@/store/data";
import {
  DEFAULT_RESTOCK_QTY,
  RESTOCK_SOURCE_META,
  stockStatusMeta,
} from "@/logic/constants";
import { peso, formatDayLabel } from "@/logic/format";
import { listProducts } from "@/db/repos/products";
import { deleteRestock, listRestocks } from "@/db/repos/restocks";
import {
  addShoppingItem,
  checkoutShoppingList,
  deleteShoppingItem,
  listShoppingItems,
  updateShoppingItem,
} from "@/db/repos/shopping";
import { ReceiptScannerSheet } from "@/components/screens/restock-scanner-sheet";
import { ManualRestockSheet } from "@/components/screens/manual-restock-sheet";
import type { Product, RestockDTO, ShoppingItemDTO } from "@/types";

// ── Restock tab — Kailangan ng Bili, Restock List, Checkout, History ──
// 1:1 port of the approved web restock screen (incl. receipt scanner +
// manual restock entry points, and the Home "scan" deep-link intent).

/** Outline icon button (web parity for the header's size-icon outline Button). */
function IconButton({
  onPress,
  accessibilityLabel,
  children,
}: {
  onPress: () => void;
  accessibilityLabel: string;
  children: React.ReactNode;
}) {
  const { palette } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => ({
        width: 40,
        height: 40,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: palette.border,
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {children}
    </Pressable>
  );
}

/** One "Kailangan ng Bili" row — low/ubos product with quick add. */
function LowStockRow({
  product,
  adding,
  onAdd,
}: {
  product: Product;
  adding: boolean;
  onAdd: () => void;
}) {
  const { palette } = useTheme();
  const meta = stockStatusMeta(product.stockStatus);
  return (
    <View style={styles.listRow}>
      <Dot tone={meta.tone} />
      <View style={styles.rowMain}>
        <Text numberOfLines={1} style={[styles.rowName, { color: palette.foreground }]}>
          {product.name}
        </Text>
        <View style={styles.rowSubRow}>
          <StockStatusBadge status={product.stockStatus} />
          <Text style={[styles.rowSubText, { color: palette.mutedForeground, fontVariant: ["tabular-nums"] }]}>
            {product.daysSinceRestock ?? "—"} araw na
          </Text>
        </View>
      </View>
      <Button title="Add +" variant="primary" size="sm" busy={adding} onPress={onAdd} />
    </View>
  );
}

/** One Restock List row — checkbox, qty stepper, est total, remove. */
function ShoppingRow({
  item,
  qtyValue,
  onQtyChange,
  onCommitQty,
  onToggle,
  onQtyStep,
  onRemove,
}: {
  item: ShoppingItemDTO;
  qtyValue: string;
  onQtyChange: (t: string) => void;
  onCommitQty: () => void;
  onToggle: () => void;
  onQtyStep: (delta: number) => void;
  onRemove: () => void;
}) {
  const { palette } = useTheme();
  return (
    <View style={[styles.listRow, styles.shoppingRow, item.purchased && { opacity: 0.55 }]}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: item.purchased }}
        accessibilityLabel={`Markahang nabili: ${item.name}`}
        hitSlop={6}
        style={[
          styles.checkbox,
          item.purchased
            ? {
                backgroundColor: palette.tones.emerald.solid,
                borderColor: palette.tones.emerald.solid,
              }
            : { backgroundColor: "transparent", borderColor: palette.border },
        ]}
      >
        {item.purchased ? <Check size={16} color="#ffffff" /> : null}
      </Pressable>

      <View style={styles.rowMain}>
        <View style={styles.nameRow}>
          {item.source === "ai" ? <Sparkles size={14} color={palette.primary} /> : null}
          {item.source === "low_stock" ? (
            <AlertTriangle size={14} color={palette.tones.orange.solid} />
          ) : null}
          <Text numberOfLines={1} style={[styles.rowName, { color: palette.foreground, flexShrink: 1 }]}>
            {item.name}
          </Text>
        </View>
        {!!item.estUnitCost && item.estUnitCost > 0 ? (
          <Text style={[styles.rowSubText, { color: palette.mutedForeground, fontVariant: ["tabular-nums"] }]}>
            {`est. ${peso(item.estUnitCost)} bawat isa`}
          </Text>
        ) : null}
      </View>

      <View style={styles.stepper}>
        <Pressable
          onPress={() => onQtyStep(-1)}
          accessibilityRole="button"
          accessibilityLabel="Bawasan ang qty"
          hitSlop={4}
          style={({ pressed }) => [
            styles.stepperBtn,
            { borderColor: palette.border, opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <Minus size={14} color={palette.mutedForeground} />
        </Pressable>
        <TextInput
          value={qtyValue}
          onChangeText={onQtyChange}
          onBlur={onCommitQty}
          onSubmitEditing={onCommitQty}
          keyboardType="numeric"
          returnKeyType="done"
          accessibilityLabel={`Qty ng ${item.name}`}
          style={[styles.qtyInput, { borderColor: palette.border, color: palette.foreground }]}
        />
        <Pressable
          onPress={() => onQtyStep(1)}
          accessibilityRole="button"
          accessibilityLabel="Dagdagan ang qty"
          hitSlop={4}
          style={({ pressed }) => [
            styles.stepperBtn,
            { borderColor: palette.border, opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <Plus size={14} color={palette.mutedForeground} />
        </Pressable>
      </View>

      <Text style={[moneyText, styles.lineTotal, { color: palette.foreground }]}>
        {peso(item.estTotal)}
      </Text>

      <Pressable
        onPress={onRemove}
        accessibilityRole="button"
        accessibilityLabel={`Tanggalin si ${item.name}`}
        hitSlop={4}
        style={({ pressed }) => [styles.trashBtn, { opacity: pressed ? 0.6 : 1 }]}
      >
        <Trash2 size={16} color={palette.tones.rose.solid} />
      </Pressable>
    </View>
  );
}

export default function RestockScreen() {
  const { palette } = useTheme();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ intent?: string }>();
  const router = useRouter();

  const products = useDbQuery(() => listProducts(), []);
  const shoppingItems = useDbQuery(() => listShoppingItems(), []);
  const restocks = useDbQuery(() => listRestocks(15), []);

  const [scannerOpen, setScannerOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [qtyDraft, setQtyDraft] = useState<Record<string, string>>({});

  // Home screen "Scan Resibo" intent → auto-open the scanner once.
  useEffect(() => {
    if (params.intent === "scan") {
      setScannerOpen(true);
      router.setParams({ intent: undefined });
    }
  }, [params.intent, router]);

  const lowStock = useMemo(() => {
    return (products ?? [])
      .filter((p) => p.stockStatus === "paubos" || p.stockStatus === "ubos")
      .sort((a, b) => {
        if (a.stockStatus !== b.stockStatus) return a.stockStatus === "ubos" ? -1 : 1;
        const da = a.daysSinceRestock ?? 999;
        const db = b.daysSinceRestock ?? 999;
        if (da !== db) return db - da;
        return a.name.localeCompare(b.name);
      });
  }, [products]);

  const items = shoppingItems ?? [];
  const pending = useMemo(() => items.filter((i) => !i.purchased), [items]);
  const purchased = useMemo(() => items.filter((i) => i.purchased), [items]);
  const pendingEstTotal = useMemo(
    () => pending.reduce((sum, i) => sum + (Number(i.estTotal) || 0), 0),
    [pending]
  );
  const purchasedTotal = useMemo(
    () => purchased.reduce((sum, i) => sum + (Number(i.estTotal) || 0), 0),
    [purchased]
  );

  // ── Mutations (repos are sync; AppError carries a Taglish message) ──
  const addLowStockToList = (p: Product) => {
    setAddingId(p.id);
    try {
      addShoppingItem({
        productId: p.id,
        name: p.name,
        qty: p.lastRestockQty ?? DEFAULT_RESTOCK_QTY,
        estUnitCost: p.lastCost ?? 0,
        source: "low_stock",
      });
      toast.success(`Naidagdag sa restock list: ${p.name}`);
      try {
        void Haptics.selectionAsync();
      } catch {
        // non-fatal
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Hindi maidagdag, subukan ulit");
    } finally {
      setAddingId(null);
    }
  };

  const togglePurchased = (item: ShoppingItemDTO) => {
    try {
      updateShoppingItem(item.id, { purchased: !item.purchased });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Hindi ma-update, subukan ulit");
    }
  };

  const patchQty = (item: ShoppingItemDTO, next: number) => {
    const qty = Math.max(1, Math.round(next) || 1);
    try {
      updateShoppingItem(item.id, { qty });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Hindi ma-update ang qty, subukan ulit");
    }
  };

  const commitQtyDraft = (item: ShoppingItemDTO) => {
    const raw = qtyDraft[item.id];
    if (raw === undefined) return;
    const next = { ...qtyDraft };
    delete next[item.id];
    setQtyDraft(next);
    const parsed = parseInt(raw, 10);
    const current = item.qty ?? 1;
    if (Number.isFinite(parsed) && parsed !== current) patchQty(item, parsed);
  };

  const removeShoppingItem = (item: ShoppingItemDTO) => {
    try {
      deleteShoppingItem(item.id);
      toast.success(`Natanggal sa listahan: ${item.name}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Hindi matanggal, subukan ulit");
    }
  };

  const confirmCheckout = () => {
    Alert.alert(
      "I-checkout ang mga Nabili?",
      `Gagawing restock record ang ${purchased.length} na item na nabili? Ia-update din ang stock status nila.`,
      [
        { text: "Kanselahin", style: "cancel" },
        {
          text: "Oo, i-checkout",
          style: "destructive",
          onPress: () => {
            setCheckingOut(true);
            try {
              const restock = checkoutShoppingList();
              toast.success(`Nai-record ang restock — ${peso(restock.total)}`);
              try {
                void Haptics.selectionAsync();
              } catch {
                // non-fatal
              }
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Hindi ma-checkout, subukan ulit");
            } finally {
              setCheckingOut(false);
            }
          },
        },
      ]
    );
  };

  const confirmDeleteRestock = (r: RestockDTO) => {
    Alert.alert("Burahin ang restock?", "Hindi na ito maibabalik.", [
      { text: "Kanselahin", style: "cancel" },
      {
        text: "Burahin",
        style: "destructive",
        onPress: () => {
          try {
            deleteRestock(r.id);
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Hindi mabura, subukan ulit");
          }
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.background }}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: 16 + insets.top, paddingBottom: 110 + insets.bottom },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader
          title="Restock"
          subtitle="Bantayan ang stock at bilihin"
          right={
            <>
              <Button
                title="Scan Resibo"
                variant="primary"
                size="sm"
                icon={<ScanLine size={16} color={palette.primaryForeground} />}
                onPress={() => setScannerOpen(true)}
              />
              <IconButton onPress={() => setManualOpen(true)} accessibilityLabel="Manual na restock">
                <PackagePlus size={16} color={palette.foreground} />
              </IconButton>
            </>
          }
        />

        {/* ── Kailangan ng Bili ── */}
        <View style={styles.section}>
          <SectionHeader title="Kailangan ng Bili" subtitle="Paubos o ubos na paninda" />
          {lowStock.length === 0 ? (
            <Card>
              <View style={styles.okRow}>
                <CheckCircle2 size={18} color={palette.tones.emerald.solid} />
                <Text style={[styles.okText, { color: palette.mutedForeground }]}>
                  Okay ang stock, walang paubos!
                </Text>
              </View>
            </Card>
          ) : (
            <View style={[styles.listGroup, { backgroundColor: palette.card, borderColor: palette.border }]}>
              {lowStock.map((p, idx) => (
                <View
                  key={p.id}
                  style={
                    idx < lowStock.length - 1
                      ? [styles.rowWrapper, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border }]
                      : styles.rowWrapper
                  }
                >
                  <LowStockRow
                    product={p}
                    adding={addingId === p.id}
                    onAdd={() => addLowStockToList(p)}
                  />
                </View>
              ))}
            </View>
          )}
        </View>

        {/* ── Restock List ── */}
        <View style={styles.section}>
          <SectionHeader
            title="Restock List"
            subtitle="Itakda ang qty, markahan kapag nabili"
            action={
              <Text style={[styles.estimateText, { color: palette.mutedForeground }]}>
                {`Estimated: ${peso(pendingEstTotal)}`}
              </Text>
            }
          />
          {items.length === 0 ? (
            <Card>
              <Text style={[styles.emptyCardText, { color: palette.mutedForeground }]}>
                Wala pang item sa listahan — dagdagan mula sa Kailangan ng Bili.
              </Text>
            </Card>
          ) : (
            <View style={[styles.listGroup, { backgroundColor: palette.card, borderColor: palette.border }]}>
              {items.map((item, idx) => (
                <View
                  key={item.id}
                  style={
                    idx < items.length - 1
                      ? [styles.shoppingRowWrapper, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border }]
                      : styles.shoppingRowWrapper
                  }
                >
                  <ShoppingRow
                    item={item}
                    qtyValue={qtyDraft[item.id] ?? String(item.qty ?? 1)}
                    onQtyChange={(t) =>
                      setQtyDraft((d) => ({ ...d, [item.id]: t.replace(/[^0-9]/g, "") }))
                    }
                    onCommitQty={() => commitQtyDraft(item)}
                    onToggle={() => togglePurchased(item)}
                    onQtyStep={(delta) => patchQty(item, (item.qty ?? 1) + delta)}
                    onRemove={() => removeShoppingItem(item)}
                  />
                </View>
              ))}
            </View>
          )}

          {/* Checkout footer card */}
          <Card>
            <Text style={[styles.checkoutLine, { color: palette.mutedForeground }]}>
              Naka-mark na nabili:{" "}
              <Text style={{ fontWeight: "700", color: palette.foreground }}>
                {`${purchased.length} items${purchased.length > 0 ? ` (${peso(purchasedTotal)})` : ""}`}
              </Text>
            </Text>
            <Button
              title={checkingOut ? "Tine-checkout…" : "I-checkout ang mga Nabili"}
              busy={checkingOut}
              disabled={purchased.length === 0}
              onPress={confirmCheckout}
              style={{ marginTop: 12, minHeight: 48, borderRadius: radius.lg }}
            />
          </Card>
        </View>

        {/* ── Mga Nakaraang Restock ── */}
        <View style={styles.section}>
          <SectionHeader title="Mga Nakaraang Restock" />
          {(restocks ?? []).length === 0 ? (
            <Card>
              <EmptyState
                icon={<PackageOpen size={28} color={palette.mutedForeground} strokeWidth={1.8} />}
                title="Wala pang restock"
                subtitle="Mula sa resibo, listahan, o manual add."
              />
            </Card>
          ) : (
            <View style={styles.historyList}>
              {(restocks ?? []).map((r) => {
                const meta = RESTOCK_SOURCE_META[r.source];
                return (
                  <Card key={r.id} style={styles.historyCard}>
                    <View style={styles.nameRow}>
                      <Text style={[styles.historyDate, { color: palette.foreground }]}>
                        {formatDayLabel(r.date)}
                      </Text>
                      <Badge label={meta.label} tone={meta.tone} />
                      <View style={{ flex: 1 }} />
                      <Text style={[moneyText, { fontSize: 14, color: palette.foreground }]}>
                        {peso(r.total)}
                      </Text>
                      <Pressable
                        onPress={() => confirmDeleteRestock(r)}
                        accessibilityRole="button"
                        accessibilityLabel="Burahin ang restock"
                        hitSlop={4}
                        style={({ pressed }) => [styles.trashBtn, { opacity: pressed ? 0.6 : 1 }]}
                      >
                        <Trash2 size={16} color={palette.tones.rose.solid} />
                      </Pressable>
                    </View>
                    {r.supplier || r.note ? (
                      <Text numberOfLines={1} style={[styles.rowSubText, { color: palette.mutedForeground }]}>
                        {r.supplier || r.note}
                      </Text>
                    ) : null}
                    {r.items.length > 0 ? (
                      <Text numberOfLines={1} style={[styles.rowSubText, { color: palette.mutedForeground }]}>
                        {r.items.map((it) => `${Math.round(it.qty)}x ${it.name}`).join(", ")}
                      </Text>
                    ) : null}
                  </Card>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      <ReceiptScannerSheet visible={scannerOpen} onClose={() => setScannerOpen(false)} />
      <ManualRestockSheet visible={manualOpen} onClose={() => setManualOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16, gap: 16 },
  section: { gap: 12 },
  listGroup: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 56,
  },
  rowWrapper: {},
  shoppingRowWrapper: {},
  shoppingRow: { minHeight: 56 },
  rowMain: { flex: 1, minWidth: 0, gap: 3 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  rowName: { fontSize: 14, fontWeight: "600" },
  rowSubRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 1 },
  rowSubText: { fontSize: 11 },
  okRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  okText: { fontSize: 13.5 },
  emptyCardText: { fontSize: 13.5, textAlign: "center" },
  estimateText: { fontSize: 12, fontWeight: "600", fontVariant: ["tabular-nums"] },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  stepper: { flexDirection: "row", alignItems: "center", gap: 4 },
  stepperBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyInput: {
    width: 44,
    height: 32,
    borderWidth: 1,
    borderRadius: radius.sm,
    textAlign: "center",
    fontSize: 14,
    fontWeight: "600",
    paddingVertical: 0,
    fontVariant: ["tabular-nums"],
  },
  lineTotal: { fontSize: 14, minWidth: 52, textAlign: "right" },
  trashBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  checkoutLine: { fontSize: 13.5 },
  historyList: { gap: 12 },
  historyCard: { gap: 4 },
  historyDate: { fontSize: 14, fontWeight: "600" },
});
