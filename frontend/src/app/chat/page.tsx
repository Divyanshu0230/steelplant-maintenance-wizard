"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  Bot,
  ChevronDown,
  ChevronRight,
  Gauge,
  History,
  Loader2,
  Microscope,
  Send,
  Sparkles,
  Terminal,
} from "lucide-react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import CitationChips from "@/components/CitationChips";
import DiagnosisInsightPanel from "@/components/DiagnosisInsightPanel";
import FollowUpChips from "@/components/FollowUpChips";
import MarkdownRenderer from "@/components/MarkdownRenderer";
import { api, ChatResponse, ConversationSummary, Equipment, EquipmentHealth } from "@/lib/api";
import { mergeFollowUps, parseChatAnswer } from "@/lib/chatAnswer";
import DownloadReportButton from "@/components/DownloadReportButton";
import { payloadFromChatResponse } from "@/lib/diagnosisReport";
import { ENGINE_LABELS, getEngineKind } from "@/lib/ai-display";
import { getQuickPrompts, CHAT_WELCOME_LINES } from "@/lib/chatPrompts";
import { useToast } from "@/components/ToastProvider";

const MAINTENANCE_PROMPT_RE =
  /vibrat|temperatur|failure|anomal|diagnos|safe to|keep running|what should i|next step|root cause|spare part|spare parts|which spare|what spare|rul|remaining useful|fault|alarm|bearing|overheat|pressure|blower|sop|manual|emergency action/i;

const EQUIPMENT_CONTEXT_RE =
  /summar|issue|problem|status|health|condition|overview|what'?s wrong|current state|open alerts?|tell me about|recent fault|spare|sop|manual/i;

type HistoryItem = { role: string; content: string; engine?: "api" | "rag" };

function riskBadgeClass(level?: string) {
  const r = (level || "low").toLowerCase();
  if (r === "critical" || r === "high") return "bg-status-critical/15 text-status-critical";
  if (r === "medium" || r === "moderate") return "bg-status-warning/15 text-status-warning";
  return "bg-status-healthy/15 text-status-healthy";
}

function resolveEngine(res: ChatResponse): "api" | "rag" {
  if (res.intent === "greeting" || res.intent === "navigation") return "api";
  if (res.intent === "maintenance" && (res.agent_steps?.length ?? 0) > 0) return "api";
  return getEngineKind(res.ai_mode, res.response_source);
}

