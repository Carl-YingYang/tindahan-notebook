import React, { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  CalendarClock,
  CalendarPlus,
  HandCoins,
  MessageSquareText,
  Pencil,
  StickyNote,
  Trash2,
} from "lucide-react-native";
import { Sheet } from "@/components/shared/sheet";
import { Avatar, Badge, Button, Divider } from "@/components/shared/ui";
import { FieldInput } from "@/components/shared/inputs";
import { AddUtangSheet } from "@/components/screens/shared/add-utang-sheet";
import { PaymentSheet } from "@/components/screens/shared/payment-sheet";
import { DueDateDialog } from "@/components/screens/shared/due-date-dialog";
import { useTheme } from "@/theme/theme";
import { useToast } from "@/components/shared/toast";
import { useDbQuery, refreshAll } from "@/store/data";
import { getCustomerDetail, deleteCustomer, updateCustomer } from "@/db/repos/customers";
import { deleteUtangTxn, recordPayment } from "@/db/repos/utang";
import { AppError } from "@/db/repos/helpers";
import {
  avatarTone,
  dueInfo,
  formatDayLabel,
  formatTime,
  peso,
  roundMoney,
} from "@/logic/format";
import { buildPaymentReminder } from "@/logic/reminder";
import { radius } from "@/theme/tokens";

