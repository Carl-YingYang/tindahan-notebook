import Constants from "expo-constants";
import { db } from "@/db/client";
import { AppError, parseNonNegativeAmount } from "./helpers";
import { refreshAll } from "@/store/data";
import type { AiSettings } from "@/types";

export const KEYS = {
  seeded: "seeded",
  weeklyTarget: "weekly_benta_target",
  aiApiKey: "ai_glm_api_key",
  aiBaseUrl: "ai_glm_base_url",
  aiModel: "ai_glm_model",
  themeOverride: "theme_override",
} as const;

export function getSetting(key: string): string | null {
  const row = db.getFirstSync<{ value: string }>(`SELECT value FROM app_settings WHERE key = ?`, [key]);
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  db.runSync(
    `INSERT INTO app_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value]
  );
  refreshAll();
}

export function deleteSetting(key: string): void {
  db.runSync(`DELETE FROM app_settings WHERE key = ?`, [key]);
  refreshAll();
}

/* ---------- weekly benta target ---------- */

export function getWeeklyTarget(): number | null {
  const raw = getSetting(KEYS.weeklyTarget);
  if (raw === null) return null;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : null;
}

export function setWeeklyTarget(v: number | null): number | null {
  if (v === null || v === undefined) {
    deleteSetting(KEYS.weeklyTarget);
    return null;
  }
  const n = parseNonNegativeAmount(v);
  if (n === null) throw new AppError("Ilagay ang tamang halaga");
  const rounded = Math.round(n * 100) / 100;
  setSetting(KEYS.weeklyTarget, String(rounded));
  return rounded;
}

/* ---------- Suki AI settings (key lives ONLY on-device) ---------- */

const DEFAULT_BASE_URL = "https://api.z.ai/api/paas/v4";
const DEFAULT_MODEL = "glm-4.6";

function devExtra(key: "glmApiKey" | "glmBaseUrl" | "glmModel"): string {
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;
  return extra[key] ?? "";
}

export function getAiSettings(): AiSettings {
  return {
    apiKey: getSetting(KEYS.aiApiKey) ?? devExtra("glmApiKey"),
    baseUrl: getSetting(KEYS.aiBaseUrl) || devExtra("glmBaseUrl") || DEFAULT_BASE_URL,
    model: getSetting(KEYS.aiModel) || devExtra("glmModel") || DEFAULT_MODEL,
  };
}

export function setAiSettings(patch: Partial<AiSettings>): AiSettings {
  if (patch.apiKey !== undefined) {
    if (patch.apiKey.trim()) setSetting(KEYS.aiApiKey, patch.apiKey.trim());
    else deleteSetting(KEYS.aiApiKey);
  }
  if (patch.baseUrl !== undefined) {
    if (patch.baseUrl.trim()) setSetting(KEYS.aiBaseUrl, patch.baseUrl.trim().replace(/\/$/, ""));
    else deleteSetting(KEYS.aiBaseUrl);
  }
  if (patch.model !== undefined) {
    if (patch.model.trim()) setSetting(KEYS.aiModel, patch.model.trim());
    else deleteSetting(KEYS.aiModel);
  }
  return getAiSettings();
}

/* ---------- theme ---------- */

export function getThemeOverride(): "light" | "dark" | null {
  const v = getSetting(KEYS.themeOverride);
  return v === "light" || v === "dark" ? v : null;
}

export function setThemeOverride(v: "light" | "dark" | null): void {
  if (v === null) deleteSetting(KEYS.themeOverride);
  else setSetting(KEYS.themeOverride, v);
}
