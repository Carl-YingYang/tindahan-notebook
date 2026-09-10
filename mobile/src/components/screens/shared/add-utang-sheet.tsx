import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CalendarClock, Check, UserPlus } from "lucide-react-native";
import { Sheet } from "@/components/shared/sheet";
import { AmountInput, FieldInput, SelectChip } from "@/components/shared/inputs";
import { Button, Avatar } from "@/components/shared/ui";
import { useTheme } from "@/theme/theme";
import { useToast } from "@/components/shared/toast";
import { useDbQuery, refreshAll } from "@/store/data";
import { addUtang } from "@/db/repos/utang";
import { listCustomerSummaries } from "@/db/repos/customers";
import { AppError } from "@/db/repos/helpers";
import { peso, manilaDateStr } from "@/logic/format";
import { radius } from "@/theme/tokens";

export interface AddUtangSheetProps {
  visible: boolean;
  onClose: () => void;
  /** locked mode: drawer passes the customer directly */
  lockedCustomer?: { id: string; name: string } | null;
}

const DUE_CHIPS: Array<{ label: string; days: number }> = [
  { label: "Bukas", days: 1 },
  { label: "3 araw", days: 3 },
  { label: "1 linggo", days: 7 },
  { label: "2 linggo", days: 14 },
];

/** Ported from web add-utang-sheet.tsx — search/create customer, amount, note, due chips. */
export function AddUtangSheet({ visible, onClose, lockedCustomer }: AddUtangSheetProps) {
  const { palette } = useTheme();
  const toast = useToast();
  const customers = useDbQuery(() => listCustomerSummaries(), []);

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [dueDays, setDueDays] = useState<number | null>(null);
  const [date, setDate] = useState(manilaDateStr());
  const [saving, setSaving] = useState(false);

  const effectiveCustomer = lockedCustomer ?? selected;

  const suggestions = useMemo(() => {
    if (lockedCustomer) return [];
    const q = query.trim().toLowerCase();
    if (!q) return (customers ?? []).slice(0, 6);
    return (customers ?? [])
      .filter((c) => c.name.toLowerCase().includes(q))
      .slice(0, 6);
  }, [customers, query, lockedCustomer]);

  const exactMatch = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return (customers ?? []).find((c) => c.name.toLowerCase() === q) ?? null;
  }, [customers, query]);

  const reset = () => {
    setQuery("");
    setSelected(null);
    setAmount("");
    setNote("");
    setDueDays(null);
    setDate(manilaDateStr());
    setSaving(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const submit = () => {
    const amt = parseFloat(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error("Ilagay ang tamang halaga");
      return;
    }
    const name = query.trim();
    if (!effectiveCustomer && !name) {
      toast.error("Piliin o i-type ang pangalan ng customer");
      return;
    }
    setSaving(true);
    try {
      const dueDate =
        dueDays !== null
          ? (() => {
              const d = new Date();
              d.setDate(d.getDate() + dueDays);
              d.setHours(23, 59, 0, 0);
              return d.toISOString();
            })()
          : null;
      const isToday = date === manilaDateStr();
      const recordDate = isToday
        ? new Date().toISOString()
        : new Date(`${date}T12:00:00+08:00`).toISOString();
      const result = addUtang({
        customerId: effectiveCustomer && effectiveCustomer.id !== "__new__" ? effectiveCustomer.id : undefined,
        customerName: effectiveCustomer && effectiveCustomer.id !== "__new__" ? undefined : name,
        amount: amt,
        note: note.trim() || null,
        dueDate,
        date: recordDate,
      });
      refreshAll();
      toast.success(`Naidagdag ang utang ni ${result.customer.name}!`);
      handleClose();
    } catch (e) {
      toast.error(e instanceof AppError ? e.message : "May problema sa server");
      setSaving(false);
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={handleClose}
      title="Add Utang"
      subtitle="Itala ang hiniram na paninda ng suki"
      footer={
        <Button
          title="I-save ang Utang"
          onPress={submit}
          busy={saving}
          disabled={saving}
          style={{ width: "100%" }}
        />
      }
    >
      {lockedCustomer ? (
        <View style={[styles.lockedRow, { backgroundColor: palette.muted, borderColor: palette.border }]}>
          <Avatar name={lockedCustomer.name} tone="orange" size={32} />
          <Text style={{ color: palette.foreground, fontWeight: "700", fontSize: 14, flex: 1 }}>
            {lockedCustomer.name}
          </Text>
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          <FieldInput
            label="Pangalan ng suki"
            value={query}
            onChange={(t) => {
              setQuery(t);
              setSelected(null);
            }}
            placeholder="Pangalan ng suki…"
          />
          {suggestions.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => {
                setSelected({ id: c.id, name: c.name });
                setQuery(c.name);
              }}
              style={[styles.suggestionRow, { borderColor: palette.border }]}
              accessibilityRole="button"
              accessibilityLabel={`Piliin si ${c.name}`}
            >
              <Avatar name={c.name} tone={c.balance > 0 ? "orange" : "emerald"} size={32} />
              <Text style={{ flex: 1, color: palette.foreground, fontWeight: "600", fontSize: 13.5 }} numberOfLines={1}>
                {c.name}
              </Text>
              {c.balance > 0 ? (
                <Text style={{ color: palette.tones.orange.text, fontSize: 11.5, fontWeight: "700" }}>
                  May utang: {peso(c.balance)}
                </Text>
              ) : selected?.id === c.id ? (
                <Check size={16} color={palette.tones.emerald.solid} />
              ) : null}
            </Pressable>
          ))}
          {!exactMatch && query.trim().length > 0 ? (
            <Pressable
              onPress={() => setSelected({ id: "__new__", name: query.trim() })}
              style={[styles.newRow, { borderColor: palette.primary }]}
              accessibilityRole="button"
              accessibilityLabel={`Gumawa ng bagong customer: ${query.trim()}`}
            >
              <UserPlus size={16} color={palette.primary} />
              <Text style={{ color: palette.primary, fontWeight: "700", fontSize: 13 }}>
                Gumawa ng bagong customer: “{query.trim()}”
              </Text>
            </Pressable>
          ) : null}
        </View>
      )}

      <AmountInput value={amount} onChange={setAmount} />
      <FieldInput
        label="Note (optional)"
        value={note}
        onChange={setNote}
        placeholder="hal. 2 Lucky Me, 1 Coke"
        maxLength={120}
      />

      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <CalendarClock size={15} color={palette.mutedForeground} />
          <Text style={{ fontSize: 12.5, fontWeight: "700", color: palette.mutedForeground }}>
            Kailan bayad? (optional)
          </Text>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {DUE_CHIPS.map((chip) => (
            <SelectChip
              key={chip.label}
              label={chip.label}
              tone="orange"
              active={dueDays === chip.days}
              onPress={() => setDueDays(dueDays === chip.days ? null : chip.days)}
            />
          ))}
        </View>
      </View>

      <FieldInput
        label="Petsa"
        value={date}
        onChange={setDate}
        placeholder="YYYY-MM-DD"
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  lockedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 12,
  },
  suggestionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 10,
  },
  newRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderRadius: radius.md,
    padding: 12,
  },
});
