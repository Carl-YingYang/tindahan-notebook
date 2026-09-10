import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { CalendarClock } from "lucide-react-native";
import { Sheet } from "@/components/shared/sheet";
import { FieldInput, SelectChip } from "@/components/shared/inputs";
import { Button } from "@/components/shared/ui";
import { useToast } from "@/components/shared/toast";
import { refreshAll } from "@/store/data";
import { setUtangDueDate } from "@/db/repos/utang";
import { AppError } from "@/db/repos/helpers";
import { peso, manilaDateStr } from "@/logic/format";

export interface DueDateDialogProps {
  visible: boolean;
  onClose: () => void;
  txn: { id: string; amount: number; dueDate: string | null } | null;
  customerName: string;
}

function plusDaysStr(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return manilaDateStr(d);
}

function isoToDateStr(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return manilaDateStr(d);
}

/** "Kailan bayad?" — ported from web due-date-dialog.tsx. */
export function DueDateDialog({ visible, onClose, txn, customerName }: DueDateDialogProps) {
  const toast = useToast();
  const [date, setDate] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible && txn) {
      setDate(isoToDateStr(txn.dueDate));
      setSaving(false);
    }
  }, [visible, txn]);

  if (!txn) return null;

  const save = (nextDate: string | null) => {
    setSaving(true);
    try {
      const iso = nextDate ? new Date(`${nextDate}T12:00:00+08:00`).toISOString() : null;
      setUtangDueDate(txn.id, iso);
      refreshAll();
      toast.success(nextDate ? "Naitakda ang due date!" : "Naitanggal ang due date");
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
      title="Kailan bayad?"
      subtitle={`Due date ng ${peso(txn.amount)} utang ni ${customerName}.`}
      footer={
        <View style={{ flexDirection: "row", gap: 8 }}>
          {txn.dueDate ? (
            <Button
              title="Alisin"
              variant="rose"
              size="sm"
              onPress={() => save(null)}
              busy={saving}
              disabled={saving}
              style={{ flex: 1 }}
            />
          ) : null}
          <Button
            title="Kanselahin"
            variant="outline"
            size="sm"
            onPress={onClose}
            style={{ flex: 1 }}
          />
          <Button
            title="I-save"
            size="sm"
            onPress={() => {
              if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
                toast.error("Hindi valid ang due date");
                return;
              }
              save(date);
            }}
            busy={saving}
            disabled={saving}
            style={{ flex: 1 }}
          />
        </View>
      }
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <CalendarClock size={15} color={"#78716c"} />
        <Text style={{ fontSize: 12.5, fontWeight: "700", color: "#78716c" }}>Due date</Text>
      </View>
      <FieldInput value={date} onChange={setDate} placeholder="YYYY-MM-DD" />
      <View style={{ flexDirection: "row", gap: 8 }}>
        <SelectChip label="Bukas" active={date === plusDaysStr(1)} onPress={() => setDate(plusDaysStr(1))} />
        <SelectChip
          label="Sa loob ng isang linggo"
          active={date === plusDaysStr(7)}
          onPress={() => setDate(plusDaysStr(7))}
        />
      </View>
    </Sheet>
  );
}
