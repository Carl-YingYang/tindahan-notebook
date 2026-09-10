import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";
import { useTheme } from "@/theme/theme";
import { radius } from "@/theme/tokens";
import type { ToneKey } from "@/logic/constants";

/* ---------- Button ---------- */

type Variant = "primary" | "emerald" | "orange" | "rose" | "outline" | "ghost" | "muted";
type Size = "md" | "sm";

interface ButtonProps {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  busy?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  accessibilityLabel?: string;
}

export function Button({
  title,
  onPress,
  variant = "primary",
  size = "md",
  disabled,
  busy,
  icon,
  style,
  accessibilityLabel,
}: ButtonProps) {
  const { palette } = useTheme();
  const bg: Record<Variant, string> = {
    primary: palette.primary,
    emerald: palette.tones.emerald.solid,
    orange: palette.tones.orange.solid,
    rose: palette.tones.rose.solid,
    outline: "transparent",
    ghost: "transparent",
    muted: palette.muted,
  };
  const fg: Record<Variant, string> = {
    primary: palette.primaryForeground,
    emerald: palette.tones.emerald.onSolid,
    orange: palette.tones.orange.onSolid,
    rose: "#ffffff",
    outline: palette.foreground,
    ghost: palette.foreground,
    muted: palette.foreground,
  };
  const isOutline = variant === "outline";
  const blocked = disabled || busy;

  return (
    <Pressable
      onPress={onPress}
      disabled={blocked}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!blocked, busy: !!busy }}
      style={({ pressed }) => [
        styles.button,
        size === "sm" ? styles.buttonSm : styles.buttonMd,
        { backgroundColor: bg[variant], opacity: disabled ? 0.45 : pressed ? 0.82 : 1 },
        isOutline && { borderWidth: 1, borderColor: palette.border },
        style as ViewStyle,
      ]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={fg[variant]} />
      ) : (
        icon
      )}
      <Text
        style={[
          styles.buttonText,
          size === "sm" ? styles.buttonTextSm : styles.buttonTextMd,
          { color: fg[variant] },
        ]}
        numberOfLines={1}
      >
        {title}
      </Text>
    </Pressable>
  );
}

/* ---------- Card ---------- */

export function Card({
  children,
  style,
  onPress,
  accessibilityLabel,
}: {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const { palette } = useTheme();
  const base: ViewStyle = {
    backgroundColor: palette.card,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    padding: 16,
  };
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => [base, { opacity: pressed ? 0.85 : 1 }, style as ViewStyle]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[base, style as ViewStyle]}>{children}</View>;
}

/* ---------- Badge / Chip / Dot / Avatar ---------- */

export function Badge({
  label,
  tone = "amber",
  style,
}: {
  label: string;
  tone?: ToneKey;
  style?: ViewStyle;
}) {
  const { palette } = useTheme();
  const t = palette.tones[tone];
  return (
    <View
      style={[
        {
          backgroundColor: t.soft,
          borderColor: t.border,
          borderWidth: 1,
          borderRadius: radius.pill,
          paddingHorizontal: 8,
          paddingVertical: 2,
          alignSelf: "flex-start",
        },
        style,
      ]}
    >
      <Text style={{ color: t.text, fontSize: 11, fontWeight: "700" }}>{label}</Text>
    </View>
  );
}

export function Dot({ tone, size = 8 }: { tone: ToneKey; size?: number }) {
  const { palette } = useTheme();
  return (
    <View
      style={{
        backgroundColor: palette.tones[tone].solid,
        width: size,
        height: size,
        borderRadius: size / 2,
      }}
    />
  );
}

export function Avatar({
  name,
  tone,
  late,
  size = 40,
}: {
  name: string;
  tone: ToneKey;
  late?: boolean;
  size?: number;
}) {
  const { palette } = useTheme();
  const t = palette.tones[tone];
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: t.soft,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: late ? 2 : 0,
        borderColor: late ? palette.tones.rose.solid : "transparent",
      }}
      accessibilityLabel={`${name} avatar`}
    >
      <Text style={{ color: t.text, fontWeight: "800", fontSize: size * 0.42 }}>
        {name.trim().charAt(0).toUpperCase() || "?"}
      </Text>
    </View>
  );
}

/* ---------- Headers ---------- */

export function ScreenHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  const { palette } = useTheme();
  return (
    <View style={styles.headerRow}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.headerTitle, { color: palette.foreground }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.headerSubtitle, { color: palette.mutedForeground }]}>{subtitle}</Text>
        ) : null}
      </View>
      {right ? <View style={styles.headerRight}>{right}</View> : null}
    </View>
  );
}

export function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  const { palette } = useTheme();
  return (
    <View style={styles.sectionRow}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.sectionTitle, { color: palette.foreground }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.sectionSubtitle, { color: palette.mutedForeground }]}>{subtitle}</Text>
        ) : null}
      </View>
      {action}
    </View>
  );
}

/* ---------- Empty state ---------- */

export function EmptyState({
  icon,
  title,
  subtitle,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  const { palette } = useTheme();
  return (
    <View style={styles.empty}>
      {icon}
      <Text style={[styles.emptyTitle, { color: palette.foreground }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.emptySubtitle, { color: palette.mutedForeground }]}>{subtitle}</Text>
      ) : null}
      {action ? <View style={{ marginTop: 12 }}>{action}</View> : null}
    </View>
  );
}

export function Divider() {
  const { palette } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: palette.border }} />;
}

/* ---------- text helpers ---------- */

export const moneyText: TextStyle = {
  fontVariant: ["tabular-nums"],
  fontWeight: "800",
};

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: radius.md,
  },
  buttonMd: { paddingHorizontal: 16, paddingVertical: 12, minHeight: 44 },
  buttonSm: { paddingHorizontal: 12, paddingVertical: 8, minHeight: 36 },
  buttonText: { fontWeight: "800" },
  buttonTextMd: { fontSize: 14 },
  buttonTextSm: { fontSize: 12.5 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingBottom: 4,
  },
  headerTitle: { fontSize: 22, fontWeight: "800", letterSpacing: -0.3 },
  headerSubtitle: { fontSize: 12.5, marginTop: 2 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionRow: { flexDirection: "row", alignItems: "flex-end", gap: 12, marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: "800" },
  sectionSubtitle: { fontSize: 12, marginTop: 2 },
  empty: { alignItems: "center", paddingVertical: 28, paddingHorizontal: 16, gap: 4 },
  emptyTitle: { fontSize: 14.5, fontWeight: "700", marginTop: 6 },
  emptySubtitle: { fontSize: 12.5, textAlign: "center", maxWidth: 280 },
});
