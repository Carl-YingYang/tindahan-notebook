import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ChevronDown, ChevronUp } from "lucide-react-native";
import { Sheet } from "@/components/shared/sheet";
import { AmountInput, FieldInput, SelectChip } from "@/components/shared/inputs";
import { Badge, Button } from "@/components/shared/ui";
import { StockStatusPicker } from "@/components/shared/stock-badge";
import { useTheme } from "@/theme/theme";
import { useToast } from "@/components/shared/toast";
import { useDbQuery } from "@/store/data";
import {
  createProduct,
  listProducts,
  updateProduct,
} from "@/db/repos/products";
import { getProductRestockHistory } from "@/db/repos/restocks";
import { AppError } from "@/db/repos/helpers";
import { PRODUCT_UNITS, RESTOCK_SOURCE_META, stockStatusMeta, type RestockSource, type StockStatus } from "@/logic/constants";
import { formatDayLabel, peso } from "@/logic/format";
import type { Product } from "@/types";

/** Create/edit product drawer with restock history expander. */
export function ProductDrawer({
  visible,
  productId,
  onClose,
  onDelete,
}: {
  visible: boolean;
  /** null → create mode */
  productId: string | null;
  onClose: () => void;
  onDelete?: (id: string, name: string) => void;
}) {
  const { palette } = useTheme();
  const toast = useToast();
  const isEdit = productId !== null;

  const [name, setName] = useState("");
  const [unit, setUnit] = useState<string>("");
  const [status, setStatus] = useState<StockStatus>("sakto");
  const [lastCost, setLastCost] = useState("");
  const [interval, setIntervalDays] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    if (visible) {
      setHistoryOpen(false);
      setSaving(false);
      if (productId) {
        const p = listProducts().find((x) => x.id === productId);
        setName(p?.name ?? "");
        setUnit(p?.unit ?? "");
        setStatus(p?.stockStatus ?? "sakto");
        setLastCost(p?.lastCost != null ? String(p.lastCost) : "");
        setIntervalDays(p?.typicalIntervalDays != null ? String(p.typicalIntervalDays) : "");
        setNote(p?.note ?? "");
      } else {
        setName("");
        setUnit("");
        setStatus("sakto");
        setLastCost("");
        setIntervalDays("");
        setNote("");
      }
    }
  }, [visible, productId]);

  const submit = () => {
    if (!name.trim()) {
      toast.error("Ilagay ang pangalan ng paninda");
      return;
    }
    const intervalNum = interval.trim() ? parseFloat(interval) : null;
    if (intervalNum !== null && (!Number.isFinite(intervalNum) || intervalNum <= 0)) {
      toast.error("Hindi valid ang bilang ng araw");
      return;
    }
    setSaving(true);
    try {
      if (isEdit && productId) {
        updateProduct(productId, {
          name,
          unit: unit || null,
          stockStatus: status,
          lastCost: lastCost ? parseFloat(lastCost) : null,
          note: note || null,
          typicalIntervalDays: intervalNum,
        });
        toast.success(`Na-update si ${name.trim()}!`);
      } else {
        createProduct({
          name,
          unit: unit || null,
          stockStatus: status,
          lastCost: lastCost ? parseFloat(lastCost) : null,
          note: note || null,
          typicalIntervalDays: intervalNum,
        });
        toast.success(`Naidagdag si ${name.trim()}!`);
      }
      onClose();
    } catch (e) {
      toast.error(e instanceof AppError ? e.message : "May problema sa server");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={isEdit ? "I-edit ang paninda" : "Bagong paninda"}
      subtitle={isEdit ? "I-update ang detalye o burahin na lang kako." : "Idagdag sa listahan ng mga paninda mo."}
      footer={
        <View style={{ flexDirection: "row", gap: 8 }}>
          {isEdit && productId && onDelete ? (
            <Button title="Burahin" variant="rose" size="sm" style={{ flex: 1 }} onPress={() => onDelete(productId, name)} />
          ) : null}
          <Button
            title={isEdit ? "I-save ang pagbabago" : "I-add siya"}
            onPress={submit}
            busy={saving}
            disabled={saving}
            style={{ flex: 2 }}
          />
        </View>
      }
    >
      <FieldInput label="Pangalan" value={name} onChange={setName} placeholder="hal. Coke Mismo" maxLength={60} />

      <View style={{ gap: 8 }}>
        <Text style={{ fontSize: 12.5, fontWeight: "700", color: "#78716c" }}>Unit</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <SelectChip label="Wala" active={unit === ""} onPress={() => setUnit("")} />
          {PRODUCT_UNITS.map((u) => (
            <SelectChip key={u} label={u} active={unit === u} onPress={() => setUnit(u)} />
          ))}
        </View>
      </View>

      <View style={{ gap: 8 }}>
        <Text style={{ fontSize: 12.5, fontWeight: "700", color: "#78716c" }}>Stock status ngayon</Text>
        <StockStatusPicker value={status} onChange={setStatus} />
      </View>

      <AmountInput value={lastCost} onChange={setLastCost} placeholder="0.00" />
      <Text style={{ fontSize: 11, color: "#78716c", marginTop: -8 }}>Huling presyo (optional)</Text>

      <FieldInput
        label="Karaniwang restock interval (araw, optional)"
        value={interval}
        onChange={setIntervalDays}
        placeholder="hal. 7"
        keyboardType="numeric"
      />
      <FieldInput label="Note (optional)" value={note} onChange={setNote} placeholder="hal. Supplier: Ate Nena" maxLength={200} />

      {isEdit && productId ? (
        <RestockHistoryExpander productId={productId} open={historyOpen} onToggle={() => setHistoryOpen(!historyOpen)} />
      ) : null}
    </Sheet>
  );
}

