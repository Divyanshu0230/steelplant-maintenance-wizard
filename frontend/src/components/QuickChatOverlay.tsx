"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, Loader2, Maximize2, Send, X } from "lucide-react";
import MarkdownRenderer from "@/components/MarkdownRenderer";
import { api, ChatResponse } from "@/lib/api";
import { ENGINE_LABELS, getEngineKind } from "@/lib/ai-display";

const QUICK_PROMPTS = [
  "Hi!",
  "Where is Live Monitoring?",
  "What is causing high vibration?",
  "Is it safe to keep running?",
];

type HistoryItem = { role: string; content: string; engine?: "api" | "rag" };

interface QuickChatOverlayProps {
  open: boolean;
  onClose: () => void;
}

export default function QuickChatOverlay({ open, onClose }: QuickChatOverlayProps) {
  const pathname = usePathname();
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<number | undefined>();
  const [lastEngine, setLastEngine] = useState<"api" | "rag">("api");
  const bottomRef = useRef<HTMLDivElement>(null);

  const send = useCallback(
    async (text: string) => {
      const userMsg = text.trim();
      if (!userMsg || loading) return;
      setLoading(true);
      setHistory((h) => [...h, { role: "user", content: userMsg }]);
      setMessage("");
      try {
        const res: ChatResponse = await api.chat(userMsg, {
          conversationId,
          currentPage: pathname || "/",
          chatMode: "assistant",
          useFullAgents: true,
        });
        const engine = getEngineKind(res.ai_mode, res.response_source);
        setLastEngine(engine);
        setConversationId(res.conversation_id);
        setHistory((h) => [...h, { role: "assistant", content: res.answer, engine }]);
      } catch (e) {
        setHistory((h) => [
          ...h,
          {
            role: "assistant",
            content: e instanceof Error ? e.message : "Something went wrong. Try again.",
            engine: "rag",
          },
        ]);
        setLastEngine("rag");
      } finally {
        setLoading(false);
      }
    },
    [conversationId, loading, pathname]
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, loading]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const status = ENGINE_LABELS[lastEngine];

  return (
    <>
      <div
        className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      <div
        className="fixed bottom-24 right-4 z-[70] flex w-[min(100vw-2rem,24rem)] flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-[0_12px_48px_rgba(0,0,0,0.45)] sm:right-8"
        role="dialog"
        aria-label="Quick AI chat"
      >
        <div
          className="flex items-center justify-between gap-2 px-4 py-3"
          style={{ background: "var(--gradient-btn)", color: "var(--btn-fg)" }}
        >
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4" />
            <div>
              <p className="text-sm font-semibold">AI Agentic Assistant</p>
              <p className="flex items-center gap-1.5 text-[10px] opacity-90">
                <span className={`h-2 w-2 rounded-full ${status.dotClass}`} />
                {status.label}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Link
              href={`/chat?page=${encodeURIComponent(pathname || "/")}`}
              className="rounded-lg p-1.5 opacity-90 transition hover:bg-white/15"
              title="Open full assistant"
              onClick={onClose}
            >
              <Maximize2 className="h-4 w-4" />
            </Link>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 opacity-90 transition hover:bg-white/15"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="max-h-72 space-y-2 overflow-y-auto p-3">
          {history.length === 0 && (
            <p className="py-6 text-center text-xs text-[var(--muted)]">
              Quick chat — ask anything about the plant or app navigation.
            </p>
          )}
          {history.map((m, i) => {
            const engine = m.engine ? ENGINE_LABELS[m.engine] : null;
            return (
              <div
                key={i}
                className={`rounded-lg p-2.5 text-xs ${
                  m.role === "user"
                    ? "ml-4 bg-[var(--surface-elevated)]"
                    : `mr-2 border-l-4 bg-[var(--background)] ${engine?.borderClass || ""}`
                }`}
              >
                {m.role === "assistant" ? (
                  <MarkdownRenderer content={m.content} />
                ) : (
                  m.content
                )}
              </div>
            );
          })}
          {loading && (
            <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Agentic AI thinking...
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-[var(--border)] px-3 py-2">
          <div className="mb-2 flex flex-wrap gap-1">
            {QUICK_PROMPTS.map((q) => (
              <button
                key={q}
                onClick={() => send(q)}
                disabled={loading}
                className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] text-[var(--muted)] hover:border-[var(--accent)]/40 disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send(message)}
              placeholder="Ask anything..."
              className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5 text-xs"
              disabled={loading}
            />
            <button
              onClick={() => send(message)}
              disabled={loading || !message.trim()}
              className="rounded-lg px-2.5 py-1.5 disabled:opacity-50"
              style={{ background: "var(--btn-bg)", color: "var(--btn-fg)" }}
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
