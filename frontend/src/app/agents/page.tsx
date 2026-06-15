"use client";

import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Cpu,
  GitBranch,
  MessageSquare,
  Network,
  Play,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import AgentPipeline from "@/components/AgentPipeline";
import AnimatedCard from "@/components/AnimatedCard";
import DomainBonusPanel from "@/components/DomainBonusPanel";
import PipelineLiveStatus from "@/components/PipelineLiveStatus";
import ProjectAlignmentPanel from "@/components/ProjectAlignmentPanel";
import { alignmentStats } from "@/lib/projectAlignment";

const FLOW = [
  ["User query", "Equipment code + sensor readings + conversation history"],
  ["Supervisor Agent", "Autonomous ReAct loop — picks next specialist"],
  ["Domain SLM", "Steel fault patterns, C-MAPSS thresholds, feedback weights"],
  ["Document Agent", "RAG: manuals, SOPs, incident reports"],
  ["Operational Agent", "Delay logs, SCADA faults, process defects"],
  ["Predictive Agent", "Isolation Forest anomaly + RUL + risk score"],
  ["RCA Agent", "Probable causes with confidence & evidence"],
  ["Planner Agent", "Prioritized maintenance actions"],
  ["Spare Parts Agent", "Stock levels + procurement recommendations"],
  ["Alert Agent", "Risk-based alert generation"],
  ["Feedback Agent", "Adjust confidence from engineer ratings"],
  ["Synthesizer Agent", "Query-specific final answer for the engineer"],
];

const ML_STACK = [
  { name: "RAG Engine", tech: "Qdrant + hybrid search", note: "Manuals & SOPs", href: "/knowledge" },
  { name: "Anomaly Detection", tech: "Isolation Forest", note: "Real-time sensors", href: "/live" },
  { name: "RUL Prediction", tech: "Gradient Boosting", note: "NASA C-MAPSS", href: "/live" },
  { name: "Risk Engine", tech: "Multi-factor scoring", note: "Criticality + spares", href: "/priority" },
  { name: "Domain SLM", tech: "Steel fault adapter", note: "FR1 bonus merit", href: "#domain" },
  { name: "LLM Layer", tech: "Agentic AI + ML fallback", note: "Chat & diagnosis", href: "/chat" },
  { name: "ISO 10816", tech: "Vibration zones", note: "On sensor ingest", href: "/live" },
  { name: "Monitoring", tech: "60s background loop", note: "WebSocket broadcast", href: "/live" },
];

const DEMO_LINKS = [
  { label: "Run AI Diagnosis", href: "/diagnosis", desc: "Full 11-agent orchestrator" },
  { label: "AI Agentic Chat", href: "/chat", desc: "Multi-turn + spare/SOP answers" },
  { label: "Live monitoring", href: "/live", desc: "FR7 real-time alerts" },
  { label: "Priority queue", href: "/priority", desc: "Plant bottleneck ranking" },
  { label: "Knowledge RAG", href: "/knowledge", desc: "FR2 + TATA AI answer" },
];

