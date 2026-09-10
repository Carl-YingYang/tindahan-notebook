"use client";

import { useCallback, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import BottomNav from "./bottom-nav";
import { NavContext, type TabKey } from "./nav-context";
import HomeScreen from "@/components/screens/home-screen";
import UtangScreen from "@/components/screens/utang-screen";
import TindaScreen from "@/components/screens/tinda-screen";
import RestockScreen from "@/components/screens/restock-screen";
import AiScreen from "@/components/screens/ai-screen";

// Subtle native-feeling tab transition
const SCREEN_VARIANTS = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
};

export default function AppShell() {
  const [tab, setTab] = useState<TabKey>("home");
  const [intent, setIntent] = useState<string | null>(null);

  const go = useCallback((t: TabKey, i?: string) => {
    setTab(t);
    setIntent(i ?? null);
    // Keep the view pinned to the top, like switching screens in a native app
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  }, []);

  const clearIntent = useCallback(() => setIntent(null), []);

  const nav = useMemo(() => ({ tab, go, intent, clearIntent }), [tab, go, intent, clearIntent]);

  return (
    <NavContext.Provider value={nav}>
      <div className="min-h-screen bg-muted/60 dark:bg-background flex justify-center">
        <div className="w-full max-w-md min-h-screen bg-background flex flex-col shadow-[0_0_40px_rgba(0,0,0,0.06)]">
          <main className="flex-1 pb-safe-nav">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={tab}
                variants={SCREEN_VARIANTS}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.18, ease: "easeOut" }}
              >
                {tab === "home" && <HomeScreen />}
                {tab === "utang" && <UtangScreen />}
                {tab === "tinda" && <TindaScreen />}
                {tab === "restock" && <RestockScreen />}
                {tab === "suki" && <AiScreen />}
              </motion.div>
            </AnimatePresence>
          </main>
          <BottomNav />
        </div>
      </div>
    </NavContext.Provider>
  );
}