function RestockHistoryExpander({
  productId,
  open,
  onToggle,
}: {
  productId: string;
  open: boolean;
  onToggle: () => void;
}) {
  const { palette } = useTheme();
  const history = useDbQuery(() => (open ? getProductRestockHistory(productId, 20) : null), [open, productId]);

  return (
    <View style={{ gap: 8 }}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel="Restock history"
        style={[styles.historyToggle, { borderColor: palette.border }]}
      >
        <Text style={{ fontSize: 12.5, fontWeight: "700", color: palette.foreground, flex: 1 }}>
          Restock history
        </Text>
        {open ? (
          <ChevronUp size={16} color={palette.mutedForeground} />
        ) : (
          <ChevronDown size={16} color={palette.mutedForeground} />
        )}
      </Pressable>
      {open ? (
        (history ?? []).length === 0 ? (
          <Text style={{ fontSize: 12, color: palette.mutedForeground }}>
            Wala pang restock record. Galing sa manual entry, resibo, o restock list.
          </Text>
        ) : (
          <View style={{ gap: 6 }}>
            {(history ?? []).map(({ restock, item }) => {
              const sourceMeta = RESTOCK_SOURCE_META[restock.source as RestockSource] ?? RESTOCK_SOURCE_META.manual;
              return (
                <View key={item.id} style={[styles.historyRow, { borderColor: palette.border }]}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: palette.tones[sourceMeta.tone].solid }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12.5, fontWeight: "600", color: palette.foreground }}>
                      {`${Math.round(item.qty)} × ${peso(item.unitPrice)} = ${peso(item.total)}`}
                    </Text>
                    <Text style={{ fontSize: 10.5, color: palette.mutedForeground }} numberOfLines={1}>
                      {`${formatDayLabel(restock.date)}${restock.supplier ? ` · ${restock.supplier}` : ""}`}
                    </Text>
                  </View>
                  <Badge label={sourceMeta.label} tone={sourceMeta.tone} />
                </View>
              );
            })}
          </View>
        )
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  historyToggle: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 8,
  },
});