export default function ChatPage() {
  const [message, setMessage] = useState("");
  const [currentPage, setCurrentPage] = useState("/");
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState("");
  const [focusHealth, setFocusHealth] = useState<EquipmentHealth | null>(null);
  const [chatResponse, setChatResponse] = useState<ChatResponse | null>(null);
  const [conversationId, setConversationId] = useState<number | undefined>();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [agentSteps, setAgentSteps] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [aiMode, setAiMode] = useState("agentic");
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [savingLogbook, setSavingLogbook] = useState(false);
  const [requestingPart, setRequestingPart] = useState<string | null>(null);
  const [guidedMode, setGuidedMode] = useState(false);
  const [insightTab, setInsightTab] = useState<"causes" | "actions" | "spares">("causes");
  const [showAgentTrace, setShowAgentTrace] = useState(false);
  const [showAllPrompts, setShowAllPrompts] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);
  const autoQuestionFired = useRef(false);
  const { toast } = useToast();

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = threadRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior });
    });
  }, []);

  const isMaintenance = chatResponse?.intent === "maintenance";

  const isMaintenanceQuestion = useCallback(
    (text: string) =>
      MAINTENANCE_PROMPT_RE.test(text) ||
      Boolean(selectedEquipment && EQUIPMENT_CONTEXT_RE.test(text)),
    [selectedEquipment]
  );

  const loadConversations = useCallback(async () => {
    try {
      setConversations(await api.getConversations());
    } catch {
      /* ignore */
    }
  }, []);

  const sendChat = useCallback(
    async (userMsg: string, convId?: number, forceDiagnosis?: boolean) => {
      const useDiagnosis = forceDiagnosis || isMaintenanceQuestion(userMsg);
      const res = await api.chat(userMsg, {
        equipmentCode: selectedEquipment || undefined,
        conversationId: convId,
        currentPage,
        chatMode: useDiagnosis ? "diagnosis" : "assistant",
        useFullAgents: true,
      });
      const engine = resolveEngine(res);
      setChatResponse(res);
      setConversationId(res.conversation_id);
      setAiMode(res.ai_mode || "agentic");
      setAgentSteps(res.agent_steps || []);
      setHistory((h) => [...h, { role: "assistant", content: res.answer, engine }]);
      setInsightTab("causes");
      loadConversations();
      setTimeout(() => scrollToBottom("smooth"), 50);
      return res;
    },
    [currentPage, isMaintenanceQuestion, loadConversations, scrollToBottom, selectedEquipment]
  );

  const handleChat = useCallback(
    async (text?: string) => {
      const userMsg = (text ?? message).trim();
      if (!userMsg || loading) return;
      const needsEquipment = isMaintenanceQuestion(userMsg);
      if (needsEquipment && !selectedEquipment) {
        setError("Select a focus asset above for equipment questions.");
        return;
      }
      setLoading(true);
      setError("");
      setFeedbackSent(false);
      const isMaint = isMaintenanceQuestion(userMsg);
      setAgentSteps(
        isMaint
          ? ["Analyzing asset with agent pipeline…"]
          : ["Understanding your question…"]
      );
      setHistory((h) => [...h, { role: "user", content: userMsg }]);
      setMessage("");
      scrollToBottom("auto");
      if (isMaint) setChatResponse(null);
      try {
        await sendChat(userMsg, conversationId, isMaint);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Chat failed");
        setHistory((h) => h.slice(0, -1));
        setMessage(userMsg);
        setAgentSteps([]);
      } finally {
        setLoading(false);
      }
    },
    [conversationId, isMaintenanceQuestion, loading, message, scrollToBottom, selectedEquipment, sendChat]
  );

  useEffect(() => {
    loadConversations();
    api.getEquipment().then((eq) => {
      setEquipmentList(eq);
      if (eq.length && !selectedEquipment) setSelectedEquipment(eq[0].equipment_code);
    });
    const params = new URLSearchParams(window.location.search);
    const eq = params.get("equipment");
    const q = params.get("question") || params.get("q");
    const page = params.get("page");
    const guided = params.get("guided");
    if (page) setCurrentPage(page);
    if (eq) setSelectedEquipment(eq);
    if (guided) setGuidedMode(true);
    if (q && !autoQuestionFired.current) {
      autoQuestionFired.current = true;
      const equipment = eq || undefined;
      if (equipment) setSelectedEquipment(equipment);
      setTimeout(async () => {
        setLoading(true);
        setError("");
        setHistory([{ role: "user", content: q }]);
        try {
          const useDiagnosis = Boolean(equipment) || isMaintenanceQuestion(q);
          const res = await api.chat(q, {
            equipmentCode: equipment,
            currentPage: page || "/",
            chatMode: useDiagnosis ? "diagnosis" : "assistant",
            useFullAgents: true,
          });
          const engine = resolveEngine(res);
          setChatResponse(res);
          setConversationId(res.conversation_id);
          setAiMode(res.ai_mode || "agentic");
          setAgentSteps(res.agent_steps || []);
          setHistory((h) => [...h, { role: "assistant", content: res.answer, engine }]);
          setInsightTab("causes");
          loadConversations();
        } catch (e) {
          setError(e instanceof Error ? e.message : "Chat failed");
          setAgentSteps([]);
        } finally {
          setLoading(false);
        }
      }, 400);
    }
  }, [loadConversations]);

  useEffect(() => {
    if (!selectedEquipment) {
      setFocusHealth(null);
      return;
    }
    api
      .getHealth()
      .then((rows) => setFocusHealth(rows.find((h) => h.equipment_code === selectedEquipment) || null))
      .catch(() => setFocusHealth(null));
  }, [selectedEquipment]);

  useEffect(() => {
    scrollToBottom(loading ? "auto" : "smooth");
  }, [history, loading, chatResponse, scrollToBottom]);

  const loadHistory = async (id: number) => {
    const msgs = await api.getConversationMessages(id);
    setHistory(msgs.map((m) => ({ role: m.role, content: m.content })));
    setConversationId(id);
    setChatResponse(null);
    setAgentSteps([]);
    setFeedbackSent(false);
    setInsightTab("causes");
  };

  const submitFeedback = async (type: "confirmation" | "rejection") => {
    if (!chatResponse) return;
    try {
      await api.submitFeedback({
        conversation_id: chatResponse.conversation_id,
        feedback_type: type,
        original_recommendation: chatResponse.answer.slice(0, 300),
        rating: type === "confirmation" ? 5 : 2,
      });
      setFeedbackSent(true);
      toast("success", "Feedback recorded");
    } catch (e) {
      toast("error", "Feedback failed", e instanceof Error ? e.message : "");
    }
  };

  const saveToLogbook = async () => {
    if (!chatResponse?.answer || !selectedEquipment) return;
    setSavingLogbook(true);
    try {
      await api.createLogbookEntry({
        equipment_code: selectedEquipment,
        description: chatResponse.answer.slice(0, 1500),
        maintenance_type: "ai_assisted_diagnosis",
      });
      toast("success", "Saved to logbook");
    } catch (e) {
      toast("error", "Logbook save failed", e instanceof Error ? e.message : "");
    } finally {
      setSavingLogbook(false);
    }
  };

  const requestSparePart = async (partCode: string, partName: string) => {
    setRequestingPart(partCode);
    try {
      const parts = await api.getSpareParts();
      const part = parts.find((p) => p.part_code === partCode);
      if (!part) {
        toast("error", "Part not found", partCode);
        return;
      }
      const qty = Math.max(1, part.minimum_stock - part.quantity_available + 1);
      const res = await api.createProcurement({
        spare_part_id: part.id,
        quantity_requested: qty,
        urgency: part.quantity_available <= 0 ? "critical" : "high",
        notes: `AI-recommended for ${selectedEquipment}: ${partName}`,
      });
      toast("success", `Procurement #${res.id} created`, `${partName} · qty ${qty}`);
      if (guidedMode) {
        setTimeout(() => {
          window.location.href = "/procurement";
        }, 1200);
      }
    } catch (e) {
      toast("error", "Procurement failed", e instanceof Error ? e.message : "");
    } finally {
      setRequestingPart(null);
    }
  };

  const engineInfo = chatResponse
    ? ENGINE_LABELS[resolveEngine(chatResponse)]
    : ENGINE_LABELS.api;
  const showInsightPanel = isMaintenance && !!chatResponse;
  const focusEquipment = equipmentList.find((e) => e.equipment_code === selectedEquipment);

  const handleQuickPrompt = (prompt: string, requiresEquipment?: boolean) => {
    if (requiresEquipment && !selectedEquipment) {
      setError("Select a focus asset first.");
      return;
    }
    handleChat(prompt);
  };

  const quickPrompts = getQuickPrompts(
    selectedEquipment || undefined,
    focusEquipment?.equipment_type,
    focusHealth?.risk_level
  );

  return (
    <AppShell>
      <div className="chat-workspace flex h-[calc(100dvh-7.5rem)] max-h-[calc(100dvh-7.5rem)] flex-col gap-2 overflow-hidden">
        <div className="chat-header-bar flex flex-wrap items-center justify-between gap-3 rounded-2xl px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="chat-avatar-ring">
              <div className="flex h-10 w-10 items-center justify-center">
                <Bot className="h-5 w-5 text-[var(--foreground)]" />
              </div>
            </div>
            <div>
              <h1 className="flex items-center gap-2 text-base font-bold tracking-tight">
                AI Agentic Assistant
                <Sparkles className="h-4 w-4 text-status-healthy" />
              </h1>
              <p className="text-xs text-[var(--muted)]">Plant Q&A · navigation · equipment help</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`chat-engine-badge inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${engineInfo.bannerClass}`}
            >
              <span className={`h-2 w-2 animate-pulse rounded-full ${engineInfo.dotClass}`} />
              {engineInfo.label}
            </span>
            <label className="flex items-center gap-2 text-xs">
              <span className="hidden text-[var(--muted)] sm:inline">Focus asset</span>
              <select
                value={selectedEquipment}
                onChange={(e) => setSelectedEquipment(e.target.value)}
                className="chat-input-field max-w-[11rem] rounded-lg px-3 py-1.5 text-xs font-medium"
                aria-label="Focus asset for equipment questions"
              >
                <option value="">Plant-wide (no asset)</option>
                {equipmentList.map((e) => (
                  <option key={e.id} value={e.equipment_code}>
                    {e.equipment_code}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="rounded-lg border border-[var(--border)] bg-[var(--background)]/60 px-4 py-2 text-[11px] text-[var(--muted)]">
          <span className="font-medium text-[var(--foreground)]">How to use:</span>{" "}
          {CHAT_WELCOME_LINES.howTo}
          {selectedEquipment ? (
            <span className="text-status-healthy">
              {" "}
              · Equipment questions apply to <strong className="font-semibold">{selectedEquipment}</strong>
            </span>
          ) : (
            <span> · Select an asset for fault, status, and spare-part questions</span>
          )}
        </div>

        {selectedEquipment && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-status-healthy/10">
                <Gauge className="h-4 w-4 text-status-healthy" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {selectedEquipment}
                  {focusEquipment?.name ? ` · ${focusEquipment.name}` : ""}
                </p>
                <p className="text-xs text-[var(--muted)]">
                  {focusHealth
                    ? `Health ${Math.round(focusHealth.health_score)}% · ${focusHealth.risk_level} risk`
                    : "Agentic AI will use this asset for equipment questions"}
                </p>
              </div>
              {focusHealth && (
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${riskBadgeClass(focusHealth.risk_level)}`}
                >
                  {focusHealth.risk_level}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/equipment/${encodeURIComponent(selectedEquipment)}`}
                className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-[11px] font-medium transition hover:border-status-healthy/40 hover:text-status-healthy"
              >
                View full details
                <ChevronRight className="h-3 w-3" />
              </Link>
              <Link
                href={`/diagnosis?equipment=${encodeURIComponent(selectedEquipment)}`}
                className="inline-flex items-center gap-1 rounded-lg border border-steel-500/40 bg-steel-500/10 px-2.5 py-1.5 text-[11px] font-medium text-steel-300 transition hover:bg-steel-500/20"
              >
                <Microscope className="h-3 w-3" />
                Diagnosis
              </Link>
              <Link
                href="/live"
                className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--muted)] transition hover:text-[var(--foreground)]"
              >
                <Activity className="h-3 w-3" />
                Live
              </Link>
            </div>
          </div>
        )}

        <div
          className={`grid min-h-0 flex-1 gap-3 overflow-hidden ${
            showInsightPanel
              ? "lg:grid-cols-[11rem_minmax(0,1fr)_minmax(280px,22rem)]"
              : "lg:grid-cols-[11rem_minmax(0,1fr)]"
          }`}
        >
          <aside className="chat-panel flex min-h-0 flex-col overflow-hidden rounded-2xl">
            <div className="border-b border-[var(--border)] p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-semibold">
                  <History className="h-3.5 w-3.5 text-[var(--muted)]" />
                  History
                </span>
                <button
                  onClick={() => {
                    setConversationId(undefined);
                    setHistory([]);
                    setChatResponse(null);
                    setAgentSteps([]);
                    setFeedbackSent(false);
                    setInsightTab("causes");
                  }}
                  className="rounded-lg border border-[var(--border)] px-2 py-0.5 text-[10px] font-medium text-status-healthy transition hover:bg-status-healthy/10"
                >
                  + New
                </button>
              </div>
              <div className="max-h-40 space-y-1 overflow-y-auto">
                {conversations.length === 0 && (
                  <p className="px-2 py-2 text-center text-[10px] text-[var(--muted)]">No chats yet</p>
                )}
                {conversations.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => loadHistory(c.id)}
                    className={`chat-history-item w-full truncate px-2.5 py-2 text-left text-[11px] ${
                      conversationId === c.id ? "chat-history-item--active" : ""
                    }`}
                  >
                    {c.title || `Chat #${c.id}`}
                  </button>
                ))}
              </div>
            </div>
            {agentSteps.length > 0 && (
              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                <button
                  onClick={() => setShowAgentTrace((v) => !v)}
                  className="mb-2 flex w-full items-center gap-2 rounded-lg bg-[var(--background)] px-2 py-1.5 text-[10px] font-medium text-[var(--muted)]"
                >
                  <Terminal className="h-3 w-3 text-status-healthy" />
                  Agent trace
                  <span className="rounded-full bg-[var(--border)] px-1.5">{agentSteps.length}</span>
                  <ChevronDown
                    className={`ml-auto h-3 w-3 transition-transform ${showAgentTrace ? "rotate-180" : ""}`}
                  />
                </button>
                {showAgentTrace && (
                  <div className="space-y-1.5">
                    {agentSteps.map((s, i) => (
                      <div
                        key={i}
                        className={`chat-trace-step font-mono text-[9px] leading-relaxed ${
                          i === agentSteps.length - 1 && !loading ? "chat-trace-step--live" : "text-[var(--muted)]"
                        }`}
                      >
                        {s}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </aside>

          <main className="chat-panel chat-main flex min-h-0 flex-col overflow-hidden rounded-2xl">
            <div
              ref={threadRef}
              className="chat-thread min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4"
            >
              <div className="flex min-h-min flex-col gap-3">
              {history.length === 0 && (
                <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
                  <div className="chat-empty-orb mb-4">
                    <Bot className="h-8 w-8 text-status-healthy" />
                  </div>
                  <p className="text-base font-semibold">{CHAT_WELCOME_LINES.title}</p>
                  <p className="mt-2 max-w-md text-sm leading-relaxed text-[var(--muted)]">
                    {CHAT_WELCOME_LINES.subtitle}
                  </p>
                  <p className="mt-3 rounded-full border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-1 text-xs text-[var(--muted)]">
                    {CHAT_WELCOME_LINES.howTo}
                  </p>
                </div>
              )}
              {history.map((m, i) => {
                const bubbleEngine = m.engine ? ENGINE_LABELS[m.engine] : null;
                const isLastAssistant = m.role === "assistant" && i === history.length - 1;
                const parsed = m.role === "assistant" ? parseChatAnswer(m.content) : null;
                const displayContent = parsed?.body ?? m.content;
                const bubbleFollowUps = isLastAssistant
                  ? mergeFollowUps(chatResponse?.follow_up_suggestions, parsed?.followUps)
                  : [];
                return (
                  <div
                    key={i}
                    className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      m.role === "user"
                        ? "chat-bubble-user ml-auto max-w-[85%]"
                        : `chat-bubble-assistant max-w-full ${m.engine === "api" ? "chat-bubble-assistant--api" : m.engine === "rag" ? "chat-bubble-assistant--rag" : ""}`
                    }`}
                  >
                    {m.role === "assistant" && (
                      <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-status-healthy">
                        <Bot className="h-3 w-3" />
                        {bubbleEngine?.label ?? "Agentic AI"}
                      </div>
                    )}
                    {m.role === "assistant" ? (
                      <MarkdownRenderer content={displayContent} />
                    ) : (
                      m.content
                    )}
                    {isLastAssistant && chatResponse?.citations?.length ? (
                      <CitationChips citations={chatResponse.citations} />
                    ) : null}
                    {isLastAssistant && chatResponse?.navigation_links?.length ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {chatResponse.navigation_links.map((link) => (
                          <Link
                            key={link.route}
                            href={link.route}
                            className="inline-flex items-center gap-1 rounded-full border border-status-healthy/40 bg-status-healthy/10 px-2 py-0.5 text-[10px] text-status-healthy"
                          >
                            <ChevronRight className="h-3 w-3" />
                            {link.label}
                          </Link>
                        ))}
                      </div>
                    ) : null}
                    {isLastAssistant && bubbleFollowUps.length > 0 ? (
                      <FollowUpChips
                        items={bubbleFollowUps}
                        onSelect={(fq) => handleChat(fq)}
                        disabled={loading}
                      />
                    ) : null}
                    {isLastAssistant && isMaintenance && chatResponse && selectedEquipment ? (
                      <div className="mt-3 flex flex-wrap gap-2 border-t border-[var(--border)] pt-3">
                        <DownloadReportButton
                          payload={payloadFromChatResponse(
                            chatResponse,
                            selectedEquipment,
                            focusEquipment?.name
                          )}
                        />
                      </div>
                    ) : null}
                  </div>
                );
              })}
              {loading && (
                <div className="chat-typing flex items-center gap-3 rounded-2xl px-4 py-3 text-sm text-[var(--muted)]">
                  <Loader2 className="h-4 w-4 animate-spin text-status-healthy" />
                  <span>Thinking…</span>
                </div>
              )}
              </div>
            </div>

            <div className="chat-composer shrink-0 border-t border-[var(--border)] p-3">
              {history.length > 0 && (
                <div className="mb-2">
                  <button
                    type="button"
                    onClick={() => setShowAllPrompts((v) => !v)}
                    className="mb-1 text-[10px] font-medium text-[var(--muted)] hover:text-[var(--foreground)]"
                  >
                    {showAllPrompts ? "Hide suggestions" : `Suggestions for ${selectedEquipment || "plant"}`}
                  </button>
                  {(showAllPrompts || history.length === 0) && (
                    <div className="flex max-h-20 flex-wrap gap-1.5 overflow-y-auto">
                      {quickPrompts.map(({ prompt, requiresEquipment, assetSpecific }) => (
                        <button
                          key={prompt}
                          type="button"
                          onClick={() => handleQuickPrompt(prompt, requiresEquipment)}
                          disabled={loading}
                          className={`chat-prompt-chip shrink-0 rounded-full px-3 py-1 text-[11px] disabled:opacity-50 ${
                            assetSpecific
                              ? "border-status-healthy/35 bg-status-healthy/10 font-medium text-status-healthy"
                              : "text-[var(--muted)]"
                          }`}
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {history.length === 0 && (
                <div className="mb-2">
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-status-healthy">
                    {selectedEquipment ? `Suggestions for ${selectedEquipment}` : "Try asking"}
                  </p>
                  <div className="flex max-h-20 flex-wrap gap-1.5 overflow-y-auto">
                    {quickPrompts.map(({ prompt, requiresEquipment, assetSpecific }) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => handleQuickPrompt(prompt, requiresEquipment)}
                        disabled={loading}
                        className={`chat-prompt-chip shrink-0 rounded-full px-3 py-1 text-[11px] disabled:opacity-50 ${
                          assetSpecific
                            ? "border-status-healthy/35 bg-status-healthy/10 font-medium text-status-healthy"
                            : "text-[var(--muted)]"
                        }`}
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {error && <p className="mb-2 text-xs text-status-critical">{error}</p>}
              <div className="flex gap-2">
                <input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleChat()}
                  placeholder={
                    selectedEquipment
                      ? `Ask about ${selectedEquipment} or the plant…`
                      : "Ask about the plant or navigation…"
                  }
                  className="chat-input-field flex-1 rounded-xl px-4 py-3 text-sm"
                  disabled={loading}
                />
                <button
                  onClick={() => handleChat()}
                  disabled={loading || !message.trim()}
                  className="chat-send-btn rounded-xl px-5 py-3 disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </main>

          {showInsightPanel && chatResponse && (
            <aside className="min-h-0">
              <DiagnosisInsightPanel
                response={chatResponse}
                equipmentCode={selectedEquipment}
                equipmentName={focusEquipment?.name}
                activeTab={insightTab}
                onTabChange={setInsightTab}
                feedbackSent={feedbackSent}
                savingLogbook={savingLogbook}
                requestingPart={requestingPart}
                onFeedback={submitFeedback}
                onSaveLogbook={saveToLogbook}
                onRequestPart={requestSparePart}
              />
            </aside>
          )}
        </div>
      </div>
    </AppShell>
  );
}
