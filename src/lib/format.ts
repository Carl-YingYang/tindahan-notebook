// ── Formatting helpers (PHP peso, Manila dates, Taglish labels) ──

export function peso(n: number | null | undefined): string {
  const v = Number(n ?? 0);
  const hasCents = Math.round(v * 100) % 100 !== 0;
  return (
    "₱" +
    v.toLocaleString("en-PH", {
      minimumFractionDigits: hasCents ? 2 : 0,
      maximumFractionDigits: 2,
    })
  );
}

/** Convert a Date to Manila-time parts */
function manilaParts(d: Date): { y: number; m: number; day: number } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [y, m, day] = fmt.format(d).split("-").map(Number);
  return { y, m, day };
}

/** Date object for Manila midnight of "today" */
export function manilaDayStart(d: Date = new Date()): Date {
  const { y, m, day } = manilaParts(d);
  return new Date(`${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}T00:00:00+08:00`);
}

export function manilaDayEnd(d: Date = new Date()): Date {
  const start = manilaDayStart(d);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}

/** yyyy-mm-dd in Manila time */
export function manilaDateStr(d: Date = new Date()): string {
  const { y, m, day } = manilaParts(d);
  return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Whole days between an ISO date and now (Manila) — non-negative */
export function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const diffMs = manilaDayStart().getTime() - manilaDayStart(new Date(then)).getTime();
  return Math.max(0, Math.round(diffMs / (24 * 60 * 60 * 1000)));
}

const MONTHS = ["Ene", "Peb", "Mar", "Abr", "May", "Hun", "Hul", "Ago", "Set", "Okt", "Nob", "Dis"];

/** 'Ngayon' | 'Kahapon' | '3 araw ang nakalipas' | 'May 12' */
export function formatDayLabel(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const today = manilaDateStr();
  const that = manilaDateStr(d);
  if (today === that) return "Ngayong araw";
  const yesterday = manilaDateStr(new Date(Date.now() - 24 * 60 * 60 * 1000));
  if (yesterday === that) return "Kahapon";
  const days = daysSince(iso) ?? 0;
  if (days <= 7) return `${days} araw ang nakalipas`;
  const { m, day } = manilaParts(d);
  return `${MONTHS[m - 1]} ${day}`;
}

/** '2:45 PM' style time in Manila */
export function formatTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

/** 'May 12' style short date (Manila) */
export function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const { m, day } = manilaParts(d);
  return `${MONTHS[m - 1]} ${day}`;
}

/** 'Huwebes, May 8' style long date (Manila) */
const WEEKDAYS = ["Linggo", "Lunes", "Martes", "Miyerkules", "Huwebes", "Biyernes", "Sabado"];

export function formatLongDate(iso: Date | string = new Date()): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const { y, m, day } = manilaParts(d);
  const weekday = WEEKDAYS[d.getDay()];
  return `${weekday}, ${MONTHS[m - 1]} ${day}, ${y}`;
}

export function greetingForHour(hour: number): string {
  if (hour < 12) return "Magandang umaga";
  if (hour < 18) return "Magandang hapon";
  return "Magandang gabi";
}

// ── Utang due dates ("Kailan bayad?") ────────────────────────────

export type DueTone = "late" | "today" | "soon" | "future";

export interface DueInfo {
  label: string;
  tone: DueTone;
  /** Manila calendar-day offset from today (negative = late) */
  days: number;
}

/**
 * Human Taglish label for a due date, relative to Manila today.
 * Returns null when there is no (or an invalid) due date.
 */
export function dueInfo(iso: string | null | undefined): DueInfo | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const todayStr = manilaDateStr();
  const dueStr = manilaDateStr(d);
  const diffMs =
    manilaDayStart(d).getTime() - manilaDayStart().getTime();
  const days = Math.round(diffMs / (24 * 60 * 60 * 1000));
  if (days < 0) {
    return {
      label: days === -1 ? "Late kahapon" : `Late nang ${Math.abs(days)} araw`,
      tone: "late",
      days,
    };
  }
  if (dueStr === todayStr) return { label: "Due ngayon", tone: "today", days };
  if (days === 1) return { label: "Due bukas", tone: "soon", days };
  if (days <= 3) return { label: `Due sa ${days} araw`, tone: "soon", days };
  const { m, day } = manilaParts(d);
  return { label: `Due: ${MONTHS[m - 1]} ${day}`, tone: "future", days };
}

/** Tailwind classes per due tone (chip styling shared across screens). */
export const DUE_TONE_CLASS: Record<DueTone, string> = {
  late: "border-rose-200 bg-rose-100 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-400",
  today: "border-orange-300 bg-orange-100 text-orange-700 dark:border-orange-500/40 dark:bg-orange-500/15 dark:text-orange-400",
  soon: "border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-400",
  future: "border-border bg-muted text-muted-foreground",
};

/** Deterministic avatar tone per name — same suki always gets the same color. */
const AVATAR_TONES = [
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400",
  "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400",
  "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-400",
  "bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-400",
] as const;

export function avatarTone(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return AVATAR_TONES[Math.abs(hash) % AVATAR_TONES.length];
}
