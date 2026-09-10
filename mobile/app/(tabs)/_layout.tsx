import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  HandCoins,
  Home,
  PackageOpen,
  ShoppingBasket,
  Sparkles,
  type LucideIcon,
} from "lucide-react-native";
import { useTheme } from "@/theme/theme";

interface TabItem {
  name: string;
  label: string;
  icon: LucideIcon;
  accent?: boolean;
}

/** Bottom nav — order/labels/icons preserved from the web prototype. */
const TABS: TabItem[] = [
  { name: "index", label: "Home", icon: Home },
  { name: "utang", label: "Utang", icon: HandCoins },
  { name: "tinda", label: "Tinda", icon: ShoppingBasket },
  { name: "restock", label: "Restock", icon: PackageOpen },
  { name: "suki", label: "Suki AI", icon: Sparkles, accent: true },
];

function AppTabBar({ state, navigation }: any) {
  const { palette, scheme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor:
            scheme === "dark" ? "rgba(28,25,23,0.96)" : "rgba(255,255,255,0.96)",
          borderTopColor: palette.border,
          paddingBottom: Math.max(insets.bottom, 8),
        },
      ]}
      accessibilityLabel="Pangunahing navigation"
    >
      {TABS.map((tab) => {
        const routeIndex = state.routes.findIndex((r: any) => r.name === tab.name);
        const focused = state.index === routeIndex;
        const Icon = tab.icon;
        const color = focused ? palette.primary : palette.mutedForeground;

        return (
          <Pressable
            key={tab.name}
            onPress={() => {
              const event = navigation.emit({
                type: "tabPress",
                target: state.routes[routeIndex]?.key,
                canPreventDefault: true,
              });
              if (!event.defaultPrevented) {
                navigation.navigate(tab.name);
              }
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={tab.label}
            style={styles.tab}
          >
            <View
              style={[
                styles.pill,
                tab.accent && focused
                  ? { backgroundColor: palette.tones.amber.soft }
                  : focused
                  ? { backgroundColor: palette.primarySoft }
                  : null,
              ]}
            >
              <Icon size={focused ? 22 : 20} color={color} strokeWidth={focused ? 2.4 : 2} />
            </View>
            <Text style={[styles.label, { color }]} numberOfLines={1}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  const { palette } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: palette.background },
      }}
      tabBar={(props) => <AppTabBar {...props} />}
    >
      {TABS.map((tab) => (
        <Tabs.Screen key={tab.name} name={tab.name} options={{ title: tab.label }} />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 6,
  },
  tab: { flex: 1, alignItems: "center", gap: 2 },
  pill: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { fontSize: 11, fontWeight: "700" },
});
