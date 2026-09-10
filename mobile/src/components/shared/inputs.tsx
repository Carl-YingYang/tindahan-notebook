import React from "react";
import { Pressable, StyleSheet, Text, TextInput, View, ViewStyle } from "react-native";
import { useTheme } from "@/theme/theme";
import { radius } from "@/theme/tokens";

/** Big ₱ input — digits and one decimal point only (web parity: decimal input). */
export function AmountInput({
  value,
  onChange,
  placeholder = "0.00",
  style,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  style?: ViewStyle;
}) {
  const { palette } = useTheme();
  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: palette.muted,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: palette.border,
          paddingHorizontal: 16,
        },
        style,
      ]}
    >
      <Text style={{ fontSize: 24, fontWeight: "800", color: palette.mutedForeground, marginRight: 8 }}>
        ₱
      </Text>
      <TextInput
        value={value}
        onChangeText={(t) => {
          const cleaned = t.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");
          onChange(cleaned);
        }}
        placeholder={placeholder}
        placeholderTextColor={palette.mutedForeground}
        keyboardType="decimal-pad"
        inputMode="decimal"
        style={{
          flex: 1,
          fontSize: 24,
          fontWeight: "800",
          color: palette.foreground,
          paddingVertical: 14,
          fontVariant: ["tabular-nums"],
        }}
        returnKeyType="done"
      />
    </View>
  );
}

/** Compact labeled text input used across sheets/forms. */
export function FieldInput({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
  multiline,
  keyboardType = "default",
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  multiline?: boolean;
  keyboardType?: "default" | "numeric" | "decimal-pad";
}) {
  const { palette } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      {label ? (
        <Text style={{ fontSize: 12.5, fontWeight: "700", color: palette.mutedForeground }}>{label}</Text>
      ) : null}
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={palette.mutedForeground}
        maxLength={maxLength}
        multiline={multiline}
        keyboardType={keyboardType}
        style={{
          backgroundColor: palette.card,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: palette.border,
          paddingHorizontal: 12,
          paddingVertical: multiline ? 10 : 12,
          fontSize: 14,
          color: palette.foreground,
          minHeight: multiline ? 76 : 44,
          textAlignVertical: "top",
        }}
      />
    </View>
  );
}

/** Selectable pill chip (categories, units, quick due dates…). */
export function SelectChip({
  label,
  active,
  onPress,
  tone,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  tone?: "primary" | "orange" | "emerald";
}) {
  const { palette } = useTheme();
  const activeColor =
    tone === "orange"
      ? palette.tones.orange
      : tone === "emerald"
      ? palette.tones.emerald
      : { soft: palette.primarySoft, border: palette.primary, text: palette.primary };
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={{
        backgroundColor: active ? activeColor.soft : "transparent",
        borderColor: active ? activeColor.border : palette.border,
        borderWidth: 1,
        borderRadius: radius.pill,
        paddingHorizontal: 12,
        paddingVertical: 7,
      }}
    >
      <Text
        style={{
          fontSize: 12.5,
          fontWeight: active ? "800" : "600",
          color: active ? activeColor.text : palette.mutedForeground,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
