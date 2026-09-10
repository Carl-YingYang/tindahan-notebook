import React, { createContext, useContext, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import { darkPalette, lightPalette, type Palette } from "./tokens";
import { getThemeOverride, setThemeOverride } from "@/db/repos/settings";

type Override = "light" | "dark" | null;

interface ThemeCtx {
  palette: Palette;
  scheme: "light" | "dark";
  override: Override;
  setOverride: (m: Override) => void;
}

const ThemeContext = createContext<ThemeCtx>({
  palette: lightPalette,
  scheme: "light",
  override: null,
  setOverride: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [override, setOverrideState] = useState<Override>(() => {
    try {
      return getThemeOverride();
    } catch {
      return null;
    }
  });

  const scheme: "light" | "dark" = override ?? (system === "dark" ? "dark" : "light");

  const setOverride = (m: Override) => {
    setOverrideState(m);
    try {
      setThemeOverride(m);
    } catch {
      // non-fatal
    }
  };

  const value = useMemo<ThemeCtx>(
    () => ({
      palette: scheme === "dark" ? darkPalette : lightPalette,
      scheme,
      override,
      setOverride,
    }),
    [scheme, override]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
