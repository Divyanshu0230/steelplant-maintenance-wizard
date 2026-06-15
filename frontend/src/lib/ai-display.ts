/** User-facing AI engine labels — never expose provider names (Groq, Claude, etc.). */

export type AiEngineKind = "api" | "rag";

const LLM_MODES = new Set([
  "agentic",
  "gemini",
  "groq",
  "anthropic",
  "openai",
  "xai",
  "ollama",
]);

export function getEngineKind(aiMode?: string, responseSource?: string): AiEngineKind {
  if (responseSource === "agentic_ai" || responseSource === "full_agentic_orchestrator" || responseSource === "assistant_agentic") {
    return "api";
  }
  if (aiMode === "enhanced_offline" || responseSource === "ml_rag_engine") return "rag";
  if (aiMode && LLM_MODES.has(aiMode)) return "api";
  return "rag";
}

export const ENGINE_LABELS = {
  api: {
    label: "Agentic AI",
    hint: "Powered by cloud AI reasoning",
    dotClass: "bg-status-healthy",
    borderClass: "border-l-status-healthy",
    bannerClass: "border-status-healthy/40 bg-status-healthy/10 text-status-healthy",
  },
  rag: {
    label: "Knowledge Engine",
    hint: "ML models + RAG knowledge base",
    dotClass: "bg-status-warning",
    borderClass: "border-l-status-warning",
    bannerClass: "border-status-warning/40 bg-status-warning/10 text-status-warning",
  },
} as const;
