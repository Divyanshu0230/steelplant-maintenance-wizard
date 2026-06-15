"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  Brain,
  ClipboardList,
  FileText,
  MessageSquare,
  Package,
  Search,
  TrendingUp,
} from "lucide-react";
import clsx from "clsx";

const AGENTS = [
  { id: "supervisor", name: "Supervisor Agent", icon: Brain, desc: "Autonomous routing & planning" },
  { id: "domain", name: "Domain SLM", icon: Brain, desc: "Steel fault expert layer" },
  { id: "document", name: "Document Intelligence", icon: BookOpen, desc: "RAG over manuals & SOPs" },
  { id: "operational", name: "Operational Agent", icon: Search, desc: "Delay logs & fault messages" },
  { id: "predictive", name: "Predictive Maintenance", icon: TrendingUp, desc: "RUL & anomaly ML" },
  { id: "rca", name: "Root Cause Analysis", icon: Search, desc: "Probable causes + evidence" },
  { id: "planner", name: "Maintenance Planner", icon: ClipboardList, desc: "Prioritized action plan" },
  { id: "spare", name: "Spare Parts Agent", icon: Package, desc: "Stock & procurement" },
  { id: "alert", name: "Alert Agent", icon: AlertTriangle, desc: "Risk-based alerting" },
  { id: "feedback", name: "Feedback Learning", icon: MessageSquare, desc: "Engineer learning loop" },
  { id: "synthesizer", name: "Synthesizer", icon: FileText, desc: "Final answer composition" },
];

interface AgentPipelineProps {
  activeStep?: number;
  autoPlay?: boolean;
}

export default function AgentPipeline({ activeStep, autoPlay = true }: AgentPipelineProps) {
  const [step, setStep] = useState(activeStep ?? 0);

  useEffect(() => {
    if (activeStep != null) setStep(activeStep);
  }, [activeStep]);

  useEffect(() => {
    if (!autoPlay || activeStep != null) return;
    const t = setInterval(() => setStep((s) => (s + 1) % AGENTS.length), 2200);
    return () => clearInterval(t);
  }, [autoPlay, activeStep]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <MessageSquare className="h-4 w-4 text-steel-500" />
        Query flows through a <strong className="text-steel-400">Supervisor Agent</strong> that autonomously routes
        11 specialist agents (LangGraph — live on every chat & diagnosis)
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {AGENTS.map((agent, i) => {
          const Icon = agent.icon;
          const isActive = i === step;
          const isDone = i < step;
          return (
            <div
              key={agent.id}
              className={clsx(
                "animate-fade-in-up relative rounded-xl border p-4 transition-all duration-500",
                isActive
                  ? "agent-active border-steel-500 bg-steel-500/15 shadow-lg shadow-steel-500/10"
                  : isDone
                    ? "border-green-500/30 bg-green-500/5"
                    : "border-[var(--border)] bg-[var(--card)] opacity-70"
              )}
              style={{ animationDelay: `${i * 80}ms` }}
            >
              {isActive && (
                <span className="absolute -right-1 -top-1 flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-steel-500 opacity-75" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-steel-500" />
                </span>
              )}
              <div className="flex items-center gap-2">
                <div
                  className={clsx(
                    "rounded-lg p-2 transition-colors",
                    isActive ? "bg-steel-500/30" : "bg-[var(--background)]"
                  )}
                >
                  <Icon className={clsx("h-4 w-4", isActive ? "text-steel-500" : "text-gray-400")} />
                </div>
                <div>
                  <div className="text-xs font-bold">{agent.name}</div>
                  <div className="text-[10px] text-gray-500">{agent.desc}</div>
                </div>
              </div>
              {i < AGENTS.length - 1 && (
                <div className="absolute -right-2 top-1/2 hidden h-0.5 w-4 -translate-y-1/2 bg-steel-500/30 lg:block" />
              )}
            </div>
          );
        })}
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--border)]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-steel-500 to-green-500 transition-all duration-700 ease-out"
          style={{ width: `${((step + 1) / AGENTS.length) * 100}%` }}
        />
      </div>
    </div>
  );
}
