/**
 * On-device OCR service (ML Kit Text Recognition v2 via native module).
 *
 * - Works fully offline; requires a development build (not Expo Go) when
 *   @react-native-ml-kit/text-recognition is linked. Availability is
 *   checked at runtime so the app NEVER breaks without it — the receipt
 *   flow degrades to manual item entry (still behind the review screen).
 * - There is intentionally NO cloud OCR fallback: the product decision is
 *   offline-first OCR or explicit manual entry.
 */

import { normalizeOcrResult } from "./parser";
import type { OcrResult } from "./types";

let mod: any = null;
try {
  // Lazy require: the native module only exists in development builds.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  mod = require("@react-native-ml-kit/text-recognition");
} catch {
  mod = null;
}

export function onDeviceOcrAvailable(): boolean {
  return !!mod;
}

export async function scanReceiptImage(uri: string): Promise<OcrResult> {
  if (!mod) {
    throw new Error("ON_DEVICE_OCR_UNAVAILABLE");
  }
  const recognize = mod.default?.recognize ?? mod.recognize ?? mod;
  if (typeof recognize !== "function") {
    throw new Error("ON_DEVICE_OCR_UNAVAILABLE");
  }
  const result = await recognize(uri);
  const text: string =
    typeof result === "string" ? result : (result?.text ?? "");
  return normalizeOcrResult(text, "mlkit-on-device");
}
