/**
 * Design tokens for Tindahan Ko mobile.
 * Mirrors the approved web prototype palette (warm amber brand,
 * emerald=positive / rose=negative / orange=utang / amber=warning).
 */

export interface TonePalette {
  /** tinted chip background (light: X-100, dark: X-500/15 equivalent) */
  soft: string;
  border: string;
  text: string;
  /** full-strength fill for dots/segments */
  solid: string;
  onSolid: string;
}

export interface Palette {
  background: string;
  card: string;
  border: string;
  muted: string;
  mutedForeground: string;
  foreground: string;
  primary: string;
  primarySoft: string;
  primaryForeground: string;
  scrim: string;
  tones: {
    emerald: TonePalette;
    rose: TonePalette;
    orange: TonePalette;
    amber: TonePalette;
    teal: TonePalette;
    purple: TonePalette;
  };
}

export const lightPalette: Palette = {
  background: "#faf9f7",
  card: "#ffffff",
  border: "#e7e5e4",
  muted: "#f5f5f4",
  mutedForeground: "#78716c",
  foreground: "#1c1917",
  primary: "#d97706",
  primarySoft: "rgba(217, 119, 6, 0.10)",
  primaryForeground: "#ffffff",
  scrim: "rgba(28, 25, 23, 0.45)",
  tones: {
    emerald: { soft: "#d1fae5", border: "#a7f3d0", text: "#047857", solid: "#10b981", onSolid: "#ffffff" },
    rose: { soft: "#ffe4e6", border: "#fecdd3", text: "#be123c", solid: "#f43f5e", onSolid: "#ffffff" },
    orange: { soft: "#ffedd5", border: "#fed7aa", text: "#c2410c", solid: "#f97316", onSolid: "#ffffff" },
    amber: { soft: "#fef3c7", border: "#fde68a", text: "#b45309", solid: "#f59e0b", onSolid: "#ffffff" },
    teal: { soft: "#ccfbf1", border: "#99f6e4", text: "#0f766e", solid: "#14b8a6", onSolid: "#ffffff" },
    purple: { soft: "#f3e8ff", border: "#e9d5ff", text: "#7e22ce", solid: "#a855f7", onSolid: "#ffffff" },
  },
};

export const darkPalette: Palette = {
  background: "#0c0a09",
  card: "#1c1917",
  border: "#44403c",
  muted: "#292524",
  mutedForeground: "#a8a29e",
  foreground: "#fafaf9",
  primary: "#f59e0b",
  primarySoft: "rgba(245, 158, 11, 0.14)",
  primaryForeground: "#1c1917",
  scrim: "rgba(0, 0, 0, 0.6)",
  tones: {
    emerald: { soft: "rgba(16, 185, 129, 0.15)", border: "rgba(16, 185, 129, 0.35)", text: "#34d399", solid: "#10b981", onSolid: "#052e21" },
    rose: { soft: "rgba(244, 63, 94, 0.15)", border: "rgba(244, 63, 94, 0.35)", text: "#fb7185", solid: "#f43f5e", onSolid: "#4c0519" },
    orange: { soft: "rgba(249, 115, 22, 0.15)", border: "rgba(249, 115, 22, 0.35)", text: "#fb923c", solid: "#f97316", onSolid: "#431407" },
    amber: { soft: "rgba(245, 158, 11, 0.15)", border: "rgba(245, 158, 11, 0.35)", text: "#fbbf24", solid: "#f59e0b", onSolid: "#451a03" },
    teal: { soft: "rgba(20, 184, 166, 0.15)", border: "rgba(20, 184, 166, 0.35)", text: "#2dd4bf", solid: "#14b8a6", onSolid: "#042f2e" },
    purple: { soft: "rgba(168, 85, 247, 0.15)", border: "rgba(168, 85, 247, 0.35)", text: "#c084fc", solid: "#a855f7", onSolid: "#2e1065" },
  },
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
};

export const spacing = (n: number) => n * 4;
