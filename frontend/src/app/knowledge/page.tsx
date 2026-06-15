"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  BookOpen,
  Bookmark,
  BookmarkCheck,
  ChevronDown,
  ChevronUp,
  Database,
  ExternalLink,
  FileText,
  HelpCircle,
  RefreshCw,
  Search,
  Sparkles,
  ThumbsUp,
  Trash2,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import AnimatedCard from "@/components/AnimatedCard";
import CitationChips from "@/components/CitationChips";
import DocumentViewer from "@/components/DocumentViewer";
import DownloadReportButton from "@/components/DownloadReportButton";
import MarkdownRenderer from "@/components/MarkdownRenderer";
import { api, KnowledgeDocument, KnowledgeDocumentDetail, SavedKnowledgeAnswer } from "@/lib/api";
import { dedupeCitations, formatCitationTitle } from "@/lib/citationDisplay";
import { KNOWLEDGE_QUICK_PROMPTS, KNOWLEDGE_ROLE_HINTS } from "@/lib/knowledgePrompts";
import { useToast } from "@/components/ToastProvider";

type SearchHit = { text: string; score: number; metadata: Record<string, string> };
type ViewMode = "idle" | "search" | "ai";

function scoreClass(score: number) {
  if (score >= 0.75) return "text-status-healthy bg-status-healthy/15";
  if (score >= 0.5) return "text-status-warning bg-status-warning/15";
  return "text-[var(--muted)] bg-[var(--border)]/40";
}

function docTypeBadge(type?: string) {
  const t = (type || "document").toLowerCase();
  if (t.includes("sop") || t.includes("manual")) return "SOP / Manual";
  if (t.includes("incident") || t.includes("failure")) return "Incident report";
  return type || "Document";
}

