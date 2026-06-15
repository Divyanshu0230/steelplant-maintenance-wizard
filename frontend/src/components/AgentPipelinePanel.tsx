"use client";

import Link from "next/link";
import { Bot, Brain, CheckCircle2, Circle } from "lucide-react";
import AnimatedCard from "./AnimatedCard";

type AgentPath = "chat" | "dashboard" | "reports" | "feedback";

const AGENTS: { name: string; role: string; paths: AgentPath[] }[] = [
  { name: "Document Agent", role: "RAG search in manuals/SOPs", paths: ["chat", "dashboard"] },
  { name: "RCA Agent", role: "Root cause from sensors + ML", paths: ["chat"] },
  { name: "Predictive Agent", role: "RUL + failure probability", paths: ["chat", "dashboard"] },
  { name: "Planner Agent", role: "Ranked maintenance actions", paths: ["chat"] },
  { name: "Spare Parts Agent", role: "Stock check + procurement", paths: ["chat"] },
  { name: "Alert Agent", role: "Risk-based alert generation", paths: ["chat", "dashboard"] },
  { name: "Report Agent", role: "PDF maintenance summaries", paths: ["reports"] },
  { name: "Feedback Agent", role: "Learn from engineer corrections", paths: ["chat", "feedback"] },
];

const PATH_LABEL: Record<AgentPath, string> = {
  chat: "Chat",
  dashboard: "60s monitoring",
  reports: "PDF reports",
  feedback: "Thumbs up/down",
};

export default function AgentPipelinePanel() {
  return (
    <AnimatedCard delay={340}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-steel-500" />
          <h2 className="font-semibold">8-Agent AI Pipeline</h2>
        </div>
        <Link href="/agents" className="text-xs text-steel-500 hover:underline">
          Full details →
        </Link>
      </div>
      <p className="mb-3 text-xs text-gray-500">
        Green check = agent is <strong className="text-gray-400">implemented</strong> on at least one path.
        Chat uses one <strong className="text-gray-400">fast pipeline</strong> call (not 8 separate LLM agents).
        Alerts on the dashboard come from the <strong className="text-gray-400">60s monitoring loop</strong>, not chat.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {AGENTS.map((a, i) => (
          <div
            key={a.name}
            className="flex items-start gap-2 rounded-lg border border-[var(--border)] p-2 text-xs"
            style={{ animationDelay: `${i * 40}ms` }}
          >
            {a.paths.length > 0 ? (
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-500" />
            ) : (
              <Circle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-600" />
            )}
            <div>
              <div className="font-medium text-gray-300">{a.name}</div>
              <div className="text-gray-500">{a.role}</div>
              <div className="mt-0.5 text-[10px] text-steel-500/80">
                {a.paths.map((p) => PATH_LABEL[p]).join(" · ")}
              </div>
            </div>
          </div>
        ))}
      </div>
      <Link
        href="/chat"
        className="mt-3 flex items-center justify-center gap-2 rounded-lg border border-steel-500/30 py-2 text-xs text-steel-400 hover:bg-steel-500/10"
      >
        <Bot className="h-3.5 w-3.5" />
        Open Assistant to see live agent steps per question
      </Link>
    </AnimatedCard>
  );
}
