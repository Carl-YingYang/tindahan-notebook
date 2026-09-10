import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import * as Haptics from "expo-haptics";
import { Check, Plus, Trash2 } from "lucide-react-native";
import { useTheme } from "@/theme/theme";
import { radius } from "@/theme/tokens";
import { Button, moneyText } from "@/components/shared/ui";
import { FieldInput } from "@/components/shared/inputs";
import { useToast } from "@/components/shared/toast";
import { peso, roundMoney } from "@/logic/format";
import { createRestock } from "@/db/repos/restocks";
import type { RestockDTO } from "@/types";
import type { OcrItem } from "@/services/ocr/types";

/**
 * Restock review form — shared by the receipt OCR flow AND manual add.
 * Contract (web parity): OCR results are NEVER auto-saved; the user always
 * reviews here and taps save to create the restock record.
 */

interface ReviewRow {
  key: string;
  name: string;
  qty: string;
  unitPrice: string;
}

let rowSeq = 0;
function nextKey() {
  rowSeq += 1;
  return `row-${Date.now()}-${rowSeq}`;
}

function rowFromItem(it: OcrItem): ReviewRow {
  const qty = typeof it.qty === "number" && it.qty > 0 ? it.qty : 1;
  const unitPrice = typeof it.unitPrice === "number" && it.unitPrice >= 0 ? it.unitPrice : 0;
  return {
    key: nextKey(),
    name: it.name ?? "",
    qty: String(qty),
    unitPrice: unitPrice ? String(unitPrice) : "",
  };
}

function emptyRow(): ReviewRow {
  return { key: nextKey(), name: "", qty: "", unitPrice: "" };
}

