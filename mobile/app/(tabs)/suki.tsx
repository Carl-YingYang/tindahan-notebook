import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useNetInfo } from "@react-native-community/netinfo";
import { Send, Settings, Sparkles, Trash2, WifiOff } from "lucide-react-native";

import { useTheme } from "@/theme/theme";
import { useToast } from "@/components/shared/toast";
import { Card, ScreenHeader } from "@/components/shared/ui";
import { SelectChip } from "@/components/shared/inputs";
import { SuggestionCard } from "@/components/screens/suki/suggestion-card";
import { SettingsSheet } from "@/components/screens/suki/settings-sheet";
import { useDbQuery, refreshAll } from "@/store/data";
import { listAiMessages, addAiMessage, clearAiMessages } from "@/db/repos/ai";
import { buildAiContext, SUKI_SYSTEM_PROMPT } from "@/services/ai/context";
import { glmChat, AiUnavailableError } from "@/services/ai/glm";
import type { RestockSuggestion } from "@/logic/restock-suggester";

// ── Suki AI chat screen (port of web ai-screen.tsx / Task 2-e) ────
// DB-backed history + optimistic send flow, offline banner, budget
// suggestion card, starter chips, clear chat, in-app AI settings.

const GENERIC_ERROR = "Pasensya, may problema akong nakuha. Subukan ulit.";

const STARTERS = [
  "Ano ang dapat kong i-restock?",
  "Ano ang malapit nang maubos?",
  "Magkano ang net ko ngayong week?",
  "May ₱2,000 akong budget, ano ang magandang bilhin?",
  "Gawan mo ako ng shopping list.",
  "Ano ang pinaka malaki kong gastos this week?",
];

