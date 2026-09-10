"use client";

// ── Suki AI chat screen (Task 2-e) ───────────────────────────────
// Self-contained: loads history via useAiMessages, optimistic send
// flow, offline banner, suggestion card, starter chips, clear chat.

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { SendHorizontal, Trash2, WifiOff } from "lucide-react";
import { toast } from "sonner";

import { ScreenHeader } from "@/components/shared/screen-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import { apiDelete, apiPost } from "@/lib/api";
import { qk, useAiMessages, useRefreshAll } from "@/hooks/use-store";
import type { AiMessage, RestockSuggestion } from "@/types";

import { ChatBubble } from "@/features/ai/chat-bubble";
import { TypingIndicator } from "@/features/ai/typing-indicator";
import { SuggestionCard } from "@/features/ai/suggestion-card";
import { StarterIntro } from "@/features/ai/starter-intro";

const GENERIC_ERROR = "Pasensya, may problema akong nakuha. Subukan ulit.";

/** Local tail shown while a send is in flight / waiting for the refetch. */
type PendingTail = {
  user: string;
  reply?: string;
  error?: string;
  suggestion?: RestockSuggestion;
};

export default function AiScreen() {
  const ai = useAiMessages();
  const refreshAll = useRefreshAll();
  const qc = useQueryClient();

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [pending, setPending] = useState<PendingTail | null>(null);
  // Suggestion cards live here keyed by the assistant reply content —
  // GET /api/ai/chat returns only messages, so this re-attaches the card
  // after every refetch (chat clear resets it).
  const [suggestionCards, setSuggestionCards] = useState<{ key: string; suggestion: RestockSuggestion }[]>([]);
  const [addedKeys, setAddedKeys] = useState<Set<string>>(new Set());
  const [clearing, setClearing] = useState(false);
  const [online, setOnline] = useState(true);
  const offline = !online;

  const endRef = useRef<HTMLDivElement | null>(null);
  const prevHistoryCount = useRef(0);

  // ── Online / offline tracking ──────────────────────────────────
  useEffect(() => {
    setOnline(navigator.onLine);
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  const scrollToEnd = useCallback((smooth = true) => {
    requestAnimationFrame(() => {
      endRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "end" });
    });
  }, []);

  // Open the chat at the newest message; follow along when history grows.
  useEffect(() => {
    const count = ai.data?.length ?? 0;
    if (count > prevHistoryCount.current) {
      scrollToEnd(prevHistoryCount.current > 0);
    }
    prevHistoryCount.current = count;
  }, [ai.data?.length, scrollToEnd]);

  // Follow the conversation whenever the local tail changes (send, reply, error).
  useEffect(() => {
    if (pending) scrollToEnd();
  }, [pending, scrollToEnd]);

  const markAdded = useCallback((key: string) => {
    setAddedKeys((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  }, []);

  // ── Send flow ──────────────────────────────────────────────────
  async function handleSend(raw: string) {
    const content = raw.trim().slice(0, 500);
    if (!content || sending || offline) return;

    setInput("");
    setSending(true);
    setPending({ user: content });
    scrollToEnd();

    try {
      const res = await apiPost<{ reply: string; suggestion?: RestockSuggestion }>("/api/ai/chat", {
        message: content,
      });

      // Seed the query cache so the new pair paints instantly; the refetch
      // triggered by refreshAll() then replaces temp ids with server truth.
      const prev = qc.getQueryData<AiMessage[]>(qk.aiMessages) ?? [];
      const now = Date.now();
      qc.setQueryData<AiMessage[]>(qk.aiMessages, [
        ...prev,
        { id: `pending-u-${now}`, role: "user", content, createdAt: new Date().toISOString() },
        { id: `pending-a-${now}`, role: "assistant", content: res.reply, createdAt: new Date().toISOString() },
      ]);
      const suggestion = res.suggestion;
      if (suggestion && (suggestion.items?.length ?? 0) > 0) {
        setSuggestionCards((cards) => [...cards, { key: res.reply, suggestion }]);
      }

      setPending(null);
      refreshAll();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "May problema sa server";
      if (msg.includes("Offline si Suki")) {
        // Server's offline message becomes a local assistant bubble.
        setPending((p) => (p ? { ...p, error: msg } : null));
      } else {
        toast.error(msg);
        setPending((p) => (p ? { ...p, error: GENERIC_ERROR } : null));
      }
    } finally {
      setSending(false);
    }
  }

  // ── Clear chat ─────────────────────────────────────────────────
  async function handleClearChat() {
    setClearing(true);
    try {
      await apiDelete("/api/ai/chat");
      setPending(null);
      setSuggestionCards([]);
      setAddedKeys(new Set());
      await refreshAll();
      toast.success("Nabura ang usapan");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "May problema sa server");
    } finally {
      setClearing(false);
    }
  }

  const history = ai.data ?? [];
  const showIntro = !ai.isLoading && !ai.isError && history.length === 0 && !pending;
  const canSend = input.trim().length > 0 && !sending && !offline;

  return (
    <div>
      <ScreenHeader
        title="Suki AI"
        subtitle="Ang store assistant mo"
        right={
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-xl text-muted-foreground hover:text-destructive"
                aria-label="Burahin ang usapan"
                disabled={clearing}
              >
                <Trash2 className="size-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Burahin ang usapan?</AlertDialogTitle>
                <AlertDialogDescription>
                  Mababura lahat ng mensahe ninyo ni Suki. Hindi na ito maibabalik.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Kanselahin</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-white hover:bg-destructive/90"
                  onClick={() => void handleClearChat()}
                >
                  Burahin
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        }
      />

      {/* Offline banner */}
      {offline && (
        <div className="px-4 pt-3">
          <div className="flex items-start gap-2.5 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3">
            <WifiOff className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="text-[13px] leading-snug text-amber-800 dark:text-amber-200">
              Offline ka ngayon.{" "}
              <span className="text-amber-700/80 dark:text-amber-200/70">
                Available pa rin ang ibang features ng app.
              </span>
            </p>
          </div>
        </div>
      )}

      <div className="flex min-h-[calc(100dvh-10rem)] flex-col">
        {/* Messages */}
        <div className="flex flex-1 flex-col gap-3 px-4 py-4" role="log" aria-live="polite">
          {ai.isLoading && !pending ? (
            <p className="my-auto text-center text-sm text-muted-foreground">Naglo-load ang usapan…</p>
          ) : ai.isError && !pending ? (
            <p className="my-auto text-center text-sm text-muted-foreground">
              Hindi ma-load ang usapan ngayon. Subukan ulit mamaya.
            </p>
          ) : showIntro ? (
            <StarterIntro disabled={offline || sending} onAsk={(q) => void handleSend(q)} />
          ) : (
            <>
              {history.map((m) => (
                <Fragment key={m.id}>
                  <ChatBubble message={m} />
                  {suggestionCards
                    .filter((c) => c.key === m.content)
                    .map((c) => (
                      <SuggestionCard
                        key={`${m.id}-sug`}
                        suggestion={c.suggestion}
                        added={addedKeys.has(c.key)}
                        onAdded={() => markAdded(c.key)}
                      />
                    ))}
                </Fragment>
              ))}

              {/* Local tail: optimistic user message + typing / reply / error */}
              {pending && (
                <Fragment key="pending-tail">
                  <ChatBubble
                    message={{ id: "pending-user", role: "user", content: pending.user, createdAt: "" }}
                  />
                  {sending ? (
                    <TypingIndicator />
                  ) : pending.reply ? (
                    <>
                      <ChatBubble
                        message={{
                          id: "pending-reply",
                          role: "assistant",
                          content: pending.reply,
                          createdAt: "",
                        }}
                      />
                      {pending.suggestion && (
                        <SuggestionCard
                          suggestion={pending.suggestion}
                          added={addedKeys.has(pending.reply)}
                          onAdded={() => {
                            if (pending.reply) markAdded(pending.reply);
                          }}
                        />
                      )}
                    </>
                  ) : pending.error ? (
                    <ChatBubble
                      message={{
                        id: "pending-error",
                        role: "assistant",
                        content: pending.error,
                        createdAt: "",
                      }}
                    />
                  ) : null}
                </Fragment>
              )}
            </>
          )}

          {/* Scroll anchor */}
          <div ref={endRef} aria-hidden="true" className="scroll-mb-28" />
        </div>

        {/* Sticky input bar — bottom offset keeps it above the fixed bottom nav */}
        <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom,0px))] z-20 mb-2 border-t border-border bg-background/95 px-3 py-3 backdrop-blur">
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (canSend) void handleSend(input);
            }}
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={500}
              disabled={offline}
              placeholder="Tanong kay Suki…"
              aria-label="Tanong kay Suki"
              className="h-12 flex-1 rounded-2xl text-[15px]"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!canSend}
              aria-label="Ipadala"
              className="h-12 w-12 shrink-0 rounded-2xl"
            >
              <SendHorizontal className="size-5" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