function parseNum(s: string): number {
  const n = parseFloat(String(s).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function rowTotal(r: ReviewRow): number {
  return parseNum(r.qty || "1") * parseNum(r.unitPrice || "0");
}

export function ReceiptReviewForm({
  source,
  initialItems,
  onCancel,
  onSaved,
}: {
  source: "receipt" | "manual";
  initialItems?: OcrItem[];
  onCancel: () => void;
  /** Called with the created restock after a successful save — parent closes the sheet. */
  onSaved: (restock: RestockDTO) => void;
}) {
  const { palette } = useTheme();
  const toast = useToast();
  const [rows, setRows] = useState<ReviewRow[]>(() =>
    initialItems && initialItems.length > 0 ? initialItems.map(rowFromItem) : [emptyRow()]
  );
  const [supplier, setSupplier] = useState("");
  const [note, setNote] = useState("");
  const [updateStock, setUpdateStock] = useState(true);
  const [saving, setSaving] = useState(false);

  // Items with an empty name are skipped on save (OCR noise guard).
  const validRows = rows.filter((r) => r.name.trim().length > 0);
  const estimatedTotal = roundMoney(validRows.reduce((sum, r) => sum + rowTotal(r), 0));

  const updateRow = (key: string, patch: Partial<ReviewRow>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const removeRow = (key: string) => setRows((rs) => rs.filter((r) => r.key !== key));

  const save = () => {
    if (saving) return;
    if (validRows.length === 0) {
      toast.error("Kumpletohin ang items");
      return;
    }
    setSaving(true);
    try {
      const saved = createRestock({
        source,
        supplier: supplier.trim() || null,
        note: note.trim() || null,
        items: validRows.map((r) => ({
          name: r.name.trim(),
          qty: parseNum(r.qty) || 1,
          unitPrice: parseNum(r.unitPrice) || 0,
        })),
        updateStock,
      });
      try {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {
        // non-fatal
      }
      toast.success(`Nai-save ang restock — ${peso(saved.total)}`);
      onSaved(saved);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Hindi na-save, subukan ulit");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.form}>
      {/* Amber notice */}
      <View
        style={[
          styles.notice,
          {
            backgroundColor: palette.tones.amber.soft,
            borderColor: palette.tones.amber.border,
          },
        ]}
      >
        <Text style={[styles.noticeText, { color: palette.tones.amber.text }]}>
          {source === "receipt"
            ? "Tingnan at ayusin ang mga item bago i-save. Puwedeng magkamali ang pagbasa."
            : "Tingnan at ayusin ang mga item bago i-save."}
        </Text>
      </View>

      <FieldInput
        value={supplier}
        onChange={setSupplier}
        placeholder="Supplier (hal. Aling Rosa)"
        maxLength={80}
      />
      <FieldInput
        value={note}
        onChange={setNote}
        placeholder="Note (hal. pambaon week)"
        maxLength={120}
      />

      {/* Item rows */}
      <View style={styles.rowsWrap}>
        {rows.length === 0 ? (
          <View
            style={[styles.emptyRows, { borderColor: palette.border, backgroundColor: palette.muted }]}
          >
            <Text style={[styles.emptyRowsText, { color: palette.mutedForeground }]}>
              Walang items — tap ang "Add item" para magdagdag.
            </Text>
          </View>
        ) : null}

        {rows.map((r) => {
          const qty = parseNum(r.qty);
          const price = parseNum(r.unitPrice);
          const bothPositive = qty > 0 && price > 0;
          return (
            <View
              key={r.key}
              style={[styles.rowCard, { backgroundColor: palette.card, borderColor: palette.border }]}
            >
              <View style={styles.rowTop}>
                <TextInput
                  value={r.name}
                  onChangeText={(t) => updateRow(r.key, { name: t })}
                  placeholder="Pangalan ng item"
                  placeholderTextColor={palette.mutedForeground}
                  maxLength={80}
                  accessibilityLabel="Pangalan ng item"
                  style={[
                    styles.rowInput,
                    styles.rowNameInput,
                    { borderColor: palette.border, color: palette.foreground },
                  ]}
                />
                <Pressable
                  onPress={() => removeRow(r.key)}
                  accessibilityRole="button"
                  accessibilityLabel={`Tanggalin ang ${r.name || "item"}`}
                  hitSlop={6}
                  style={({ pressed }) => [styles.rowTrash, { opacity: pressed ? 0.6 : 1 }]}
                >
                  <Trash2 size={16} color={palette.tones.rose.solid} />
                </Pressable>
              </View>
              <View style={styles.rowBottom}>
                <TextInput
                  value={r.qty}
                  onChangeText={(t) => updateRow(r.key, { qty: t.replace(/[^0-9]/g, "") })}
                  placeholder="Qty"
                  placeholderTextColor={palette.mutedForeground}
                  keyboardType="numeric"
                  accessibilityLabel="Qty"
                  style={[
                    styles.rowInput,
                    styles.rowQtyInput,
                    { borderColor: palette.border, color: palette.foreground },
                  ]}
                />
                <TextInput
                  value={r.unitPrice}
                  onChangeText={(t) => updateRow(r.key, { unitPrice: t.replace(/[^0-9.,]/g, "") })}
                  placeholder="₱ Presyo"
                  placeholderTextColor={palette.mutedForeground}
                  keyboardType="decimal-pad"
                  accessibilityLabel="Presyo"
                  style={[
                    styles.rowInput,
                    styles.rowPriceInput,
                    { borderColor: palette.border, color: palette.foreground },
                  ]}
                />
                <View style={styles.rowTotalWrap}>
                  <Text
                    accessibilityLiveRegion="polite"
                    style={[moneyText, styles.rowTotalText, { color: palette.foreground }]}
                  >
                    {bothPositive ? peso(rowTotal(r)) : "—"}
                  </Text>
                </View>
              </View>
            </View>
          );
        })}

        <Pressable
          onPress={() => setRows((rs) => [...rs, emptyRow()])}
          accessibilityRole="button"
          accessibilityLabel="Add item"
          style={({ pressed }) => [
            styles.addItem,
            { borderColor: palette.border, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Plus size={16} color={palette.mutedForeground} />
          <Text style={[styles.addItemText, { color: palette.mutedForeground }]}>Add item</Text>
        </Pressable>
      </View>

      {/* Update-stock checkbox */}
      <Pressable
        onPress={() => setUpdateStock((v) => !v)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: updateStock }}
        accessibilityLabel="I-update ang stock status ng mga item"
        style={styles.checkboxRow}
      >
        <View
          style={[
            styles.checkboxBox,
            updateStock
              ? {
                  backgroundColor: palette.tones.emerald.solid,
                  borderColor: palette.tones.emerald.solid,
                }
              : { backgroundColor: "transparent", borderColor: palette.border },
          ]}
        >
          {updateStock ? <Check size={14} color="#ffffff" /> : null}
        </View>
        <Text style={[styles.checkboxText, { color: palette.foreground }]}>
          I-update ang stock status ng mga item (Marami pa)
        </Text>
      </Pressable>

      {/* Footer summary */}
      <View style={[styles.footer, { borderTopColor: palette.border }]}>
        <View style={styles.footerTotalRow}>
          <Text style={[styles.footerLabel, { color: palette.mutedForeground }]}>
            Estimated Total:
          </Text>
          <Text style={[moneyText, styles.footerTotal, { color: palette.foreground }]}>
            {peso(estimatedTotal)}
          </Text>
        </View>
        <View style={styles.footerButtons}>
          <Button
            title="Kanselahin"
            variant="outline"
            onPress={onCancel}
            style={styles.footerButtonLeft}
          />
          <Button
            title={saving ? "Sine-save…" : `I-save ang Restock (${validRows.length} items)`}
            busy={saving}
            onPress={save}
            accessibilityLabel="I-save ang Restock"
            style={styles.footerButtonSave}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 14 },
  notice: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 12,
  },
  noticeText: { fontSize: 12, lineHeight: 18 },
  rowsWrap: { gap: 10 },
  emptyRows: {
    borderWidth: 2,
    borderStyle: "dashed",
    borderRadius: radius.md,
    padding: 16,
    alignItems: "center",
  },
  emptyRowsText: { fontSize: 12, textAlign: "center" },
  rowCard: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 12,
    gap: 8,
  },
  rowTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowBottom: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowInput: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    height: 40,
    fontSize: 14,
  },
  rowNameInput: { flex: 1, fontWeight: "600" },
  rowQtyInput: { width: 56, textAlign: "center", fontVariant: ["tabular-nums"] },
  rowPriceInput: { width: 72, fontVariant: ["tabular-nums"] },
  rowTrash: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  rowTotalWrap: { flex: 1, alignItems: "flex-end" },
  rowTotalText: { fontSize: 13 },
  addItem: {
    height: 44,
    borderWidth: 2,
    borderStyle: "dashed",
    borderRadius: radius.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  addItemText: { fontSize: 14, fontWeight: "600" },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 44,
    paddingHorizontal: 4,
  },
  checkboxBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxText: { fontSize: 14, flex: 1 },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 14,
    gap: 12,
  },
  footerTotalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  footerLabel: { fontSize: 14 },
  footerTotal: { fontSize: 15 },
  footerButtons: { flexDirection: "row", gap: 10 },
  footerButtonLeft: { flex: 1, minHeight: 48 },
  footerButtonSave: { flex: 2, minHeight: 48 },
});
