/**
 * Money/date formatting ported 1:1 from the approved web prototype
 * (src/lib/format.ts). Everything is keyed to the Asia/Manila calendar day.
 */

export type DueTone = "late" | "today" | "soon" | "future";

export interface DueInfo {
  label: string;
  tone: DueTone;
  days: number;
}

export const MONTHS = [
  "Ene", "Peb", "Mar", "Abr", "May", "Hun",
  "Hul", "Ago", "Set", "Okt", "Nob", "Dis",
];

export const MONTHS_FULL = [
  "Enero", "Pebrero", "Marso", "Abril", "Mayo", "Hunyo",
  "Hulyo", "Agosto", "Setyembre", "Oktubre", "Nobyembre", "Disyembre",
];

export const WEEKDAYS = [
  "Linggo", "Lunes", "Martes", "Miyerkules", "Huwebes", "Biyernes", "Sabado",
];

export const WEEKDAYS_SHORT = ["Lin", "Lun", "Mar", "Miy", "Huw", "Biy", "Sab"];

export function roundMoney(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/** "₱1,234.56" — cents only shown when the amount actually has cents. */
export function peso(n: number | null | undefined): string {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v)) return "₱0";
  const hasCents = Math.round(v * 100) % 100 !== 0;
  return (
    "₱" +
    v.toLocaleString("en-PH", {
      minimumFractionDigits: hasCents ? 2 : 0,
      maximumFractionDigits: 2,
    })
  );
}

/** Signed peso with explicit + for positives (used for net / trend lines). */
export function pesoSigned(n: number): string {
  return n >= 0 ? `+${peso(n)}` : `-${peso(Math.abs(n))}`;
}

function manilaParts(d: Date): { y: string; m: string; day: string } {
  const [y, m, day] = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(d)
    .split("-");
  return { y, m, day };
}

/** Manila midnight of the calendar day containing `d`. */
export function manilaDayStart(d: Date = new Date()): Date {
  const { y, m, day } = manilaParts(d);
  return new Date(`${y}-${m}-${day}T00:00:00+08:00`);
}

/** Exclusive upper bound: Manila midnight of the NEXT day. */
export function manilaDayEnd(d: Date = new Date()): Date {
  return new Date(manilaDayStart(d).getTime() + 24 * 3600 * 1000);
}

/** "YYYY-MM-DD" as seen in Manila. */
export function manilaDateStr(d: Date = new Date()): string {
  const { y, m, day } = manilaParts(d);
  return `${y}-${m}-${day}`;
}

export function manilaMonthStr(d: Date = new Date()): string {
  const { y, m } = manilaParts(d);
  return `${y}-${m}`;
}

/** Whole Manila days between then and now (never negative). */
export function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return null;
  return Math.max(
    0,
    Math.round((manilaDayStart().getTime() - manilaDayStart(then).getTime()) / 86400000)
  );
}

/** "Ngayong araw" / "Kahapon" / "3 araw ang nakalipas" / "Ene 12". */
export function formatDayLabel(iso: string | null | undefined): string {
  if (!iso) return "";
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "";
  const days = daysSince(iso);
  if (days === 0) return "Ngayong araw";
  if (days === 1) return "Kahapon";
  if (days !== null && days <= 7) return `${days} araw ang nakalipas`;
  const { m, day } = manilaParts(then);
  return `${MONTHS[Number(m) - 1]} ${Number(day)}`;
}

/** "2:45 PM" in Manila. */
export function formatTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "";
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(then);
}

/** "Ene 12". */
export function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "";
  const { m, day } = manilaParts(then);
  return `${MONTHS[Number(m) - 1]} ${Number(day)}`;
}

/** "Huwebes, May 8, 2026" (Manila). */
export function formatLongDate(d: Date = new Date()): string {
  const { y, m, day } = manilaParts(d);
  const weekday = new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    weekday: "long",
  }).format(d);
  return `${weekday}, ${MONTHS[Number(m) - 1]} ${Number(day)}, ${y}`;
}

export function greetingForHour(h: number): string {
  if (h < 12) return "Magandang umaga";
  if (h < 18) return "Magandang hapon";
  return "Magandang gabi";
}

/**
 * Due-date badge info. days = signed Manila-day offset vs today.
 *  - late:  "Late nang 3 araw" / "Late kahapon"
 *  - today: "Due ngayon"
 *  - soon:  "Due bukas" / "Due sa 3 araw"
 *  - future:"Due: Ene 12"
 */
export function dueInfo(iso: string | null | undefined): DueInfo | null {
  if (!iso) return null;
  const due = new Date(iso);
  if (Number.isNaN(due.getTime())) return null;
  const days = Math.round(
    (manilaDayStart(due).getTime() - manilaDayStart().getTime()) / 86400000
  );
  if (days < 0) {
    return {
      label: days === -1 ? "Late kahapon" : `Late nang ${Math.abs(days)} araw`,
      tone: "late",
      days,
    };
  }
  if (days === 0) return { label: "Due ngayon", tone: "today", days };
  if (days === 1) return { label: "Due bukas", tone: "soon", days };
  if (days <= 3) return { label: `Due sa ${days} araw`, tone: "soon", days };
  const { m, day } = manilaParts(due);
  return { label: `Due: ${MONTHS[Number(m) - 1]} ${Number(day)}`, tone: "future", days };
}

/** Rank used to sort the utang list: late first, then today, soon, future, none. */
export function dueUrgencyRank(info: DueInfo | null): number {
  if (!info) return 4;
  return info.tone === "late" ? 0 : info.tone === "today" ? 1 : info.tone === "soon" ? 2 : 3;
}

const AVATAR_TONE_KEYS = ["emerald", "orange", "rose", "amber", "teal", "purple"] as const;
export type AvatarToneKey = (typeof AVATAR_TONE_KEYS)[number];

/** Deterministic per-name avatar tone — same suki always gets the same color. */
export function avatarTone(name: string): AvatarToneKey {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return AVATAR_TONE_KEYS[Math.abs(hash) % AVATAR_TONE_KEYS.length];
}