export default function AgentsPage() {
  const stats = alignmentStats();

  return (
    <AppShell>
      <div className="space-y-8">
        {/* Page header */}
        <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-steel-500/15">
              <Network className="h-5 w-5 text-steel-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">AI Pipeline & Project Alignment</h1>
              <p className="mt-0.5 text-sm text-[var(--muted)]">
                Agentic orchestration and hackathon requirement coverage
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-status-healthy/30 bg-status-healthy/10 px-4 py-2">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-status-healthy opacity-50" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-status-healthy" />
            </span>
            <div>
              <div className="text-lg font-bold text-status-healthy">{stats.pct}%</div>
              <div className="text-[10px] text-[var(--muted)]">
                {stats.done} of {stats.total} requirements met
              </div>
            </div>
          </div>
        </div>

        {/* Project Alignment */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 border-b border-[var(--border)] pb-2">
            <CheckCircle2 className="h-5 w-5 text-status-healthy" />
            <h2 className="text-base font-bold tracking-tight">Project Alignment</h2>
          </div>
          <ProjectAlignmentPanel />
        </section>

        {/* AI Pipeline */}
        <section className="space-y-5">
          <div className="flex items-center gap-2 border-b border-[var(--border)] pb-2">
            <GitBranch className="h-5 w-5 text-steel-400" />
            <h2 className="text-base font-bold tracking-tight">AI Pipeline</h2>
          </div>

          <PipelineLiveStatus />

          <AnimatedCard glow delay={0}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h3 className="flex items-center gap-2 font-semibold">
                <GitBranch className="h-5 w-5 text-steel-400" />
                Live agent orchestration
              </h3>
              <Link
                href="/chat"
                className="inline-flex items-center gap-1 rounded-lg bg-steel-500/20 px-3 py-1.5 text-xs font-medium text-steel-200 hover:bg-steel-500/30"
              >
                <Play className="h-3 w-3" />
                Try in chat
              </Link>
            </div>
            <AgentPipeline autoPlay />
          </AnimatedCard>

          <div id="domain">
            <DomainBonusPanel />
          </div>

          <AnimatedCard delay={75}>
            <h3 className="mb-3 text-sm font-semibold">Quick demo paths</h3>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {DEMO_LINKS.map((d) => (
                <Link
                  key={d.href}
                  href={d.href}
                  className="group flex items-center justify-between rounded-xl border border-[var(--border)] p-3 transition hover:border-steel-500/40 hover:bg-steel-500/5"
                >
                  <div>
                    <div className="text-sm font-semibold">{d.label}</div>
                    <div className="text-[11px] text-[var(--muted)]">{d.desc}</div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-[var(--muted)] transition group-hover:text-steel-300" />
                </Link>
              ))}
            </div>
          </AnimatedCard>

          <div className="grid gap-5 lg:grid-cols-2">
            <AnimatedCard delay={100}>
              <h3 className="mb-4 flex items-center gap-2 font-semibold">
                <MessageSquare className="h-5 w-5 text-steel-400" />
                End-to-end processing flow
              </h3>
              <div className="space-y-2">
                {FLOW.map(([step, desc], i) => (
                  <div
                    key={step}
                    className="flex gap-3 rounded-lg border border-[var(--border)] p-3 transition hover:border-steel-500/30"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-steel-500/20 text-xs font-bold text-steel-400">
                      {i + 1}
                    </span>
                    <div>
                      <div className="text-sm font-medium">{step}</div>
                      <div className="text-xs text-[var(--muted)]">{desc}</div>
                    </div>
                    {i === 0 && (
                      <span className="ml-auto h-2 w-2 shrink-0 self-center rounded-full bg-status-healthy" />
                    )}
                    {i === FLOW.length - 1 && (
                      <span className="ml-auto h-2 w-2 shrink-0 self-center rounded-full bg-status-healthy shadow-[0_0_6px_rgba(34,197,94,0.5)]" />
                    )}
                  </div>
                ))}
              </div>
            </AnimatedCard>

            <AnimatedCard delay={150}>
              <h3 className="mb-4 flex items-center gap-2 font-semibold">
                <Cpu className="h-5 w-5 text-steel-400" />
                ML + AI stack
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {ML_STACK.map(({ name, tech, note, href }) => (
                  <Link
                    key={name}
                    href={href}
                    className="rounded-lg border border-[var(--border)] bg-[var(--background)]/50 p-3 transition hover:border-steel-500/40"
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-bold text-steel-400">{name}</div>
                      <span className="h-2 w-2 rounded-full bg-status-healthy" />
                    </div>
                    <div className="text-xs text-[var(--foreground)]">{tech}</div>
                    <div className="mt-1 text-[10px] text-[var(--muted)]">{note}</div>
                  </Link>
                ))}
              </div>
            </AnimatedCard>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
