import React from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Trash2 } from "lucide-react-native";
import { Sheet } from "@/components/shared/sheet";
import { Button } from "@/components/shared/ui";
import { useTheme } from "@/theme/theme";
import { useToast } from "@/components/shared/toast";
import { useDbQuery, refreshAll } from "@/store/data";
import { getDay, deleteSale, deleteExpense } from "@/db/repos/records";
import { AppError } from "@/db/repos/helpers";
import { peso, pesoSigned, formatTime, formatDayLabel } from "@/logic/format";
import { radius } from "@/theme/tokens";

/** Day detail sheet — totals strip + deletable benta/gastos rows. */
export function DaySheet({
  visible,
  onClose,
  date,
  label,
}: {
  visible: boolean;
  onClose: () => void;
  date: string | null;
  label: string;
}) {
  const { palette } = useTheme();
  const toast = useToast();
  const detail = useDbQuery(() => (date ? getDay(date) : null), [date]);

  const confirmDelete = (kind: "sale" | "expense", id: string, amountText: string) => {
    Alert.alert(
      "Burahin ang tala?",
      kind === "sale" ? `Buburahin ang benta na ${amountText}.` : `Buburahin ang gastos na ${amountText}.`,
      [
        { text: "Hindi na lang", style: "cancel" },
        {
          text: "Burahin",
          style: "destructive",
          onPress: () => {
            try {
              if (kind === "sale") deleteSale(id);
              else deleteExpense(id);
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

  if (!date) return null;
  const totals = detail?.totals ?? { benta: 0, gastos: 0, net: 0 };

  return (
    <Sheet visible={visible} onClose={onClose} title={`Tala — ${label}`} subtitle={formatDayLabel(`${date}T12:00:00+08:00`)}>
      <View style={[styles.totalsStrip, { borderColor: palette.border }]}>
        <TotalCell label="Benta" value={peso(totals.benta)} color={palette.tones.emerald.text} />
        <TotalCell label="Gastos" value={peso(totals.gastos)} color={palette.tones.rose.text} />
        <TotalCell label="Net" value={pesoSigned(totals.net)} color={totals.net >= 0 ? palette.foreground : palette.tones.rose.text} />
      </View>

      <Text style={[styles.tip, { color: palette.mutedForeground }]}>
        Tip: Pindutin ang 🗑 katabi ng tala para burahin kung mali.
      </Text>

      <Section
        title={`Benta (${detail?.sales.length ?? 0})`}
        rows={detail?.sales.map((s) => (
          <Row
            key={s.id}
            title={`${s.category || "Benta"}${s.note ? ` · ${s.note}` : ""}`}
            sub={formatTime(s.date)}
            amount={`+${peso(s.amount)}`}
            color={palette.tones.emerald.text}
            onDelete={() => confirmDelete("sale", s.id, peso(s.amount))}
          />
        ))}
        emptyText="Walang tala sa araw na ito."
      />
      <Section
        title={`Gastos (${detail?.expenses.length ?? 0})`}
        rows={detail?.expenses.map((e) => (
          <Row
            key={e.id}
            title={`${e.category}${e.note ? ` · ${e.note}` : ""}`}
            sub={formatTime(e.date)}
            amount={`-${peso(e.amount)}`}
            color={palette.tones.rose.text}
            onDelete={() => confirmDelete("expense", e.id, peso(e.amount))}
          />
        ))}
        emptyText=""
      />
    </Sheet>
  );
}

function TotalCell({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
      <Text style={{ fontSize: 11, fontWeight: "700", color: "#78716c" }}>{label}</Text>
      <Text style={{ fontSize: 15, fontWeight: "800", color, fontVariant: ["tabular-nums"] }}>{value}</Text>
    </View>
  );
}

function Section({ title, rows, emptyText }: { title: string; rows?: React.ReactNode; emptyText: string }) {
  const { palette } = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontSize: 13.5, fontWeight: "800", color: palette.foreground }}>{title}</Text>
      {rows && React.Children.count(rows) > 0 ? (
        <View style={{ gap: 6 }}>{rows}</View>
      ) : (
        <Text style={{ fontSize: 12.5, color: palette.mutedForeground }}>{emptyText}</Text>
      )}
    </View>
  );
}

function Row({
  title,
  sub,
  amount,
  color,
  onDelete,
}: {
  title: string;
  sub: string;
  amount: string;
  color: string;
  onDelete: () => void;
}) {
  const { palette } = useTheme();
  return (
    <View style={[styles.row, { borderColor: palette.border }]}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13, fontWeight: "600", color: palette.foreground }} numberOfLines={1}>
          {title}
        </Text>
        <Text style={{ fontSize: 11, color: palette.mutedForeground }}>{sub}</Text>
      </View>
      <Text style={{ fontSize: 13.5, fontWeight: "800", color, fontVariant: ["tabular-nums"] }}>{amount}</Text>
      <Pressable
        onPress={onDelete}
        accessibilityRole="button"
        accessibilityLabel="Burahin ang tala"
        hitSlop={8}
        style={{ padding: 6 }}
      >
        <Trash2 size={15} color={palette.tones.rose.solid} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  totalsStrip: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingVertical: 10,
    backgroundColor: "rgba(0,0,0,0.015)",
  },
  tip: { fontSize: 11.5 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: 10,
  },
});
