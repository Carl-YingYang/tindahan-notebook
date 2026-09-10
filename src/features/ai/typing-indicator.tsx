"use client";

// ── Typing indicator shown while POST /api/ai/chat is pending ────

export function TypingIndicator() {
  return (
    <div className="self-start">
      <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-primary">Suki</p>
      <div
        role="status"
        aria-label="Nag-iisip si Suki"
        className="flex w-fit items-center gap-1.5 rounded-2xl rounded-bl-md border bg-card px-4 py-3.5"
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-2 rounded-full bg-muted-foreground/70 animate-bounce"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