export default function KnowledgePage() {
  const [docs, setDocs] = useState<KnowledgeDocument[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchHit[]>([]);
  const [ingesting, setIngesting] = useState(false);
  const [searching, setSearching] = useState(false);
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [aiCitations, setAiCitations] = useState<SearchHit[]>([]);
  const [aiMeta, setAiMeta] = useState<{
    domainActive: boolean;
    sourcesMatched: number;
    aiMode?: string;
  } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [role, setRole] = useState<string>("engineer");
  const [viewMode, setViewMode] = useState<ViewMode>("idle");
  const [viewerDoc, setViewerDoc] = useState<KnowledgeDocumentDetail | null>(null);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [savedAnswers, setSavedAnswers] = useState<SavedKnowledgeAnswer[]>([]);
  const [savingAnswer, setSavingAnswer] = useState(false);
  const [answerSaved, setAnswerSaved] = useState(false);
  const [helpfulSent, setHelpfulSent] = useState(false);
  const [expandedSavedId, setExpandedSavedId] = useState<number | null>(null);
  const { toast } = useToast();
  const searchParams = useSearchParams();

  const load = () => api.getKnowledgeDocuments().then(setDocs).catch(() => setDocs([]));

  const loadSaved = () =>
    api.getSavedKnowledgeAnswers().then(setSavedAnswers).catch(() => setSavedAnswers([]));

  useEffect(() => {
    load();
    loadSaved();
  }, []);

  const openDocumentBySource = useCallback(
    async (sourceName: string) => {
      setViewerLoading(true);
      setViewerDoc(null);
      try {
        setViewerDoc(await api.getKnowledgeDocumentBySource(sourceName));
      } catch {
        const match = docs.find((d) =>
          d.title.toLowerCase().includes(sourceName.toLowerCase().replace(/_/g, " "))
        );
        if (match) {
          setViewerDoc(await api.getKnowledgeDocument(match.id));
        } else toast("error", "Document not found", sourceName);
      } finally {
        setViewerLoading(false);
      }
    },
    [docs, toast]
  );

  useEffect(() => {
    const open = searchParams.get("open");
    if (open && docs.length) openDocumentBySource(open);
  }, [searchParams, docs.length, openDocumentBySource]);

  const openDocument = async (id: number) => {
    setViewerLoading(true);
    setViewerDoc(null);
    try {
      setViewerDoc(await api.getKnowledgeDocument(id));
    } catch (e) {
      toast("error", "Could not open document", e instanceof Error ? e.message : "");
    } finally {
      setViewerLoading(false);
    }
  };

  const ingest = async () => {
    setIngesting(true);
    try {
      const res = await api.ingestKnowledge();
      toast(
        "success",
        "Knowledge base updated",
        `${res.documents_ingested ?? 0} docs, ${res.chunks_created ?? 0} chunks`
      );
      load();
    } catch (e) {
      toast("error", "Ingest failed", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setIngesting(false);
    }
  };

  const search = useCallback(async (q?: string) => {
    const term = (q ?? query).trim();
    if (!term) return;
    setQuery(term);
    setSearching(true);
    setViewMode("search");
    setAiAnswer(null);
    setAiMeta(null);
    setAnswerSaved(false);
    setHelpfulSent(false);
    try {
      const hits = await api.searchKnowledge(term);
      setResults(hits);
      setAiCitations([]);
      if (!hits.length) toast("info", "No matches", "Try a different keyword or use AI Answer");
    } catch {
      setResults([]);
      toast("error", "Search failed", "Could not query the knowledge index");
    } finally {
      setSearching(false);
    }
  }, [query, toast]);

  const askAI = useCallback(async (q?: string) => {
    const term = (q ?? query).trim();
    if (!term) return;
    setQuery(term);
    setAiLoading(true);
    setViewMode("ai");
    setAnswerSaved(false);
    setHelpfulSent(false);
    try {
      const res = await api.getKnowledgeAIAnswer(term, undefined, role);
      setAiAnswer(res.answer);
      setAiMeta({
        domainActive: res.domain_model_active,
        sourcesMatched: res.sources_matched ?? res.citations.length,
        aiMode: res.ai_mode,
      });
      const citeHits: SearchHit[] = res.citations.map((c) => ({
        text: c.excerpt,
        score: c.relevance_score,
        metadata: { source: c.source, document_type: c.document_type },
      }));
      setAiCitations(citeHits);
      setResults(citeHits);
    } catch (e) {
      toast("error", "AI answer failed", e instanceof Error ? e.message : "");
    } finally {
      setAiLoading(false);
    }
  }, [query, role, toast]);

  const handleQuickPrompt = (promptQuery: string, useAi = true) => {
    setQuery(promptQuery);
    if (useAi) void askAI(promptQuery);
    else void search(promptQuery);
  };

  const displayResults = viewMode === "ai" ? aiCitations : results;
  const uniqueCitations = dedupeCitations(
    displayResults.map((r) => ({
      source: r.metadata?.source || "document",
      document_type: r.metadata?.document_type || "document",
      excerpt: r.text,
      relevance_score: r.score,
    }))
  );

  const buildSavePayload = useCallback(() => {
    const cites = uniqueCitations.map((c) => ({
      source: c.source,
      document_type: c.document_type,
      excerpt: c.excerpt,
      relevance_score: c.relevance_score,
    }));
    let answerText = aiAnswer || "";
    if (!answerText && displayResults.length > 0) {
      answerText = displayResults
        .slice(0, 4)
        .map((r, i) => {
          const title = formatCitationTitle(r.metadata?.source || "document");
          return `### ${i + 1}. ${title}\n${r.text.replace(/^#+\s*/gm, "").trim().slice(0, 500)}`;
        })
        .join("\n\n");
    }
    return {
      question: query,
      answer: answerText,
      citations: cites,
      role,
      view_mode: viewMode === "search" ? "search" : "ai",
    };
  }, [aiAnswer, displayResults, query, role, uniqueCitations, viewMode]);

  const canSave =
    query.trim().length > 0 &&
    (Boolean(aiAnswer) || displayResults.length > 0) &&
    !searching &&
    !aiLoading;

  const saveAnswer = async () => {
    const payload = buildSavePayload();
    if (payload.answer.trim().length < 10) {
      toast("error", "Nothing to save", "Run Search or AI Answer first");
      return;
    }
    setSavingAnswer(true);
    try {
      const saved = await api.saveKnowledgeAnswer(payload);
      setAnswerSaved(true);
      setSavedAnswers((prev) => [saved, ...prev.filter((s) => s.id !== saved.id)]);
      toast("success", "Saved to Knowledge library", "Find it in Saved answers below");
    } catch (e) {
      toast("error", "Save failed", e instanceof Error ? e.message : "");
    } finally {
      setSavingAnswer(false);
    }
  };

  const markHelpful = async () => {
    const payload = buildSavePayload();
    if (!payload.answer) return;
    try {
      await api.submitFeedback({
        feedback_type: "confirmation",
        original_recommendation: `Knowledge (${viewMode}): ${query.slice(0, 200)}`,
        correction: payload.answer.slice(0, 500),
        rating: 5,
        outcome: "knowledge_helpful",
      });
      setHelpfulSent(true);
      toast("success", "Marked helpful", "Improves future knowledge answers");
    } catch (e) {
      toast("error", "Feedback failed", e instanceof Error ? e.message : "");
    }
  };

  const deleteSaved = async (id: number) => {
    try {
      await api.deleteSavedKnowledgeAnswer(id);
      setSavedAnswers((prev) => prev.filter((s) => s.id !== id));
      if (expandedSavedId === id) setExpandedSavedId(null);
      toast("success", "Removed from saved answers");
    } catch (e) {
      toast("error", "Delete failed", e instanceof Error ? e.message : "");
    }
  };

  const reopenSaved = (item: SavedKnowledgeAnswer) => {
    setQuery(item.question);
    setAiAnswer(item.answer);
    setViewMode(item.view_mode === "search" ? "search" : "ai");
    setAiMeta({
      domainActive: false,
      sourcesMatched: item.source_documents.length,
    });
    const hits: SearchHit[] = item.citations.map((c) => ({
      text: c.excerpt,
      score: c.relevance_score,
      metadata: { source: c.source, document_type: c.document_type },
    }));
    setResults(hits);
    setAiCitations(hits);
    setAnswerSaved(true);
    setHelpfulSent(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <AppShell>
      <DocumentViewer
        doc={viewerDoc}
        loading={viewerLoading}
        onClose={() => {
          setViewerDoc(null);
          setViewerLoading(false);
        }}
      />

      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-steel-500/15">
              <Database className="h-5 w-5 text-steel-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Knowledge Base</h1>
              <p className="mt-0.5 text-sm text-[var(--muted)]">
                Search manuals, SOPs, and incident reports — powers AI citations across the app
              </p>
            </div>
          </div>
          <button
            onClick={ingest}
            disabled={ingesting}
            className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm font-medium transition hover:border-steel-500/40 disabled:opacity-50"
            title="Re-read markdown files from data/documents/ and rebuild the search index"
          >
            <RefreshCw className={`h-4 w-4 ${ingesting ? "animate-spin" : ""}`} />
            {ingesting ? "Ingesting…" : "Re-ingest"}
          </button>
        </div>

        {/* How it works */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--background)]/60 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Search className="h-4 w-4 text-steel-400" />
              Search
            </div>
            <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">
              Finds matching <strong className="text-[var(--foreground)]">document excerpts</strong> from the
              vector index. Shows raw passages with relevance scores — best when you want to browse sources.
            </p>
          </div>
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-200">
              <Sparkles className="h-4 w-4" />
              AI Answer
            </div>
            <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">
              Retrieves the same documents, then <strong className="text-[var(--foreground)]">synthesizes a
              readable answer</strong> with key points, actions, and citations — best when you want a clear
              summary.
            </p>
          </div>
        </div>

        {/* Search workspace */}
        <AnimatedCard delay={0}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold">Semantic search</h2>
            <div className="flex flex-wrap gap-1.5">
              {(["operator", "engineer", "manager"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  title={KNOWLEDGE_ROLE_HINTS[r]}
                  className={`rounded-lg px-3 py-1 text-xs capitalize transition ${
                    role === r
                      ? "bg-steel-500 text-white"
                      : "border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <p className="mb-3 text-[11px] text-[var(--muted)]">
            <HelpCircle className="mr-1 inline h-3 w-3" />
            Role adjusts answer depth: {KNOWLEDGE_ROLE_HINTS[role]}
          </p>

          <div className="flex flex-wrap gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void search();
              }}
              placeholder="e.g. bearing failure, vibration SOP, motor overheating…"
              className="min-w-[220px] flex-1 rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-sm"
            />
            <button
              onClick={() => search()}
              disabled={searching || !query.trim()}
              className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-steel-500/20 px-4 py-2.5 text-sm font-medium hover:bg-steel-500/35 disabled:opacity-50"
            >
              <Search className={`h-4 w-4 ${searching ? "animate-pulse" : ""}`} />
              Search
            </button>
            <button
              onClick={() => askAI()}
              disabled={aiLoading || !query.trim()}
              className="flex items-center gap-2 rounded-xl bg-amber-500/25 px-4 py-2.5 text-sm font-medium text-amber-100 hover:bg-amber-500/35 disabled:opacity-50"
            >
              <Sparkles className={`h-4 w-4 ${aiLoading ? "animate-pulse" : ""}`} />
              AI Answer
            </button>
          </div>

          {/* Quick prompts */}
          <div className="mt-4">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              Quick prompts
            </p>
            <div className="flex flex-wrap gap-2">
              {KNOWLEDGE_QUICK_PROMPTS.map((p) => (
                <button
                  key={p.query}
                  type="button"
                  onClick={() => handleQuickPrompt(p.query)}
                  className="rounded-full border border-status-healthy/30 bg-status-healthy/10 px-3 py-1 text-[11px] font-medium text-status-healthy transition hover:bg-status-healthy/20"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </AnimatedCard>

        {/* Results panel */}
        {(viewMode !== "idle" || aiLoading || searching) && (
          <AnimatedCard delay={50}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {viewMode === "ai" ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-200">
                    <Sparkles className="h-3 w-3" />
                    AI Answer
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] px-3 py-1 text-xs font-medium text-[var(--muted)]">
                    <Search className="h-3 w-3" />
                    Search results
                  </span>
                )}
                {query && (
                  <span className="text-xs text-[var(--muted)]">
                    for <strong className="text-[var(--foreground)]">&ldquo;{query}&rdquo;</strong>
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {canSave && (
                  <>
                    <button
                      type="button"
                      onClick={markHelpful}
                      disabled={helpfulSent}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-[11px] font-medium text-[var(--muted)] transition hover:border-status-healthy/40 hover:text-status-healthy disabled:opacity-60"
                    >
                      <ThumbsUp className="h-3.5 w-3.5" />
                      {helpfulSent ? "Helpful ✓" : "Helpful"}
                    </button>
                    <button
                      type="button"
                      onClick={saveAnswer}
                      disabled={savingAnswer || answerSaved}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-steel-500/40 bg-steel-500/15 px-3 py-1.5 text-[11px] font-medium text-steel-200 transition hover:bg-steel-500/25 disabled:opacity-60"
                    >
                      {answerSaved ? (
                        <BookmarkCheck className="h-3.5 w-3.5 text-status-healthy" />
                      ) : (
                        <Bookmark className="h-3.5 w-3.5" />
                      )}
                      {savingAnswer ? "Saving…" : answerSaved ? "Saved" : "Save answer"}
                    </button>
                  </>
                )}
                {aiAnswer && viewMode === "ai" && (
                  <DownloadReportButton
                    compact
                    label="Download PDF"
                    payload={{
                      equipment_code: "Knowledge",
                      equipment_name: query.slice(0, 60),
                      answer: aiAnswer,
                    }}
                  />
                )}
              </div>
            </div>

            {(searching || aiLoading) && (
              <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] p-6 text-sm text-[var(--muted)]">
                <Sparkles className="h-4 w-4 animate-pulse text-amber-300" />
                {aiLoading ? "Synthesizing answer from manuals…" : "Searching knowledge index…"}
              </div>
            )}

            {viewMode === "ai" && aiAnswer && !aiLoading && (
              <div className="space-y-4">
                {aiMeta && (
                  <div className="flex flex-wrap gap-2 text-[10px]">
                    <span className="rounded-full bg-status-healthy/15 px-2 py-0.5 font-medium text-status-healthy">
                      {aiMeta.sourcesMatched} source{aiMeta.sourcesMatched === 1 ? "" : "s"} matched
                    </span>
                    {aiMeta.domainActive && (
                      <span className="rounded-full bg-steel-500/20 px-2 py-0.5 font-medium text-steel-300">
                        Steel domain expert active
                      </span>
                    )}
                  </div>
                )}
                <div className="rounded-xl border border-amber-500/20 bg-[var(--background)]/80 p-5">
                  <MarkdownRenderer content={aiAnswer} className="text-sm leading-relaxed" />
                </div>
                {uniqueCitations.length > 0 && (
                  <CitationChips
                    citations={uniqueCitations.map((c) => ({
                      ...c,
                      source: c.source,
                    }))}
                  />
                )}
              </div>
            )}

            {viewMode === "search" && !searching && (
              <div className="space-y-3">
                {displayResults.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--muted)]">
                    No documents matched. Try <strong>AI Answer</strong> for a synthesized response, or re-ingest
                    after adding files to <code className="text-steel-400">data/documents/</code>.
                  </p>
                ) : (
                  displayResults.map((r, i) => {
                    const source = r.metadata?.source || "document";
                    const title = formatCitationTitle(source);
                    const pct = (r.score * 100).toFixed(0);
                    return (
                      <button
                        key={`${source}-${i}`}
                        type="button"
                        onClick={() => source && openDocumentBySource(source)}
                        className="group w-full rounded-xl border border-[var(--border)] p-4 text-left transition hover:border-steel-500/40 hover:bg-steel-500/5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <BookOpen className="h-4 w-4 shrink-0 text-steel-400" />
                            <span className="truncate text-sm font-semibold">{title}</span>
                            <span
                              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${scoreClass(r.score)}`}
                            >
                              {pct}% match
                            </span>
                          </div>
                          <span className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
                            {docTypeBadge(r.metadata?.document_type)}
                          </span>
                        </div>
                        <p className="mt-2 line-clamp-4 text-sm leading-relaxed text-[var(--muted)]">
                          {r.text.replace(/^#+\s*/gm, "").trim()}
                        </p>
                        <p className="mt-2 flex items-center gap-1 text-[10px] text-steel-500 opacity-0 transition group-hover:opacity-100">
                          <ExternalLink className="h-3 w-3" />
                          Open full document
                        </p>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </AnimatedCard>
        )}

        {/* Saved answers */}
        {savedAnswers.length > 0 && (
          <AnimatedCard delay={75}>
            <h3 className="mb-1 flex items-center gap-2 font-semibold">
              <BookmarkCheck className="h-5 w-5 text-status-healthy" />
              Saved answers
              <span className="text-sm font-normal text-[var(--muted)]">({savedAnswers.length})</span>
            </h3>
            <p className="mb-4 text-xs text-[var(--muted)]">
              Bookmarked knowledge searches and AI answers — linked to indexed source documents.
            </p>
            <div className="space-y-2">
              {savedAnswers.map((item) => {
                const expanded = expandedSavedId === item.id;
                const savedDate = new Date(item.saved_at).toLocaleString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                });
                return (
                  <div
                    key={item.id}
                    className="rounded-xl border border-[var(--border)] bg-[var(--background)]/50 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => setExpandedSavedId(expanded ? null : item.id)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">{item.question}</span>
                          <span className="rounded-full bg-[var(--border)]/60 px-2 py-0.5 text-[10px] uppercase text-[var(--muted)]">
                            {item.view_mode}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-[var(--muted)]">
                          {savedDate}
                          {item.saved_by ? ` · ${item.saved_by}` : ""}
                          {item.source_documents.length > 0
                            ? ` · ${item.source_documents.length} doc${item.source_documents.length === 1 ? "" : "s"}`
                            : ""}
                        </p>
                      </button>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => reopenSaved(item)}
                          className="rounded-lg border border-[var(--border)] px-2.5 py-1 text-[10px] font-medium hover:border-steel-500/40"
                        >
                          Reopen
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteSaved(item.id)}
                          className="rounded-lg border border-[var(--border)] p-1.5 text-[var(--muted)] hover:border-status-critical/40 hover:text-status-critical"
                          title="Remove saved answer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setExpandedSavedId(expanded ? null : item.id)}
                          className="rounded-lg border border-[var(--border)] p-1.5 text-[var(--muted)]"
                        >
                          {expanded ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                    {expanded && (
                      <div className="mt-3 border-t border-[var(--border)] pt-3">
                        <MarkdownRenderer content={item.answer.slice(0, 3000)} className="text-xs leading-relaxed" />
                        {item.source_documents.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {item.source_documents.map((src) => (
                              <button
                                key={src}
                                type="button"
                                onClick={() => openDocumentBySource(src)}
                                className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] px-2.5 py-1 text-[10px] text-steel-300 hover:border-steel-500/40"
                              >
                                <BookOpen className="h-3 w-3" />
                                {formatCitationTitle(src)}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </AnimatedCard>
        )}

        {/* Document library */}
        <AnimatedCard delay={100}>
          <h3 className="mb-1 flex items-center gap-2 font-semibold">
            <FileText className="h-5 w-5 text-steel-400" />
            Indexed documents
            <span className="text-sm font-normal text-[var(--muted)]">({docs.length})</span>
          </h3>
          <p className="mb-4 text-xs text-[var(--muted)]">
            Click any document to read the full file. These are indexed from{" "}
            <code className="text-steel-400">data/documents/</code>.
          </p>
          {docs.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              No documents indexed yet. Run seed script or click Re-ingest.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {docs.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => openDocument(d.id)}
                  className="rounded-xl border border-[var(--border)] bg-[var(--background)]/50 p-4 text-left transition hover:border-steel-500/40 hover:bg-steel-500/5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm font-semibold leading-snug">{d.title}</div>
                    <ExternalLink className="h-4 w-4 shrink-0 text-steel-500" />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
                    <span className="rounded bg-steel-500/15 px-1.5 py-0.5 uppercase text-steel-300">
                      {d.document_type}
                    </span>
                    <span className="text-[var(--muted)]">{d.chunk_count} chunks</span>
                    {d.equipment_type && (
                      <span className="text-[var(--muted)]">{d.equipment_type}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </AnimatedCard>
      </div>
    </AppShell>
  );
}
