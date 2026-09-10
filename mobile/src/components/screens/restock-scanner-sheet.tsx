import React, { useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { Camera } from "lucide-react-native";
import { useTheme } from "@/theme/theme";
import { radius } from "@/theme/tokens";
import { Button } from "@/components/shared/ui";
import { Sheet } from "@/components/shared/sheet";
import { useToast } from "@/components/shared/toast";
import { onDeviceOcrAvailable, scanReceiptImage } from "@/services/ocr/mlkit";
import type { OcrItem } from "@/services/ocr/types";
import { ReceiptReviewForm } from "@/components/screens/receipt-review-form";

/**
 * Receipt scanner sheet — capture → processing → review.
 * On-device OCR only (ML Kit via dev build); without the native module the
 * flow degrades to manual item entry behind the same review form. Results are
 * NEVER auto-saved — they always land in the review form first.
 */

type Step = "capture" | "processing" | "review";

export function ReceiptScannerSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { palette } = useTheme();
  const toast = useToast();
  const [step, setStep] = useState<Step>("capture");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [ocrItems, setOcrItems] = useState<OcrItem[]>([]);

  // Fresh flow every time the sheet opens — every close path funnels through
  // handleClose (scrim tap, X, back button) and resets state (web parity:
  // no setState inside effects).
  const resetFlow = () => {
    setStep("capture");
    setImageUri(null);
    setOcrItems([]);
  };

  const handleClose = () => {
    onClose();
    resetFlow();
  };

  const pickFromCamera = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (perm.status !== "granted") {
        toast.error("Kailangan ng pahintulot para sa camera");
        return;
      }
      const res = await ImagePicker.launchCameraAsync({ quality: 0.7 });
      if (!res.canceled) {
        const uri = res.assets?.[0]?.uri;
        if (uri) {
          setImageUri(uri);
          setOcrItems([]);
        }
      }
    } catch {
      toast.error("Hindi makuha ang larawan, subukan ulit");
    }
  };

  const pickFromGallery = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== "granted") {
        toast.error("Kailangan ng pahintulot para sa camera/gallery");
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        quality: 0.7,
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
      });
      if (!res.canceled) {
        const uri = res.assets?.[0]?.uri;
        if (uri) {
          setImageUri(uri);
          setOcrItems([]);
        }
      }
    } catch {
      toast.error("Hindi makuha ang larawan, subukan ulit");
    }
  };

  const runOcr = async () => {
    if (!imageUri) return;
    setStep("processing");
    try {
      // Keep the image small before OCR (mirrors the web canvas downscale).
      const resized = await manipulateAsync(
        imageUri,
        [{ resize: { width: 1800 } }],
        { compress: 0.85, format: SaveFormat.JPEG }
      );
      let mapped: OcrItem[] = [];
      if (onDeviceOcrAvailable()) {
        const result = await scanReceiptImage(resized.uri);
        mapped = (result.items ?? []).map((it) => {
          const qty = typeof it.qty === "number" && it.qty > 0 ? it.qty : 1;
          const unitPrice =
            typeof it.unitPrice === "number" && it.unitPrice >= 0 ? it.unitPrice : 0;
          const total =
            typeof it.total === "number" && it.total > 0 ? it.total : qty * unitPrice;
          return { name: it.name ?? "", qty, unitPrice, total };
        });
        if (mapped.length === 0) {
          toast.info("Walang nakitang items sa resibo — i-type na lang manually.");
        }
      } else {
        toast.info("Hindi available ang on-device OCR sa build na ito — i-type na lang ang items.");
      }
      setOcrItems(mapped);
      setStep("review");
    } catch (e) {
      console.warn("[tindahan] receipt OCR failed", e);
      toast.error("Hindi mabasa ang resibo. Subukan ulit o i-type manually.");
      setStep("capture");
    }
  };

  const handleSaved = () => {
    onClose();
    resetFlow();
  };

  return (
    <Sheet
      visible={visible}
      onClose={handleClose}
      title="Scan ang Resibo"
      subtitle={
        step === "review"
          ? "I-review ang nabasa mula sa resibo bago i-save"
          : "Kunhan ng larawan ang resibo ng supplier para mabilis ang restock"
      }
    >
      {step === "capture" ? (
        <View style={{ gap: 14 }}>
          <Pressable
            onPress={pickFromCamera}
            accessibilityRole="button"
            accessibilityLabel={imageUri ? "Palitan ang larawan ng resibo" : "Kuhanan ng larawan ang resibo"}
            style={({ pressed }) => [
              styles.captureBox,
              { borderColor: palette.border, backgroundColor: palette.muted, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            {imageUri ? (
              <View style={styles.captureInner}>
                <Image
                  source={{ uri: imageUri }}
                  style={[styles.preview, { backgroundColor: palette.card, borderRadius: 12 }]}
                  resizeMode="contain"
                  accessibilityLabel="Preview ng resibo"
                  accessibilityIgnoresInvertColors
                />
                <Text style={[styles.tapReplace, { color: palette.primary }]}>
                  Tap para palitan ang larawan
                </Text>
              </View>
            ) : (
              <View style={styles.captureInner}>
                <Camera size={28} color={palette.mutedForeground} strokeWidth={1.8} />
                <Text style={[styles.captureTitle, { color: palette.foreground }]}>
                  Kuhanan ng larawan ang resibo
                </Text>
                <Text style={[styles.captureSub, { color: palette.mutedForeground }]}>
                  Siguradong malinaw at buo ang litrato
                </Text>
              </View>
            )}
          </Pressable>

          <Button title="Pumili mula sa gallery" variant="outline" onPress={pickFromGallery} />

          <Button
            title="I-OCR ang resibo"
            onPress={runOcr}
            disabled={!imageUri}
            style={{ minHeight: 48, borderRadius: radius.lg }}
          />
        </View>
      ) : null}

      {step === "processing" ? (
        <View style={styles.processing}>
          <ActivityIndicator size="large" color={palette.primary} />
          <Text style={[styles.processingTitle, { color: palette.foreground }]}>
            Binabasa ang resibo…
          </Text>
          <Text style={[styles.captureSub, { color: palette.mutedForeground }]}>
            Maaaring tumagal nang ilang segundo
          </Text>
        </View>
      ) : null}

      {step === "review" ? (
        <ReceiptReviewForm
          source="receipt"
          initialItems={ocrItems}
          onCancel={() => setStep("capture")}
          onSaved={handleSaved}
        />
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  captureBox: {
    borderWidth: 2,
    borderStyle: "dashed",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 180,
  },
  captureInner: { alignItems: "center", gap: 8, width: "100%" },
  preview: { width: "100%", height: 200 },
  tapReplace: { fontSize: 12, fontWeight: "600" },
  captureTitle: { fontSize: 15, fontWeight: "700" },
  captureSub: { fontSize: 12, textAlign: "center" },
  processing: { alignItems: "center", gap: 10, paddingVertical: 48 },
  processingTitle: { fontSize: 15, fontWeight: "700" },
});