export default function SukiScreen() {
  const { palette } = useTheme();
  const toast = useToast();
  const net = useNetInfo();
  const offline = net.isConnected === false || net.isInternetReachable === false;

  const messages = useDbQuery(() => listAiMessages(), []);

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [pendingUser, setPendingUser] = useState<string | null>(null);
  // Attached under the assistant reply that carried it (keyed by reply
  // content, same trick as the web prototype); cleared on chat clear.
  const [suggestion, setSuggestion] = useState<RestockSuggestion | null>(null);
  const [suggestionKey, setSuggestionKey] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const scrollRef = useRef<ScrollView | null>(null);

  // Follow the conversation whenever history / tail / typing changes.
  const count = messages?.length ?? 0;
  useEffect(() => {
    const id = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 50);
    return () => clearTimeout(id);
  }, [count, pendingUser, sending]);

  // ── Send flow (mirrors the web prototype exactly) ──────────────
  async function handleSend(raw: string) {
    const text = raw.trim().slice(0, 500);
    if (!text || sending || offline) return;

    setInput("");
    setSending(true);
    setPendingUser(text);

    let context: Record<string, unknown>;
    let budgetSuggestion: RestockSuggestion | null;
    try {
      const built = buildAiContext(text);
      context = built.context;
      budgetSuggestion = built.budgetSuggestion;
      addAiMessage("user", text);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "May problema sa server");
      setSending(false);
      setPendingUser(null);
      return;
    }

    try {
      const reply = await glmChat(
        SUKI_SYSTEM_PROMPT,
        `${text}\n\n---\nStore data (context JSON — GAMITIN LANG ANG NUMERONG ITO, huwag mag-imbento):\n${JSON.stringify(
          context
        )}`
      );
      addAiMessage("assistant", reply);
      if (budgetSuggestion) {
        setSuggestion(budgetSuggestion);
        setSuggestionKey(reply);
      }
    } catch (e) {
      if (e instanceof AiUnavailableError) {
        addAiMessage("assistant", e.message);
      } else {
        addAiMessage("assistant", GENERIC_ERROR);
      }
    } finally {
      setSending(false);
      setPendingUser(null);
      refreshAll();
    }
  }

  // ── Clear chat ─────────────────────────────────────────────────
  function confirmClearChat() {
    Alert.alert(
      "Burahin ang usapan?",
      "Mababura lahat ng mensahe ninyo ni Suki. Hindi na ito maibabalik.",
      [
        { text: "Kanselahin", style: "cancel" },
        {
          text: "Burahin",
          style: "destructive",
          onPress: () => {
            try {
              clearAiMessages();
              setSuggestion(null);
              setSuggestionKey(null);
              toast.success("Nabura ang usapan");
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "May problema sa server");
            }
          },
        },
      ]
    );
  }

  // Optimistic user bubble — hidden once the saved list already ends
  // with the same message (the DB write lands before the await).
  const lastMsg = messages && messages.length > 0 ? messages[messages.length - 1] : null;
  const showPendingUser =
    pendingUser !== null &&
    !(lastMsg && lastMsg.role === "user" && lastMsg.content === pendingUser);

  const showIntro =
    (messages === null || messages.length === 0) && !showPendingUser && !sending;

  const canSend = input.trim().length > 0 && !sending && !offline;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.screen}>
        <ScreenHeader
          title="Suki AI"
          subtitle="Ang store assistant mo"
          right={
            <React.Fragment>
              <IconButton
                label="Settings ni Suki"
                onPress={() => setSettingsOpen(true)}
              >
                <Settings size={16} color={palette.mutedForeground} />
              </IconButton>
              <IconButton label="Burahin ang usapan" onPress={confirmClearChat}>
                <Trash2 size={16} color={palette.tones.rose.text} />
              </IconButton>
            </React.Fragment>
          }
        />

        {/* Offline banner */}
        {offline ? (
          <View style={styles.offlineWrap}>
            <Card
              style={[
                styles.offlineBanner,
                {
                  backgroundColor: palette.tones.amber.soft,
                  borderColor: palette.tones.amber.border,
                },
              ]}
            >
              <WifiOff size={16} color={palette.tones.amber.text} />
              <View style={styles.offlineTextCol}>
                <Text style={[styles.offlineTitle, { color: palette.tones.amber.text }]}>
                  Offline ka ngayon.
                </Text>
                <Text
                  style={[styles.offlineBody, { color: palette.tones.amber.text, opacity: 0.75 }]}
                >
                  Available pa rin ang ibang features ng app.
                </Text>
              </View>
            </Card>
          </View>
        ) : null}

        {/* Chat area */}
        <ScrollView
          ref={scrollRef}
          style={styles.chat}
          contentContainerStyle={[
            styles.chatContent,
            { justifyContent: showIntro ? "center" : "flex-start" },
          ]}
          keyboardShouldPersistTaps="handled"
          accessibilityLiveRegion="polite"
        >
          {showIntro ? (
            <StarterIntro disabled={offline || sending} onAsk={(q) => void handleSend(q)} />
          ) : null}

          {messages !== null && messages.length > 0
            ? messages.map((m) => (
                <React.Fragment key={m.id}>
                  {m.role === "user" ? (
                    <UserBubble content={m.content} />
                  ) : (
                    <AssistantBubble content={m.content} />
                  )}
                  {m.role === "assistant" && suggestion && suggestionKey === m.content ? (
                    <SuggestionCard suggestion={suggestion} />
                  ) : null}
                </React.Fragment>
              ))
            : null}

          {/* Local tail: optimistic user message + typing indicator */}
          {showPendingUser && pendingUser !== null ? (
            <UserBubble content={pendingUser} />
          ) : null}
          {sending ? <TypingIndicator /> : null}
        </ScrollView>

        {/* Input bar */}
        <View
          style={[
            styles.inputBar,
            { borderTopColor: palette.border, backgroundColor: palette.background },
          ]}
        >
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Tanong kay Suki…"
            placeholderTextColor={palette.mutedForeground}
            maxLength={500}
            editable={!offline}
            returnKeyType="send"
            accessibilityLabel="Tanong kay Suki"
            onSubmitEditing={() => {
              if (canSend) void handleSend(input);
            }}
            style={[
              styles.input,
              {
                backgroundColor: palette.muted,
                color: palette.foreground,
                opacity: offline ? 0.6 : 1,
              },
            ]}
          />
          <Pressable
            onPress={() => {
              if (canSend) void handleSend(input);
            }}
            disabled={!canSend}
            accessibilityRole="button"
            accessibilityLabel="Ipadala"
            accessibilityState={{ disabled: !canSend, busy: sending }}
            style={({ pressed }) => [
              styles.sendButton,
              {
                backgroundColor: palette.primary,
                opacity: !canSend ? 0.45 : pressed ? 0.82 : 1,
              },
            ]}
          >
            <Send size={18} color={palette.primaryForeground} />
          </Pressable>
        </View>
      </View>

      <SettingsSheet visible={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </KeyboardAvoidingView>
  );
}

/* ---------- pieces ---------- */

function IconButton({
  onPress,
  label,
  children,
}: {
  onPress: () => void;
  label: string;
  children: React.ReactNode;
}) {
  const { palette } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      style={({ pressed }) => [
        styles.iconButton,
        { borderColor: palette.border, opacity: pressed ? 0.6 : 1 },
      ]}
    >
      {children}
    </Pressable>
  );
}

function UserBubble({ content }: { content: string }) {
  const { palette } = useTheme();
  return (
    <View style={[styles.bubbleUser, { backgroundColor: palette.primary }]}>
      <Text style={[styles.userText, { color: palette.primaryForeground }]}>{content}</Text>
    </View>
  );
}

function AssistantBubble({ content }: { content: string }) {
  const { palette } = useTheme();
  return (
    <View style={styles.assistantWrap}>
      <Text style={[styles.eyebrow, { color: palette.mutedForeground }]}>SUKI</Text>
      <View
        style={[
          styles.bubbleAssistant,
          { backgroundColor: palette.card, borderColor: palette.border },
        ]}
      >
        <View style={styles.contentCol}>{renderAssistantContent(content, palette.foreground)}</View>
      </View>
    </View>
  );
}

