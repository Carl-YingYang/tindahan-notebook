
import React, { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/theme/theme";
import { useToast } from "@/components/shared/toast";
import { Button, Card, Divider } from "@/components/shared/ui";
import { FieldInput } from "@/components/shared/inputs";
import { Sheet } from "@/components/shared/sheet";
import { getAiSettings, setAiSettings } from "@/db/repos/settings";
import { seedDemo } from "@/db/seed";

/**
 * Settings ni Suki — GLM API credentials (stored ONLY in on-device
 * SQLite) + development demo-data controls. Web parity: settings
 * drawer + seed controls from the approved prototype.
 */

export function SettingsSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { palette } = useTheme();
  const toast = useToast();

  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [saving, setSaving] = useState(false);

  // Re-hydrate the fields from SQLite every time the sheet opens.
  useEffect(() => {
    if (!visible) return;
    try {
      const s = getAiSettings();
      setApiKey(s.apiKey);
      setBaseUrl(s.baseUrl);
      setModel(s.model);
    } catch {
      // DB not ready yet — leave fields empty
    }
  }, [visible]);

  function handleSave() {
    if (saving) return;
    setSaving(true);
    try {
      setAiSettings({ apiKey, baseUrl, model });
      toast.success("Nai-save ang settings!");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "May problema sa server");
    } finally {
      setSaving(false);
    }
  }

  function confirmLoadDemo() {
    Alert.alert(
      "Load demo data?",
      "Ipapalit ang kasalukuyang laman ng app ng demo data.",
      [
        { text: "Kanselahin", style: "cancel" },
        {
          text: "Load",
          onPress: () => {
            try {
              seedDemo(true);
              toast.success("Na-load ang demo data!");
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "May problema sa server");
            }
          },
        },
      ]
    );
  }

  function confirmResetAll() {
    Alert.alert(
      "I-reset ang lahat?",
      "Buburahin LAHAT ng data sa app. Hindi na ito maibabalik.",
      [
        { text: "Kanselahin", style: "cancel" },
        {
          text: "I-reset",
          style: "destructive",
          onPress: () => {
            try {
              seedDemo(true);
              toast.success("Na-reset ang app!");
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "May problema sa server");
            }
          },
        },
      ]
    );
  }

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Settings ni Suki"
      subtitle="AI key ay nakatago lang sa device na ito"
      footer={
        <Button
          title="Isara"
          variant="outline"
          onPress={onClose}
          accessibilityLabel="Isara ang settings"
        />
      }
    >
      {/* Privacy info */}
      <Card style={{ backgroundColor: palette.muted }}>
        <Text style={[styles.infoText, { color: palette.mutedForeground }]}>
          Ang Suki AI ay gumagamit ng GLM API. Ang API key ay naka-store LANG sa SQLite ng
          phone — hindi ito naka-hardcode at hindi ipinapadala kahit saan maliban sa AI
          provider.
        </Text>
      </Card>

      <FieldInput
        label="GLM API Key"
        value={apiKey}
        onChange={setApiKey}
        placeholder="hal. xxxxxxxxxxxxxxxx"
      />
      <FieldInput
        label="API Base URL"
        value={baseUrl}
        onChange={setBaseUrl}
        placeholder="https://api.z.ai/api/paas/v4"
      />
      <FieldInput
        label="Model"
        value={model}
        onChange={setModel}
        placeholder="glm-4.6"
      />

      <Button
        title="I-save ang Settings"
        variant="primary"
        onPress={handleSave}
        busy={saving}
        accessibilityLabel="I-save ang settings ni Suki"
      />

      <Divider />

      {/* Demo data (development) */}
      <Text style={[styles.demoLabel, { color: palette.mutedForeground }]}>
        Demo data (development):
      </Text>
      <View style={styles.demoRow}>
        <Button
          title="Load demo data"
          variant="outline"
          size="sm"
          onPress={confirmLoadDemo}
          accessibilityLabel="Load demo data"
          style={styles.demoButton}
        />
        <Button
          title="I-reset ang lahat"
          variant="outline"
          size="sm"
          onPress={confirmResetAll}
          accessibilityLabel="I-reset ang lahat ng data"
          style={[styles.demoButton, { borderColor: palette.tones.rose.solid }]}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  infoText: {
    fontSize: 11.5,
    lineHeight: 17,
  },
  demoLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  demoRow: {
    flexDirection: "row",
    gap: 8,
  },
  demoButton: {
    flex: 1,
  },
});
