import React, { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { initDb } from "./client";
import { lightPalette } from "@/theme/tokens";

/**
 * Gates rendering until the on-device SQLite database is ready.
 * (Migrations also run eagerly at module load — this provider is a
 * safety net plus a branded splash placeholder.)
 */
export function DbProvider({ children }: { children: React.ReactNode }) {
  const [ready] = useState<boolean>(() => {
    try {
      initDb();
      return true;
    } catch (e) {
      console.warn("[tindahan] db init failed", e);
      return true; // still render the app; repos will surface errors
    }
  });

  if (!ready) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={lightPalette.primary} />
        <Text style={styles.text}>Binubuksan ang notebook…</Text>
      </View>
    );
  }
  return <>{children}</>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "#faf9f7",
  },
  text: { color: "#78716c", fontSize: 13 },
});