/** Tiny markdown: "- "/"* " bullets + **bold** stripped, newlines kept. */
function renderAssistantContent(content: string, fg: string): React.ReactNode[] {
  const stripped = content.replace(/\*\*(.+?)\*\*/g, "$1");
  const lines = stripped.split("\n");

  const blocks: React.ReactNode[] = [];
  let bullets: string[] = [];

  const flushBullets = (key: string) => {
    if (bullets.length === 0) return;
    const rows = bullets.slice();
    bullets = [];
    blocks.push(
      <View key={key} style={styles.bulletGroup}>
        {rows.map((b, i) => (
          <View key={`${key}-${i}`} style={styles.bulletRow}>
            <Text style={[styles.msgText, { color: fg }]}>•</Text>
            <Text style={[styles.msgText, styles.bulletText, { color: fg }]}>{b}</Text>
          </View>
        ))}
      </View>
    );
  };

  lines.forEach((line, i) => {
    const t = line.trim();
    if (t.startsWith("- ") || t.startsWith("* ")) {
      bullets.push(t.slice(2).trim());
      return;
    }
    flushBullets(`bullets-${i}`);
    blocks.push(
      <Text key={`line-${i}`} style={[styles.msgText, { color: fg }]}>
        {line.length === 0 ? " " : line}
      </Text>
    );
  });
  flushBullets("bullets-end");
  return blocks;
}

function TypingIndicator() {
  const { palette } = useTheme();
  const dots = useMemo(() => [0, 1, 2].map(() => new Animated.Value(0.35)), []);

  useEffect(() => {
    const loops = dots.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(v, { toValue: 1, duration: 320, useNativeDriver: true }),
          Animated.timing(v, { toValue: 0.35, duration: 320, useNativeDriver: true }),
          Animated.delay((2 - i) * 150),
        ])
      )
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [dots]);

  return (
    <View style={styles.assistantWrap}>
      <Text style={[styles.eyebrow, { color: palette.mutedForeground }]}>SUKI</Text>
      <View
        style={[
          styles.bubbleAssistant,
          { backgroundColor: palette.card, borderColor: palette.border },
        ]}
        accessibilityRole="text"
        accessibilityLabel="Nag-iisip si Suki"
      >
        <View style={styles.dotsRow}>
          {dots.map((v, i) => (
            <Animated.View
              key={i}
              style={[
                styles.dot,
                { backgroundColor: palette.mutedForeground, opacity: v },
              ]}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

function StarterIntro({
  disabled,
  onAsk,
}: {
  disabled: boolean;
  onAsk: (question: string) => void;
}) {
  const { palette } = useTheme();
  return (
    <View style={styles.intro}>
      <View
        style={[styles.introAvatar, { backgroundColor: palette.primarySoft }]}
        accessibilityLabel="Suki AI"
      >
        <Sparkles size={28} color={palette.primary} />
      </View>
      <View style={styles.introCopy}>
        <Text style={[styles.introTitle, { color: palette.foreground }]}>Ako si Suki!</Text>
        <Text style={[styles.introSubtitle, { color: palette.mutedForeground }]}>
          Tanungin mo ako tungkol sa tindahan mo — benta, gastos, utang, o restock.
        </Text>
      </View>
      <View style={[styles.introChips, disabled ? { opacity: 0.5 } : null]}>
        {STARTERS.map((question) => (
          <SelectChip
            key={question}
            label={question}
            active={false}
            onPress={() => onAsk(question)}
          />
        ))}
      </View>
    </View>
  );
}

/* ---------- styles ---------- */

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: {
    flex: 1,
    paddingTop: 16,
    paddingBottom: 110, // clearance above the tab bar
  },
  offlineWrap: { paddingHorizontal: 16, paddingTop: 12 },
  offlineBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    borderRadius: 16,
  },
  offlineTextCol: { flex: 1, gap: 1 },
  offlineTitle: { fontSize: 13, fontWeight: "700", lineHeight: 18 },
  offlineBody: { fontSize: 13, lineHeight: 18 },
  chat: { flex: 1 },
  chatContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 12,
  },
  assistantWrap: {
    alignSelf: "flex-start",
    maxWidth: "82%",
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 4,
  },
  bubbleUser: {
    alignSelf: "flex-end",
    maxWidth: "82%",
    borderRadius: 18,
    borderBottomRightRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  userText: { fontSize: 15, lineHeight: 22 },
  bubbleAssistant: {
    borderRadius: 18,
    borderBottomLeftRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  contentCol: { gap: 6 },
  msgText: { fontSize: 13.5, lineHeight: 20 },
  bulletGroup: { gap: 4 },
  bulletRow: { flexDirection: "row", gap: 8 },
  bulletText: { flex: 1 },
  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  intro: {
    alignItems: "center",
    gap: 14,
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  introAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  introCopy: { alignItems: "center", gap: 4 },
  introTitle: { fontSize: 16, fontWeight: "800", letterSpacing: -0.2 },
  introSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
    maxWidth: 280,
  },
  introChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    maxWidth: 340,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    borderRadius: 999,
    paddingHorizontal: 16,
    minHeight: 44,
    fontSize: 15,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  iconButton: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    alignItems: "center",
    justifyContent: "center",
  },
});
