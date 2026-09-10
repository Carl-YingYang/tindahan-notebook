import React from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { X } from "lucide-react-native";
import { useTheme } from "@/theme/theme";
import { radius } from "@/theme/tokens";

/**
 * Bottom sheet — the mobile equivalent of the web prototype's shadcn Sheets.
 * Slides up from the bottom, dimmed scrim, tap-outside to close.
 */
export function Sheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxHeightRatio = 0.88,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxHeightRatio?: number;
}) {
  const { palette } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <Pressable style={[styles.scrim, { backgroundColor: palette.scrim }]} onPress={onClose} accessibilityLabel="Isara" />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: palette.background,
              maxHeight: `${Math.round(maxHeightRatio * 100)}%` as `${number}%`,
            },
          ]}
        >
          <View style={styles.handleWrap}>
            <View style={[styles.handle, { backgroundColor: palette.border }]} />
          </View>
          <View style={styles.header}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={[styles.title, { color: palette.foreground }]}>{title}</Text>
              {subtitle ? (
                <Text style={[styles.subtitle, { color: palette.mutedForeground }]}>{subtitle}</Text>
              ) : null}
            </View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Isara"
              hitSlop={8}
              style={{ padding: 6 }}
            >
              <X size={20} color={palette.mutedForeground} />
            </Pressable>
          </View>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16, gap: 14 }}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
          {footer ? (
            <View style={[styles.footer, { borderTopColor: palette.border }]}>{footer}</View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, justifyContent: "flex-end" },
  scrim: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: "88%",
    paddingBottom: 8,
  },
  handleWrap: { alignItems: "center", paddingTop: 10 },
  handle: { width: 40, height: 4, borderRadius: 2 },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 2,
  },
  title: { fontSize: 17, fontWeight: "800" },
  subtitle: { fontSize: 12.5, marginTop: 2 },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: 16,
    paddingBottom: 24,
  },
});
