"use client";

// ── Empty-state intro + example question chips for Suki AI ──────

import { Sparkles } from "lucide-react";

const STARTERS = [
  "Ano ang dapat kong i-restock?",
  "Ano ang malapit nang maubos?",
  "Magkano ang net ko ngayong week?",
  "May ₱2,000 akong budget, ano ang magandang bilhin?",
  "Gawan mo ako ng shopping list.",
  "Ano ang pinaka malaki kong gastos this week?",
];

export function StarterIntro({
  disabled,
  onAsk,
}: {
  disabled?: boolean;
  onAsk: (question: string) => void;
}) {
  return (
    <div className="my-auto flex flex-col items-center gap-3 py-2 text-center">
      <div className="flex size-11 items-center justify-center rounded-full bg-primary/15">
        <Sparkles className="size-5 text-primary" />
      </div>

      <div className="space-y-1">
        <p className="text-base font-extrabold tracking-tight">Ako si Suki!</p>
        <p className="mx-auto max-w-[17rem] text-[13px] leading-snug text-muted-foreground">
          Tanungin mo ako tungkol sa tindahan mo — benta, gastos, utang, o restock.
        </p>
      </div>

      <div className="flex max-w-[24rem] flex-wrap justify-center gap-1.5">
        {STARTERS.map((question) => (
          <button
            key={question}
            type="button"
            disabled={disabled}
            onClick={() => onAsk(question)}
            className="min-h-9 rounded-xl border bg-card px-3 py-1.5 text-left text-[12px] font-medium shadow-xs transition touch-manipulation select-none active:scale-95 disabled:pointer-events-none disabled:opacity-50"
          >
            {question}
          </button>
        ))}
      </div>
    </div>
  );
}
