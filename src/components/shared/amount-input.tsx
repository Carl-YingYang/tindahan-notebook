"use client";

import { Input } from "@/components/ui/input";

export function parseAmount(s: string): number {
  const n = parseFloat(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/** Big, friendly peso input for thumb-typing amounts. */
export function AmountInput({
  value,
  onChange,
  placeholder = "0",
  autoFocus,
  ariaLabel = "Halaga",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  ariaLabel?: string;
}) {
  return (
    <div className="relative">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-muted-foreground"
      >
        ₱
      </span>
      <Input
        aria-label={ariaLabel}
        inputMode="decimal"
        autoComplete="off"
        autoFocus={autoFocus}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9.,]/g, ""))}
        className="h-14 rounded-2xl border-border pl-11 text-2xl font-bold tracking-tight placeholder:text-muted-foreground/50 focus-visible:ring-primary/40"
      />
    </div>
  );
}
