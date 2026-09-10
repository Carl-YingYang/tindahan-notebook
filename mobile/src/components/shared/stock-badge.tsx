import React from "react";
import { Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";
import { useTheme } from "@/theme/theme";
import { radius } from "@/theme/tokens";
import { STOCK_STATUSES, stockStatusMeta, type StockStatus } from "@/logic/constants";

/** Colored stock badge — colors mirror the web prototype exactly. */
export function StockStatusBadge({ status }: { status: StockStatus }) {
  const { palette } = useTheme();
  const meta = stockStatusMeta(status);
  const t = palette.tones[meta.tone];
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        backgroundColor: t.soft,
        borderColor: t.border,
        borderWidth: 1,
        borderRadius: radius.pill,
        paddingHorizontal: 9,
        paddingVertical: 3,
        alignSelf: "flex-start",
      }}
    >
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: t.solid }} />
      <Text style={{ color: t.text, fontSize: 11.5, fontWeight: "700" }}>{meta.label}</Text>
    </View>
  );
}

/** One-tap 4-segment stock status control (Marami/Sakto/Paubos/Ubos). */
export function StockSegmentControl({
  value,
  onChange,
  style,
}: {
  value: StockStatus;
  onChange: (next: StockStatus) => void;
  style?: ViewStyle;
}) {
  const { palette } = useTheme();
  return (
    <View
      style={[
        {
          flexDirection: "row",
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: palette.border,
          overflow: "hidden",
        },
        style,
      ]}
      accessibilityRole="radiogroup"
    >
      {STOCK_STATUSES.map((s, i) => {
        const active = s.value === value;
        const t = palette.tones[s.tone];
        return (
          <Pressable
            key={s.value}
            onPress={() => onChange(s.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={s.label}
            style={({ pressed }) => ({
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              paddingVertical: 8,
              backgroundColor: active ? t.soft : pressed ? palette.muted : "transparent",
              borderLeftWidth: i === 0 ? 0 : StyleSheet.hairlineWidth,
              borderLeftColor: palette.border,
            })}
          >
            <Text style={{ fontSize: 11.5, fontWeight: active ? "800" : "600", color: active ? t.text : palette.mutedForeground }}>
              {s.short}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** 2×2 grid picker used inside the product drawer. */
export function StockStatusPicker({
  value,
  onChange,
}: {
  value: StockStatus;
  onChange: (next: StockStatus) => void;
}) {
  const { palette } = useTheme();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {STOCK_STATUSES.map((s) => {
        const active = s.value === value;
        const t = palette.tones[s.tone];
        return (
          <Pressable
            key={s.value}
            onPress={() => onChange(s.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={s.label}
            style={{
              flexGrow: 1,
              flexBasis: "47%",
              alignItems: "center",
              paddingVertical: 10,
              borderRadius: radius.md,
              borderWidth: 2,
              borderColor: active ? t.solid : palette.border,
              backgroundColor: active ? t.soft : "transparent",
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: active ? "800" : "600", color: active ? t.text : palette.mutedForeground }}>
              {s.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({});
