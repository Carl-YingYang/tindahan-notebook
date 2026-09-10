import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { Sheet } from "@/components/shared/sheet";
import { AmountInput, FieldInput, SelectChip } from "@/components/shared/inputs";
import { Button } from "@/components/shared/ui";
import { useToast } from "@/components/shared/toast";
import { refreshAll } from "@/store/data";
import { addSale, addExpense } from "@/db/repos/records";
import { AppError } from "@/db/repos/helpers";
import { SALES_CATEGORIES, EXPENSE_CATEGORIES } from "@/logic/constants";
import { manilaDateStr } from "@/logic/format";

export interface QuickEntrySheetProps {
  visible: boolean;
  onClose: () => void;
  kind: "benta" | "gastos";
}

/** Ported from web quick-entry-sheet.tsx — Add Benta / Add Gastos. */
export function QuickEntrySheet({ visible, onClose, kind }: QuickEntrySheetProps) {
  const toast = useToast();
  const categories = kind === "benta" ? SALES_CATEGORIES : EXPENSE_CATEGORIES;
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<string>(kind === "gastos" ? "Restock" : "");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(manilaDateStr());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setAmount("");
      setCategory(kind === "gastos" ? "Restock" : "");
      setNote("");
      setDate(manilaDateStr());
      setSaving(false);
    }
  }, [visible, kind]);

  const submit = () => {
    const amt = parseFloat(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error("Ilagay ang tamang halaga");
      return;
    }
    setSaving(true);
    try {
      const isToday = date === manilaDateStr();
      const recordDate = isToday
        ? new Date().toISOString()
        : new Date(`${date}T12:00:00+08:00`).toISOString();
      if (kind === "benta") {
        addSale({ amount: amt, category: category || null, note: note.trim() || null, date: recordDate });
        toast.success("Naitala ang benta!");
      } else {
        addExpense({ amount: amt, category: category || "Iba pa", note: note.trim() || null, date: recordDate });
        toast.success("Naitala ang gastos!");
      }
      refreshAll();
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
      title={kind === "benta" ? "Add Benta" : "Add Gastos"}
      subtitle={kind === "benta" ? "Kita mula sa tindahan ngayong araw" : "Gumastos para sa tindahan"}
      footer={
        <Button
          title={kind === "benta" ? "I-save ang Benta" : "I-save ang Gastos"}
          onPress={submit}
          variant={kind === "benta" ? "emerald" : "rose"}
          busy={saving}
          disabled={saving}
          style={{ width: "100%" }}
        />
      }
    >
      <AmountInput value={amount} onChange={setAmount} />
      <View style={{ gap: 8 }}>
        <Text style={{ fontSize: 12.5, fontWeight: "700", color: "#78716c" }}>Category</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {categories.map((c) => (
            <SelectChip
              key={c}
              label={c}
              active={category === c}
              onPress={() => setCategory(category === c ? "" : c)}
            />
          ))}
        </View>
      </View>
      <FieldInput
        label="Note (optional)"
        value={note}
        onChange={setNote}
        placeholder={kind === "benta" ? "hal. benta ng softdrinks" : "hal. pambili ng load"}
        maxLength={120}
      />
      <FieldInput label="Petsa" value={date} onChange={setDate} placeholder="YYYY-MM-DD" />
    </Sheet>
  );
}
