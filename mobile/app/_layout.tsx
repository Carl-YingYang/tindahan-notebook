import React from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { DbProvider } from "@/db/provider";
import { ThemeProvider, useTheme } from "@/theme/theme";
import { ToastProvider } from "@/components/shared/toast";

function ThemedStatusBar() {
  const { scheme } = useTheme();
  return <StatusBar style={scheme === "dark" ? "light" : "dark"} />;
}

export default function RootLayout() {
  return (
    <DbProvider>
      <ThemeProvider>
        <ToastProvider>
          <ThemedStatusBar />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "transparent" } }}>
            <Stack.Screen name="(tabs)" />
          </Stack>
        </ToastProvider>
      </ThemeProvider>
    </DbProvider>
  );
}
