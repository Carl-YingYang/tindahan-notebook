"use client";

// ── Receipt scanner sheet — capture → processing → review ─────────
// OCR is done by POST /api/ocr/receipt (backend VLM). Results are NEVER
// auto-saved: they always land in the review form first.

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Camera, Loader2, ScanLine } from "lucide-react";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { apiPost } from "@/lib/api";
import { useRefreshAll } from "@/hooks/use-store";
import type { OcrResult, RestockItemDTO } from "@/types";
import { ReceiptReviewForm } from "./receipt-review-form";

type Step = "capture" | "processing" | "review";

/** Base64 over ~4.5MB (≈6M chars) gets downscaled so the OCR route's 8MB cap is never hit. */
const SHRINK_THRESHOLD_CHARS = 6_000_000;
const MAX_DIMENSION = 1800;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Hindi mabasa ang larawan"));
    reader.readAsDataURL(file);
  });
}

/** Best-effort canvas downscale for huge camera photos; falls back to the original. */
async function shrinkIfNeeded(dataUrl: string): Promise<string> {
  if (dataUrl.length <= SHRINK_THRESHOLD_CHARS) return dataUrl;
  try {
    const img = document.createElement("img");
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("decode failed"));
      img.src = dataUrl;
    });
    const scale = Math.min(1, MAX_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight));
    if (scale >= 1) return dataUrl;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return dataUrl;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85);
  } catch {
    return dataUrl;
  }
}

function dataUrlToBase64(dataUrl: string): string {
  const idx = dataUrl.indexOf(",");
  return idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl;
}

export function ReceiptScannerSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const refreshAll = useRefreshAll();
  const [step, setStep] = useState<Step>("capture");
  const [preview, setPreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [ocrItems, setOcrItems] = useState<RestockItemDTO[]>([]);

  // Fresh flow every time the sheet opens (reset handled in the open-change
  // handler below — no setState inside effects).
  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setStep("capture");
      setPreview(null);
      setImageBase64(null);
      setOcrItems([]);
    }
    onOpenChange(v);
  };

  const onFilePicked = async (file: File | undefined | null) => {
    if (!file) return;
    try {
      let dataUrl = await readFileAsDataUrl(file);
      dataUrl = await shrinkIfNeeded(dataUrl);
      setPreview(dataUrl);
      setImageBase64(dataUrlToBase64(dataUrl));
    } catch {
      toast.error("Hindi mabasa ang larawan, subukan ulit");
    }
  };

  const runOcr = async () => {
    if (!imageBase64) return;
    setStep("processing");
    try {
      const res = await apiPost<OcrResult>("/api/ocr/receipt", { imageBase64 });
      const items: RestockItemDTO[] = (res?.items ?? []).map((it, idx) => {
        const qty = typeof it.qty === "number" && it.qty > 0 ? it.qty : 1;
        const unitPrice = typeof it.unitPrice === "number" && it.unitPrice >= 0 ? it.unitPrice : 0;
        return {
          id: `ocr-${idx}`,
          productId: null,
          name: it.name ?? "",
          qty,
          unitPrice,
          total: typeof it.total === "number" && it.total > 0 ? it.total : qty * unitPrice,
        };
      });
      setOcrItems(items);
      if (items.length === 0) {
        toast.message("Walang nakitang items sa resibo — i-type na lang manually.");
      }
      setStep("review");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Hindi ma-OCR ang resibo, subukan ulit");
      setStep("capture");
    }
  };

  const handleSaved = () => {
    refreshAll();
    onOpenChange(false);
  };

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent className="mx-auto max-w-md">
        <DrawerHeader className="shrink-0 pb-2 text-left">
          <DrawerTitle className="flex items-center gap-2 text-lg">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ScanLine className="size-4" />
            </span>
            Scan ang Resibo
          </DrawerTitle>
          <DrawerDescription className="text-xs">
            {step === "review"
              ? "I-review ang nabasa mula sa resibo bago i-save"
              : "Kunhan ng larawan ang resibo ng supplier para mabilis ang restock"}
          </DrawerDescription>
        </DrawerHeader>

        {step === "capture" && (
          <div className="space-y-4 overflow-y-auto nice-scroll px-4 pb-6">
            <label className="block cursor-pointer rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 p-8 text-center transition-colors touch-manipulation active:scale-[0.99] hover:border-primary/60">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                aria-label="Kuhanan ng larawan ang resibo"
                className="hidden"
                onChange={(e) => {
                  onFilePicked(e.target.files?.[0] ?? null);
                  e.target.value = "";
                }}
              />
              {preview ? (
                <span className="flex flex-col items-center gap-2">
                  { }
                  <img
                    src={preview}
                    alt="Preview ng resibo"
                    className="max-h-44 w-full rounded-xl border border-border object-contain"
                  />
                  <span className="text-xs font-semibold text-primary">Tap para palitan ang larawan</span>
                </span>
              ) : (
                <span className="flex flex-col items-center gap-2">
                  <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Camera className="size-7" strokeWidth={1.8} />
                  </span>
                  <span className="font-bold">Kuhanan ng larawan ang resibo</span>
                  <span className="text-xs text-muted-foreground">Siguradong malinaw at buo ang litrato</span>
                </span>
              )}
            </label>

            <Button
              onClick={runOcr}
              disabled={!imageBase64}
              className="h-12 w-full rounded-2xl text-base font-bold touch-manipulation active:scale-[0.99]"
            >
              I-OCR ang resibo
            </Button>
          </div>
        )}

        {step === "processing" && (
          <div className="flex flex-col items-center gap-3 px-4 py-14 text-center">
            <Loader2 className="size-8 animate-spin text-primary" aria-hidden="true" />
            <p className="font-bold">Binabasa ang resibo…</p>
            <p className="text-xs text-muted-foreground">Maaaring tumagal nang ilang segundo</p>
          </div>
        )}

        {step === "review" && (
          <ReceiptReviewForm initialItems={ocrItems} onSaved={handleSaved} source="receipt" />
        )}
      </DrawerContent>
    </Drawer>
  );
}