/** Customer detail drawer — balance, quick actions, reminder copy, notes, txn history. */
export function CustomerDetailDrawer({
  visible,
  onClose,
  customerId,
  onDeleted,
}: {
  visible: boolean;
  onClose: () => void;
  customerId: string | null;
  onDeleted?: () => void;
}) {
  const { palette } = useTheme();
  const toast = useToast();
  const detail = useDbQuery(() => (customerId ? getCustomerDetail(customerId) : null), [customerId]);

  const [addUtangOpen, setAddUtangOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [dueTxn, setDueTxn] = useState<{ id: string; amount: number; dueDate: string | null } | null>(null);
  const [noteEditing, setNoteEditing] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [confirmPaid, setConfirmPaid] = useState(false);

  useEffect(() => {
    // reset note editing whenever a different customer is opened
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNoteEditing(false);
  }, [customerId]);

  const customer = detail?.customer;
  const balance = customer?.balance ?? 0;
  const due = dueInfo(customer?.dueDate ?? null);

  if (!customerId) return null;

  const closeAll = () => {
    setAddUtangOpen(false);
    setPaymentOpen(false);
    setDueTxn(null);
    setNoteEditing(false);
    onClose();
  };

  const markAsPaid = () => {
    if (!customer) return;
    Alert.alert(
      `Markahan bayad na si ${customer.name}?`,
      `Gagawa tayo ng payment record para sa ${peso(balance)}.`,
      [
        { text: "Hindi na lang", style: "cancel" },
        {
          text: "Oo, bayad na",
          onPress: () => {
            try {
              recordPayment({ customerId: customer.id, markPaid: true });
              refreshAll();
              toast.success(`Bayad na si ${customer.name}!`);
            } catch (e) {
              toast.error(e instanceof AppError ? e.message : "May problema sa server");
            }
          },
        },
      ]
    );
  };

  const copyReminder = async () => {
    if (!customer) return;
    const text = buildPaymentReminder({ name: customer.name }, balance, customer.dueDate);
    try {
      await Clipboard.setStringAsync(text);
      toast.success("Nakopya ang paalala — i-paste sa text o Messenger!");
    } catch {
      toast.error("Hindi suportado ang pag-copy sa device na ito");
    }
  };

  const saveNote = () => {
    if (!customer) return;
    try {
      updateCustomer(customer.id, { note: noteDraft });
      refreshAll();
      toast.success("Nai-save ang tala sa suki!");
      setNoteEditing(false);
    } catch (e) {
      toast.error(e instanceof AppError ? e.message : "May problema sa server");
    }
  };

  const deleteTxn = (id: string, isPayment: boolean, amountText: string) => {
    Alert.alert(
      "Burahin ang tala?",
      isPayment
        ? `Buburahin ang bayad na ${amountText}. Hindi na ito maibabalik.`
        : `Buburahin ang utang na ${amountText}. Hindi na ito maibabalik.`,
      [
        { text: "Hindi na lang", style: "cancel" },
        {
          text: "Burahin",
          style: "destructive",
          onPress: () => {
            try {
              deleteUtangTxn(id);
              refreshAll();
              toast.success("Nabura ang tala");
            } catch (e) {
              toast.error(e instanceof AppError ? e.message : "May problema sa server");
            }
          },
        },
      ]
    );
  };

  const deleteThisCustomer = () => {
    if (!customer) return;
    Alert.alert(
      `Burahin si ${customer.name}?`,
      "Kasama ang lahat ng utang at bayad records. Hindi na ito maibabalik.",
      [
        { text: "Kanselahin", style: "cancel" },
        {
          text: "Burahin",
          style: "destructive",
          onPress: () => {
            try {
              deleteCustomer(customer.id);
              refreshAll();
              toast.success("Nabura ang customer");
              onDeleted?.();
              closeAll();
            } catch (e) {
              toast.error(e instanceof AppError ? e.message : "May problema sa server");
            }
          },
        },
      ]
    );
  };

  const noteText = customer?.note?.trim() || customer?.notes || "";

  return (
    <>
      <Sheet visible={visible} onClose={closeAll} title={customer?.name ?? ""} subtitle="Tala ng utang at bayad">
        {/* Balance */}
        <View style={styles.balanceRow}>
          <Text style={{ fontSize: 12.5, fontWeight: "700", color: "#78716c" }}>
            {balance > 0 ? "Natitira:" : "Status:"}
          </Text>
          <Text
            style={{
              fontSize: 20,
              fontWeight: "800",
              color: balance > 0 ? palette.tones.orange.text : palette.tones.emerald.text,
              fontVariant: ["tabular-nums"],
            }}
          >
            {balance > 0 ? peso(balance) : "Bayad na!"}
          </Text>
          {due && balance > 0 ? (
            <Badge label={due.label} tone={due.tone === "late" ? "rose" : due.tone === "today" ? "orange" : "amber"} />
          ) : null}
        </View>

        {/* Quick actions */}
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Button
            title="Add Utang"
            variant="orange"
            size="sm"
            style={{ flex: 1 }}
            onPress={() => setAddUtangOpen(true)}
          />
          <Button
            title="Bayad"
            variant="emerald"
            size="sm"
            style={{ flex: 1 }}
            disabled={balance <= 0}
            onPress={() => setPaymentOpen(true)}
          />
          <Button
            title="Mark as Paid"
            variant="muted"
            size="sm"
            style={{ flex: 1 }}
            disabled={balance <= 0}
            onPress={markAsPaid}
          />
        </View>

        {/* Reminder copy */}
        {balance > 0 ? (
          <Pressable
            onPress={copyReminder}
            accessibilityRole="button"
            accessibilityLabel="Kopyahin ang paalala"
            style={[styles.reminderBtn, { borderColor: palette.tones.orange.solid }]}
          >
            <MessageSquareText size={15} color={palette.tones.orange.text} />
            <Text style={{ color: palette.tones.orange.text, fontSize: 12.5, fontWeight: "700", flex: 1 }}>
              Kopyahin ang paalala (para sa text/Messenger)
            </Text>
          </Pressable>
        ) : null}

        {/* Tala sa suki */}
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <StickyNote size={15} color={palette.tones.amber.text} />
            <Text style={{ fontSize: 12.5, fontWeight: "700", color: palette.mutedForeground }}>
              Tala sa suki
            </Text>
            <Pressable
              onPress={() => {
                setNoteDraft(customer?.note ?? "");
                setNoteEditing(!noteEditing);
              }}
              accessibilityRole="button"
              accessibilityLabel="I-edit ang tala sa suki"
              hitSlop={8}
              style={{ marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 4 }}
            >
              <Pencil size={13} color={palette.primary} />
              <Text style={{ color: palette.primary, fontSize: 11.5, fontWeight: "700" }}>I-edit</Text>
            </Pressable>
          </View>
          {noteEditing ? (
            <View style={{ gap: 8 }}>
              <FieldInput
                value={noteDraft}
                onChange={setNoteDraft}
                placeholder="hal. Nakatira sa kabilang street, bayad tuwing sweldo"
                maxLength={200}
                multiline
              />
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Button title="Kanselahin" variant="outline" size="sm" style={{ flex: 1 }} onPress={() => setNoteEditing(false)} />
                <Button title="I-save" size="sm" style={{ flex: 1 }} onPress={saveNote} />
              </View>
            </View>
          ) : (
            <Text style={{ fontSize: 12.5, color: noteText ? palette.foreground : palette.mutedForeground }}>
              {noteText || "Magdagdag ng paalala tungkol sa suki…"}
            </Text>
          )}
        </View>

        <Divider />

        {/* History */}
        <Text style={{ fontSize: 13.5, fontWeight: "800", color: palette.foreground }}>Tala</Text>
        {(detail?.transactions.length ?? 0) === 0 ? (
          <Text style={{ fontSize: 12.5, color: palette.mutedForeground }}>
            Wala pang tala — Idagdag ang unang utang ni {customer?.name}.
          </Text>
        ) : (
          <View style={{ gap: 8 }}>
            {detail!.transactions.map((t) => {
              const isUtang = t.type === "utang";
              const tDue = isUtang ? dueInfo(t.dueDate) : null;
              return (
                <View key={t.id} style={[styles.txnRow, { borderColor: palette.border }]}>
                  {isUtang ? (
                    <ArrowDownCircle size={20} color={palette.tones.orange.solid} />
                  ) : (
                    <ArrowUpCircle size={20} color={palette.tones.emerald.solid} />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: "600", color: palette.foreground }} numberOfLines={1}>
                      {t.note || (isUtang ? "Utang" : "Bayad")}
                    </Text>
                    <Text style={{ fontSize: 11, color: palette.mutedForeground }}>
                      {`${formatDayLabel(t.date)} · ${formatTime(t.date)}`}
                    </Text>
                    {isUtang ? (
                      tDue ? (
                        <Pressable onPress={() => setDueTxn({ id: t.id, amount: t.amount, dueDate: t.dueDate })} style={{ marginTop: 4, alignSelf: "flex-start" }}>
                          <Badge
                            label={tDue.label}
                            tone={tDue.tone === "late" ? "rose" : tDue.tone === "today" ? "orange" : tDue.tone === "soon" ? "amber" : "teal"}
                          />
                        </Pressable>
                      ) : (
                        <Pressable
                          onPress={() => setDueTxn({ id: t.id, amount: t.amount, dueDate: null })}
                          style={[styles.dueChip, { borderColor: palette.border }]}
                          accessibilityRole="button"
                          accessibilityLabel="Mag-set ng due"
                        >
                          <CalendarPlus size={11} color={palette.mutedForeground} />
                          <Text style={{ fontSize: 10.5, fontWeight: "700", color: palette.mutedForeground }}>
                            Mag-set ng due
                          </Text>
                        </Pressable>
                      )
                    ) : null}
                  </View>
                  <Text
                    style={{
                      fontSize: 13.5,
                      fontWeight: "800",
                      color: isUtang ? palette.tones.orange.text : palette.tones.emerald.text,
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    {isUtang ? `+${peso(t.amount)}` : `-${peso(t.amount)}`}
                  </Text>
                  <Pressable
                    onPress={() => deleteTxn(t.id, !isUtang, peso(t.amount))}
                    accessibilityRole="button"
                    accessibilityLabel="Burahin ang tala"
                    hitSlop={8}
                    style={{ padding: 4 }}
                  >
                    <Trash2 size={15} color={palette.tones.rose.solid} />
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}

        {/* Danger zone */}
        <Pressable onPress={deleteThisCustomer} style={styles.deleteCustomer} accessibilityRole="button" accessibilityLabel="Burahin ang customer">
          <Trash2 size={14} color={palette.tones.rose.text} />
          <Text style={{ color: palette.tones.rose.text, fontSize: 12, fontWeight: "700" }}>
            Burahin si {customer?.name}
          </Text>
        </Pressable>
      </Sheet>

      <AddUtangSheet
        visible={addUtangOpen}
        onClose={() => setAddUtangOpen(false)}
        lockedCustomer={customer ? { id: customer.id, name: customer.name } : null}
      />
      <PaymentSheet
        visible={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        customer={customer ? { id: customer.id, name: customer.name, balance: roundMoney(balance) } : null}
      />
      <DueDateDialog
        visible={dueTxn !== null}
        onClose={() => setDueTxn(null)}
        txn={dueTxn}
        customerName={customer?.name ?? ""}
      />
    </>
  );
}

const styles = StyleSheet.create({
  balanceRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  reminderBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderRadius: radius.md,
    padding: 12,
  },
  txnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: 10,
  },
  dueChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: "flex-start",
  },
  deleteCustomer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
  },
});
