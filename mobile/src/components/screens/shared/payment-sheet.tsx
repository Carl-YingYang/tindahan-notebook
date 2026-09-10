import React, { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { Sheet } from "@/components/shared/sheet";
import { AmountInput, FieldInput, SelectChip } from "@/components/shared/inputs";
import { Button } from "@/components/shared/ui";
import { useTheme } from "@/theme/theme";
import { useToast } from "@/components/shared/toast";
import { refreshAll } from "@/store/data";
import { recordPayment } from "@/db/repos/utang";
import { AppError } from "@/db/repos/helpers";
import { peso, roundMoney } from "@/logic/format";

export interface PaymentSheetProps {
  visible: boolean;
  onClose: () => void;
  customer: { id: string; name: string; balance: number } | null;
}

/** Ported from web payment-sheet.tsx — prefilled full balance, quick chips. */
export function PaymentSheet({ visible, onClose, customer }: PaymentSheetProps) {
  const toast = useToast();
  const { palette } = useTheme();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const balance = customer?.balance ?? 0;

  React.useEffect(() => {
    if (visible && customer) {
      setAmount(String(customer.balance > 0 ? roundMoney(customer.balance) : 0));
      setNote("");
      setSaving(false);
    }
  }, [visible, customer]);

  const parsed = parseFloat(amount);
  const remaining = useMemo(() => {
    if (!Number.isFinite(parsed)) return balance;
    return roundMoney(balance - parsed);
  }, [parsed, balance]);

  const submit = () => {
    if (!customer) return;
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast.error("Ilagay ang tamang halaga ng bayad");
      return;
    }
    if (parsed > balance + 0.001) {
      toast.error(`Malaki sa natitirang utang (${peso(balance)})`);
      return;
    }
    setSaving(true);
    try {
      recordPayment({
        customerId: customer.id,
        amount: parsed,
        markPaid: Math.abs(parsed - balance) < 0.001,
        note: note.trim() || null,
      });
      refreshAll();
      toast.success(`Naitala ang bayad ni ${customer.name}!`);
      onClose();
    } catch (e) {
      toast.error(e instanceof AppError ? e.message : "May problema sa server");
    } finally {
      setSaving(false);
    }
  };

  if (!customer) return null;

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={`Bayad ni ${customer.name}`}
      subtitle={`Natitirang utang: ${peso(balance)}`}
      footer={
        <Button
          title="I-record ang Bayad"
          onPress={submit}
          variant="emerald"
          busy={saving}
          disabled={saving || balance <= 0}
          style={{ width: "100%" }}
        />
      }
    >
      <AmountInput value={amount} onChange={setAmount} />
      <View style={{ flexDirection: "row", gap: 8 }}>
        <SelectChip
          label="Buong bayad"
          tone="emerald"
          active={Math.abs(remaining) < 0.001 && balance > 0}
          onPress={() => setAmount(String(roundMoney(balance)))}
        />
        <SelectChip
          label="Kalahati"
          tone="emerald"
          active={false}
          onPress={() => setAmount(String(roundMoney(balance / 2)))}
        />
      </View>
      <FieldInput
        label="Note (optional)"
        value={note}
        onChange={setNote}
        placeholder="hal. bayad sa puhunan"
      />
      <Text
        style={{
          fontSize: 13,
          fontWeight: "700",
          color: remaining <= 0 ? palette.tones.emerald.text : palette.mutedForeground,
        }}
      >
        {remaining <= 0 ? "Bayad na — magsasarado ang utang!" : `Matitira: ${peso(remaining)}`}
      </Text>
    </Sheet>
  );
}
