"use client";

import { Home, HandCoins, ShoppingBasket, PackageOpen, Sparkles } from "lucide-react";
import { useAppNav, type TabKey } from "./nav-context";
import { cn } from "@/lib/utils";

const TABS: {
  key: TabKey;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  accent?: boolean;
}[] = [
  { key: "home", label: "Home", icon: Home },
  { key: "utang", label: "Utang", icon: HandCoins },
  { key: "tinda", label: "Tinda", icon: ShoppingBasket },
  { key: "restock", label: "Restock", icon: PackageOpen },
  { key: "suki", label: "Suki AI", icon: Sparkles, accent: true },
];

export default function BottomNav() {
  const { tab, go } = useAppNav();

  return (
    <nav
      aria-label="Pangunahing navigation"
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-40 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85 pb-safe shadow-[0_-6px_20px_-12px_rgba(0,0,0,0.18)]"
    >
      <div className="grid grid-cols-5 h-16">
        {TABS.map(({ key, label, icon: Icon, accent }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              type="button"
              aria-label={label}
              aria-current={active ? "page" : undefined}
              onClick={() => go(key)}
              className={cn(
                "relative flex flex-col items-center justify-center gap-1 min-h-[44px] transition-colors",
                "active:scale-95 touch-manipulation select-none",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "flex items-center justify-center rounded-full px-3 py-0.5 transition-all",
                  active
                    ? accent
                      ? "bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-500/15 dark:to-orange-500/10"
                      : "bg-primary/10"
                    : "bg-transparent"
                )}
              >
                <Icon
                  className={cn("size-5 transition-transform", active && "scale-110")}
                  strokeWidth={active ? 2.4 : 2}
                />
              </span>
              <span className={cn("text-[11px] leading-none", active ? "font-bold" : "font-medium")}>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
