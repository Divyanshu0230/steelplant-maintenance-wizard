"use client";

import { useEffect, useState } from "react";
import { Activity, Brain, Database, Radio, Zap } from "lucide-react";
import { api, AiStatus, FeedbackInsights } from "@/lib/api";

type DomainMini = {
  fault_patterns_count?: number;
  bonus_merit?: { fr1_domain_fine_tuning?: boolean };
};

function dot(ok: boolean, warn?: boolean) {
  if (ok) return "bg-status-healthy shadow-[0_0_6px_rgba(34,197,94,0.5)]";
  if (warn) return "bg-status-warning";
  return "bg-status-critical";
}

export default function PipelineLiveStatus() {
  const [ai, setAi] = useState<AiStatus | null>(null);
  const [domain, setDomain] = useState<DomainMini | null>(null);
  const [feedback, setFeedback] = useState<FeedbackInsights | null>(null);

  useEffect(() => {
    api.getAiStatus().then(setAi).catch(() => setAi(null));
    api.getDomainProfile().then(setDomain).catch(() => setDomain(null));
    api.getFeedbackInsights().then(setFeedback).catch(() => setFeedback(null));
  }, []);

  const llmReady = ai?.any_llm_ready ?? false;
  const fullAgentic = ai?.enable_full_agentic ?? false;
  const domainActive = (domain?.fault_patterns_count ?? 0) > 0;

  const tiles = [
    {
      icon: Zap,
      label: "LLM engine",
      value: llmReady ? "Agentic AI ready" : "ML fallback active",
      ok: llmReady,
      warn: !llmReady,
      sub: "Contextual reasoning",
    },
    {
      icon: Brain,
      label: "Domain SLM (FR1)",
      value: domainActive ? `${domain?.fault_patterns_count} patterns` : "not loaded",
      ok: domainActive,
      sub: domain?.bonus_merit?.fr1_domain_fine_tuning ? "Fine-tuned merit" : undefined,
    },
    {
      icon: Activity,
      label: "Full agentic",
      value: fullAgentic ? "LangGraph 10+ agents" : "Fast pipeline",
      ok: fullAgentic,
      sub: "Every chat & diagnosis",
    },
    {
      icon: Database,
      label: "Feedback loop (FR6)",
      value: `${feedback?.total_feedback ?? 0} ratings`,
      ok: (feedback?.total_feedback ?? 0) > 0,
      warn: (feedback?.total_feedback ?? 0) === 0,
      sub: `${feedback?.helpful_count ?? 0} helpful`,
    },
    {
      icon: Radio,
      label: "Real-time (FR7)",
      value: "60s scan + WebSocket",
      ok: true,
      sub: "Live Monitor",
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {tiles.map(({ icon: Icon, label, value, ok, warn, sub }) => (
        <div
          key={label}
          className={`rounded-xl border px-3 py-3 ${
            ok ? "border-status-healthy/25 bg-status-healthy/5" : warn ? "border-status-warning/25 bg-status-warning/5" : "border-[var(--border)] bg-[var(--background)]/50"
          }`}
        >
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 shrink-0 rounded-full ${dot(!!ok, !!warn)}`} />
            <Icon className="h-3.5 w-3.5 text-[var(--muted)]" />
            <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              {label}
            </span>
          </div>
          <div className="mt-1.5 text-sm font-semibold capitalize">{value}</div>
          {sub && <div className="mt-0.5 text-[10px] text-[var(--muted)]">{sub}</div>}
        </div>
      ))}
    </div>
  );
}
