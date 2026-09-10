"use client";

import { createContext, useContext } from "react";

export type TabKey = "home" | "utang" | "tinda" | "restock" | "suki";

export interface AppNav {
  tab: TabKey;
  /** Switch tab, optionally carrying an intent (e.g. "scan", "add-utang") */
  go: (tab: TabKey, intent?: string) => void;
  /** One-shot intent consumed by the target screen */
  intent: string | null;
  clearIntent: () => void;
}

export const NavContext = createContext<AppNav>({
  tab: "home",
  go: () => {},
  intent: null,
  clearIntent: () => {},
});

export function useAppNav(): AppNav {
  return useContext(NavContext);
}
