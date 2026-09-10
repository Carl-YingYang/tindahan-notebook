import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ListCollapse } from "lucide-react-native";
import { useTheme } from "@/theme/theme";
import { peso, pesoSigned } from "@/logic/format";
import type { DailyBucket } from "@/types";

/**
 * Nitong Linggo — 7 stacked columns (emerald benta / rose gastos).
 * Ported from web week-chart.tsx with the tap-to-view-day pill.
 */
export function WeekChart({
  data,
  onViewDay,
}: {
  data: DailyBucket[];
  onViewDay?: (date: string, label: string) => void;
}) {
  const { palette } = useTheme();
  const [selected, setSelected] = useState<number | null>(null);

  const maxVal = Math.max(1, ...data.map((d) => Math.max(d.benta, d.gastos)));

  return (
    <View>
      <View style={styles.row}>
        {data.map((d, i) => {
          const active = selected === i;
          return (
            <Pressable
              key={d.date}
              onPress={() => setSelected(active ? null : i)}
              accessibilityRole="button"
              accessibilityLabel={`${d.label}: benta ${peso(d.benta)}, gastos ${peso(d.gastos)}`}
              style={styles.col}
            >
              <View style={styles.bars}>
                <View
                  style={[
                    styles.barBenta,
                    {
                      height: Math.max(3, Math.round((d.benta / maxVal) * 92)),
                      backgroundColor: palette.tones.emerald.solid,
                      opacity: selected === null || active ? 1 : 0.35,
                    },
                  ]}
                />
                <View
                  style={[
                    styles.barGastos,
                    {
                      height: Math.max(3, Math.round((d.gastos / maxVal) * 92)),
                      backgroundColor: palette.tones.rose.solid,
                      opacity: selected === null || active ? 1 : 0.35,
                    },
                  ]}
                />
              </View>
              <Text
                style={[
                  styles.dayLabel,
                  { color: active ? palette.primary : palette.mutedForeground },
                ]}
              >
                {d.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={[styles.detail, { borderColor: palette.border }]}>
        {selected !== null && data[selected] ? (
          <>
            <Text style={{ color: palette.foreground, fontSize: 12.5, fontWeight: "700" }}>
              {`${data[selected].label} ${peso(data[selected].benta)} -${peso(data[selected].gastos)} = ${pesoSigned(
                data[selected].benta - data[selected].gastos
              )}`}
            </Text>
            {onViewDay ? (
              <Pressable
                onPress={() => onViewDay(data[selected].date, data[selected].label)}
                style={[styles.viewDayPill, { backgroundColor: palette.primarySoft }]}
                accessibilityRole="button"
                accessibilityLabel={`Tingnan ang mga tala ng ${data[selected].label}`}
              >
                <ListCollapse size={13} color={palette.primary} />
                <Text style={{ color: palette.primary, fontSize: 11.5, fontWeight: "800" }}>
                  {`Tingnan ang mga tala ng ${data[selected].label}`}
                </Text>
              </Pressable>
            ) : null}
          </>
        ) : (
          <>
            <Legend color={palette.tones.emerald.solid} label="Benta" />
            <Legend color={palette.tones.rose.solid} label="Gastos" />
            <Text style={{ color: palette.mutedForeground, fontSize: 11.5, marginLeft: "auto" }}>
              Pindutin ang araw para makita
            </Text>
          </>
        )}
      </View>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Text style={{ fontSize: 11, color: "#78716c", fontWeight: "600" }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-end", gap: 6, height: 118 },
  col: { flex: 1, alignItems: "center", gap: 6 },
  bars: { flexDirection: "row", alignItems: "flex-end", gap: 3, height: 96 },
  barBenta: { width: 9, borderRadius: 5 },
  barGastos: { width: 9, borderRadius: 5 },
  dayLabel: { fontSize: 10.5, fontWeight: "700" },
  detail: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexWrap: "wrap",
  },
  viewDayPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
});
