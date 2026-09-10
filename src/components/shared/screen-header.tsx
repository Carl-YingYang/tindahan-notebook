"use client";

import { cn } from "@/lib/utils";

/** Sticky screen header with app-like feel. */
export function ScreenHeader({
  title,
  subtitle,
  right,
  className,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "sticky top-0 z-30 bg-background/90 backdrop-blur-md border-b border-border/60 px-4 pt-5 pb-3",
        className
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-extrabold tracking-tight">{title}</h1>
          {subtitle && <p className="truncate text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        {right && <div className="shrink-0 flex items-center gap-2">{right}</div>}
      </div>
    </header>
  );
}
