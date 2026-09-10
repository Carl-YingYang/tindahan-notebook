import * as SQLite from "expo-sqlite";
import { MIGRATIONS } from "./migrations";

export const db = SQLite.openDatabaseSync("tindahan.db");

let initialized = false;

/** Idempotent — safe to call multiple times. Runs at module load so every
 * repo/settings reader can rely on a migrated database. */
export function initDb(): void {
  if (initialized) return;
  db.execSync(`PRAGMA journal_mode = WAL`);
  db.execSync(`PRAGMA foreign_keys = ON`);

  const row = db.getFirstSync<{ user_version: number }>(`PRAGMA user_version`);
  let current = row?.user_version ?? 0;

  for (const migration of MIGRATIONS) {
    if (migration.version <= current) continue;
    db.withTransactionSync(() => {
      for (const sql of migration.statements) {
        db.execSync(sql);
      }
      db.execSync(`PRAGMA user_version = ${migration.version}`);
    });
    current = migration.version;
  }
  initialized = true;
}

// Initialize eagerly on module load — before any component renders.
try {
  initDb();
} catch (e) {
  console.warn("[tindahan] db init failed", e);
}

/** Row → camelCase helpers */
export function isoOrNull(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

export function numOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function strOrNull(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}
