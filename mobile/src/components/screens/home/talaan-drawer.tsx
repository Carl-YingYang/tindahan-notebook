import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { CalendarDays, ChevronLeft, ChevronRight, Trophy } from "lucide-react-native";
import { Sheet } from "@/components/shared/sheet";
import { Button, Card } from "@/components/shared/ui";
import { useTheme } from "@/theme/theme";
import { useToast } from "@/components/shared/toast";
import { useDbQuery } from "@/store/data";
import { getMonthReport } from "@/db/repos/records";
import { peso, pesoSigned, manilaMonthStr } from "@/logic/format";
import { radius } from "@/theme/tokens";

/** Talaan — buwanang report drawer with CSV copy (offline clipboard export). */
export function TalaanDrawer({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { palette } = useTheme();
  const toast = useToast();
  const [month, setMonth] = useState(() => manilaMonthStr());
  const report = useDbQuery(() => getMonthReport(month), [month]);

  const canGoPrev = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    return y > 2020;
  }, [month]);

  const shiftMonth = (delta: number) => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    setMonth(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  };

  const copyCsv = async () => {
    if (!report) return;
    const header = "Araw,Benta,Gastos,Net";
    const rows = report.daily
      .filter((d) => d.benta > 0 || d.gastos > 0)
      .map((d) => `${d.date},${d.benta},${d.gastos},${d.net}`);
    const csv = [`Talaan ${report.label}`, header, ...rows].join("\n");
    try {
      await Clipboard.setStringAsync(csv);
      toast.success("Nakopya ang CSV!");
    } catch {
      toast.error("Hindi ma-copy ang CSV, subukan ulit");
    }
  };

  const maxGastos = Math.max(1, ...(report?.gastosByCategory ?? []).map((g) => g.total));

  return (
    <Sheet visible={visible} onClose={onClose} title="Talaan" subtitle="Buwanang benta, gastos, at neto ng tindahan" maxHeightRatio={0.92}>
      <View style={styles.monthNav}>
        <Pressable
          onPress={() => canGoPrev && shiftMonth(-1)}
          accessibilityRole="button"
          accessibilityLabel="Nakaraang buwan"
          hitSlop={8}
          style={{ padding: 6, opacity: canGoPrev ? 1 : 0.3 }}
        >
          <ChevronLeft size={20} color={palette.foreground} />
        </Pressable>
        <Text style={{ fontSize: 15, fontWeight: "800", color: palette.foreground, flex: 1, textAlign: "center" }}>
          {report?.label ?? month}
        </Text>
        <Pressable
          onPress={() => shiftMonth(1)}
          accessibilityRole="button"
          accessibilityLabel="Susunod na buwan"
          hitSlop={8}
          style={{ padding: 6 }}
        >
          <ChevronRight size={20} color={palette.foreground} />
        </Pressable>
      </View>
      {month !== manilaMonthStr() ? (
        <Pressable
          onPress={() => setMonth(manilaMonthStr())}
          style={[styles.resetChip, { backgroundColor: palette.primarySoft }]}
          accessibilityRole="button"
          accessibilityLabel="Bumalik sa ngayong buwan"
        >
          <Text style={{ color: palette.primary, fontSize: 11.5, fontWeight: "800" }}>Bumalik sa ngayong buwan</Text>
        </Pressable>
      ) : null}

      <Card style={{ padding: 14, gap: 12 }}>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Tile label="Benta" value={peso(report?.benta ?? 0)} color={palette.tones.emerald.text} />
          <Tile label="Gastos" value={peso(report?.gastos ?? 0)} color={palette.tones.rose.text} />
          <Tile
            label="Net"
            value={pesoSigned(report?.net ?? 0)}
            color={(report?.net ?? 0) >= 0 ? palette.tones.amber.text : palette.tones.rose.text}
          />
        </View>
        <Button title="I-copy ang CSV" variant="outline" size="sm" icon={<CalendarDays size={14} color={palette.foreground} />} onPress={copyCsv} />
      </Card>

      <Card style={{ padding: 14, gap: 6 }}>
        <StatLine text={`Average net kada araw: ${peso(report?.avgDailyNet ?? 0)}`} />
        {report?.bestDay ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Trophy size={14} color={palette.tones.amber.text} />
            <StatLine text={`Pinakamalakas na araw: ${Number(report.bestDay.date.split("-")[2])} ng buwan — ${peso(report.bestDay.benta)}`} />
          </View>
        ) : null}
        <StatLine text={`${report?.salesCount ?? 0} benta records · ${report?.expensesCount ?? 0} gastos records · ${report?.activeDays ?? 0}/${report?.daysInMonth ?? 0} araw may tala`} />
      </Card>

      {(report?.gastosByCategory.length ?? 0) > 0 ? (
        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 13.5, fontWeight: "800", color: palette.foreground }}>Gastos ayon sa Category</Text>
          {report!.gastosByCategory.map((g) => (
            <View key={g.category} style={{ gap: 4 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 12, fontWeight: "600", color: palette.foreground }}>{g.category}</Text>
                <Text style={{ fontSize: 12, fontWeight: "700", color: palette.tones.rose.text, fontVariant: ["tabular-nums"] }}>
                  {peso(g.total)}
                </Text>
              </View>
              <View style={{ height: 6, borderRadius: 3, backgroundColor: palette.muted, overflow: "hidden" }}>
                <View
                  style={{
                    width: `${Math.round((g.total / maxGastos) * 100)}%`,
                    height: "100%",
                    borderRadius: 3,
                    backgroundColor: palette.tones.rose.solid,
                  }}
                />
              </View>
            </View>
          ))}
        </View>
      ) : null}

      <View style={{ gap: 8 }}>
        <Text style={{ fontSize: 13.5, fontWeight: "800", color: palette.foreground }}>Araw-araw</Text>
        <Text style={{ fontSize: 11, color: palette.mutedForeground }}>Benta / Gastos / Net</Text>
        {(report?.daily ?? [])
          .filter((d) => d.benta > 0 || d.gastos > 0)
          .slice()
          .reverse()
          .map((d) => (
            <View key={d.date} style={[styles.dayRow, { borderColor: palette.border }]}>
              <Text style={{ width: 44, fontSize: 12, fontWeight: "700", color: palette.mutedForeground }}>
                {`${d.label} ${d.day}`}
              </Text>
              <Text style={{ flex: 1, fontSize: 12, color: palette.tones.emerald.text, fontVariant: ["tabular-nums"], textAlign: "right" }}>
                +{peso(d.benta)}
              </Text>
              <Text style={{ flex: 1, fontSize: 12, color: palette.tones.rose.text, fontVariant: ["tabular-nums"], textAlign: "right" }}>
                -{peso(d.gastos)}
              </Text>
              <Text
                style={{
                  flex: 1,
                  fontSize: 12,
                  fontWeight: "700",
                  color: d.net >= 0 ? palette.foreground : palette.tones.rose.text,
                  fontVariant: ["tabular-nums"],
                  textAlign: "right",
                }}
              >
                {pesoSigned(d.net)}
              </Text>
            </View>
          ))}
      </View>
    </Sheet>
  );
}

function Tile({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
      <Text style={{ fontSize: 11, fontWeight: "700", color: "#78716c" }}>{label}</Text>
      <Text style={{ fontSize: 14.5, fontWeight: "800", color, fontVariant: ["tabular-nums"] }}>{value}</Text>
    </View>
  );
}

function StatLine({ text }: { text: string }) {
  return <Text style={{ fontSize: 12, color: "#78716c" }}>{text}</Text>;
}

const styles = StyleSheet.create({
  monthNav: { flexDirection: "row", alignItems: "center" },
  resetChip: {
    alignSelf: "center",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  dayRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: 8,
    gap: 4,
  },
});
