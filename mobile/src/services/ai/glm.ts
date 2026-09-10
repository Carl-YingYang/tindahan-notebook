/**
 * Isolated GLM chat client for Suki AI.
 *
 * SECURITY MODEL:
 *  - The API key is entered by the user in the in-app Settings screen and
 *    stored ONLY in the on-device SQLite database (app_settings table).
 *  - No key is hardcoded anywhere in this repository.
 *  - When offline / no key / any failure → the caller shows the graceful
 *    Taglish offline message; the rest of the app never depends on this.
 */

import { getAiSettings } from "@/db/repos/settings";

export class AiUnavailableError extends Error {}

export const OFFLINE_MESSAGE =
  "Offline si Suki ngayon. Available pa rin ang ibang features ng app.";
export const NO_KEY_MESSAGE =
  "Wala pang API key si Suki. I-set ito sa Settings (tap ang gear sa Suki AI screen).";

export async function glmChat(
  systemPrompt: string,
  userContent: string
): Promise<string> {
  const { apiKey, baseUrl, model } = getAiSettings();
  if (!apiKey) throw new AiUnavailableError(NO_KEY_MESSAGE);

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        thinking: { type: "disabled" },
      }),
    });
  } catch {
    throw new AiUnavailableError(OFFLINE_MESSAGE);
  }

  if (!res.ok) {
    if (res.status === 401) throw new AiUnavailableError("Hindi valid ang API key ni Suki. I-check ang Settings.");
    throw new AiUnavailableError(OFFLINE_MESSAGE);
  }

  const data: any = await res.json().catch(() => null);
  const content: string | undefined = data?.choices?.[0]?.message?.content;
  if (!content) throw new AiUnavailableError(OFFLINE_MESSAGE);
  return content.slice(0, 4000);
}
