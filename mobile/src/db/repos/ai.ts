import { db } from "@/db/client";
import { newId } from "@/logic/id";
import type { AiMessage } from "@/types";
import { refreshAll } from "@/store/data";

function serialize(row: any): AiMessage {
  return {
    id: String(row.id),
    role: row.role === "assistant" ? "assistant" : "user",
    content: String(row.content),
    createdAt: String(row.created_at),
  };
}

/** Last 50 messages, oldest → newest (matches GET /api/ai/chat). */
export function listAiMessages(): AiMessage[] {
  return db
    .getAllSync<any>(`SELECT * FROM ai_conversations ORDER BY created_at DESC, rowid DESC LIMIT 50`)
    .reverse()
    .map(serialize);
}

export function addAiMessage(role: "user" | "assistant", content: string): AiMessage {
  const id = newId();
  const now = new Date().toISOString();
  const clean = content.slice(0, 4000);
  db.runSync(
    `INSERT INTO ai_conversations (id, role, content, created_at) VALUES (?, ?, ?, ?)`,
    [id, role, clean, now]
  );
  refreshAll();
  return { id, role, content: clean, createdAt: now };
}

export function deleteAiMessage(id: string): void {
  db.runSync(`DELETE FROM ai_conversations WHERE id = ?`, [id]);
  refreshAll();
}

export function clearAiMessages(): void {
  db.runSync(`DELETE FROM ai_conversations`);
  refreshAll();
}
