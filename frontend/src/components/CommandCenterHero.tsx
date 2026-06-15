"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  Bot,
  ChevronRight,
  Map,
  Microscope,
  Play,
  Radio,
  Settings,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { CommandCenter, FleetSummary } from "@/lib/api";

const QUICK_ACTIONS = [
  {
    href: "/live",
    label: "Live Monitor",
    desc: "Real-time sensors & 3D plant",
    icon: Radio,
    accent: "overview-action--live",
    featured: true,
  },
  {
    href: "/chat",
    label: "AI Agentic Assistant",
    desc: "Multi-agent diagnosis & repair plans",
    icon: Bot,
    accent: "overview-action--ai",
    featured: true,
  },
  {
    href: "/equipment",
    label: "Equipment Fleet",
    desc: "Health scores & asset details",
    icon: Settings,
    accent: "overview-action--fleet",
    featured: false,
  },
  {
    href: "/diagnosis",
    label: "AI Diagnosis",
    desc: "ML prediction & root cause",
    icon: Microscope,
    accent: "overview-action--diag",
    featured: false,
  },
] as const;

interface CommandCenterHeroProps {
  userName?: string;
  lastUpdated: Date | null;
  wsConnected: boolean;
  fleetSummary: FleetSummary | null;
  commandCenter: CommandCenter | null;
  guidedRunning: boolean;
  demoRunning: boolean;
  simulating: boolean;
  onGuidedDemo: () => void;
  onFailureDemo: () => void;
  onSimulate: () => void;
  onScrollAlerts: () => void;
}

export default function CommandCenterHero({
  userName,
  lastUpdated,
  wsConnected,
  fleetSummary,
  commandCenter,
  guidedRunning,
  demoRunning,
  simulating,
  onGuidedDemo,
  onFailureDemo,
  onSimulate,
  onScrollAlerts,
}: CommandCenterHeroProps) {
  const firstName = userName?.split(" ")[0] || "Engineer";
  const bottleneck = commandCenter?.plant_bottleneck;
  const healthPct = fleetSummary
    ? Math.round((fleetSummary.healthy_assets / Math.max(fleetSummary.total_assets, 1)) * 100)
    : null;

  return (
    <section className="overview-hero">
      <div className="overview-hero-grid" aria-hidden />
      <div className="overview-hero-mesh" aria-hidden />
      <div className="overview-hero-shine" aria-hidden />

      <div className="relative z-10 p-5 sm:p-7 lg:p-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-start">
          <div>
            <p className="overview-hero-eyebrow mb-3 flex items-center gap-2">
              <span className="overview-hero-eyebrow-dot" />
              Tata Steel · AI Command Center
            </p>
            <h1 className="overview-hero-title text-3xl font-bold tracking-tight sm:text-4xl lg:text-[2.65rem] lg:leading-tight">
              Welcome, <span className="overview-hero-name">{firstName}</span>
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-[var(--muted)] sm:text-base">
              Monitor fleet health, triage alerts, and run AI-assisted maintenance — all from one
              command center.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              <span className={`overview-live-pill ${wsConnected ? "overview-live-pill--on" : ""}`}>
                <Radio className="h-3 w-3" />
                {wsConnected ? "Live feed" : "Polling 10s"}
              </span>
              {lastUpdated && (
                <span className="overview-meta-chip">Updated {lastUpdated.toLocaleTimeString()}</span>
              )}
              {fleetSummary && (
                <span className="overview-meta-chip">
                  {fleetSummary.total_assets} assets · C-MAPSS fleet
                </span>
              )}
            </div>
          </div>

          {fleetSummary && (
            <div className="overview-hero-kpi-panel">
              <div className="overview-hero-kpi-header">
                <ShieldCheck className="h-4 w-4 text-[var(--status-healthy)]" />
                <span>Plant snapshot</span>
              </div>
              <div className="overview-hero-kpi-body">
                {healthPct != null && (
                  <div className="overview-health-ring" aria-hidden>
                    <svg viewBox="0 0 72 72" className="h-[4.5rem] w-[4.5rem]">
                      <circle
                        cx="36"
                        cy="36"
                        r="30"
                        fill="none"
                        stroke="var(--border)"
                        strokeWidth="6"
                      />
                      <circle
                        cx="36"
                        cy="36"
                        r="30"
                        fill="none"
                        stroke="var(--status-healthy)"
                        strokeWidth="6"
                        strokeLinecap="round"
                        strokeDasharray={`${(healthPct / 100) * 188.5} 188.5`}
                        transform="rotate(-90 36 36)"
                      />
                    </svg>
                    <span className="overview-health-ring-value">{healthPct}%</span>
                  </div>
                )}
                <div className="overview-hero-kpi-grid">
                  <div className="overview-hero-kpi">
                    <span className="overview-hero-kpi-value">{fleetSummary.total_assets}</span>
                    <span className="overview-hero-kpi-label">Assets</span>
                  </div>
                  <div className="overview-hero-kpi overview-hero-kpi--green">
                    <span className="overview-hero-kpi-value">{fleetSummary.healthy_assets}</span>
                    <span className="overview-hero-kpi-label">Healthy</span>
                  </div>
                  <div className="overview-hero-kpi overview-hero-kpi--amber">
                    <span className="overview-hero-kpi-value">{fleetSummary.warning_assets}</span>
                    <span className="overview-hero-kpi-label">Warning</span>
                  </div>
                  <button
                    type="button"
                    onClick={onScrollAlerts}
                    className="overview-hero-kpi overview-hero-kpi--red overview-hero-kpi--clickable"
                  >
                    <span className="overview-hero-kpi-value">{fleetSummary.active_alerts}</span>
                    <span className="overview-hero-kpi-label">Alerts</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {bottleneck && (
          <Link
            href={`/equipment/${bottleneck.equipment_code}`}
            className="overview-bottleneck mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl px-5 py-4"
          >
            <div className="flex items-start gap-3">
              <div className="overview-bottleneck-icon">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--status-high)]">
                  Attention required
                </p>
                <p className="mt-0.5 text-sm font-semibold">
                  {bottleneck.equipment_code} — {bottleneck.equipment_name}
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">{bottleneck.recommended_action}</p>
              </div>
            </div>
            <div className="overview-bottleneck-score text-right">
              <p className={`text-3xl font-bold tabular-nums risk-${bottleneck.risk_level}`}>
                {bottleneck.health_score.toFixed(0)}%
              </p>
              <p className="text-[10px] uppercase tracking-wider text-[var(--muted)]">health</p>
            </div>
            <ArrowUpRight className="overview-bottleneck-arrow h-4 w-4" />
          </Link>
        )}

        <div className="mt-7">
          <p className="overview-hero-actions-label mb-3 flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5" />
            Quick actions
          </p>
          <div className="overview-action-grid">
            {QUICK_ACTIONS.map(({ href, label, desc, icon: Icon, accent, featured }) => (
              <Link
                key={href}
                href={href}
                className={`overview-action-card ${accent} ${featured ? "overview-action-card--featured" : ""}`}
              >
                <div className="overview-action-icon">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{label}</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-[var(--muted)]">{desc}</p>
                </div>
                <ChevronRight className="overview-action-chevron h-4 w-4 shrink-0" />
              </Link>
            ))}
          </div>
        </div>

        <div className="overview-demo-strip mt-6 rounded-2xl px-4 py-3.5 sm:px-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="overview-demo-label">Demo tools</span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onGuidedDemo}
                disabled={guidedRunning || demoRunning}
                className="overview-demo-btn flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-medium disabled:opacity-50"
              >
                <Map className="h-3.5 w-3.5" />
                {guidedRunning ? "Running…" : "Guided demo"}
              </button>
              <button
                type="button"
                onClick={onFailureDemo}
                disabled={demoRunning || guidedRunning}
                className="overview-demo-btn overview-demo-btn--warn flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-medium disabled:opacity-50"
              >
                <Zap className="h-3.5 w-3.5" />
                {demoRunning ? "Running…" : "Failure demo"}
              </button>
              <button
                type="button"
                onClick={onSimulate}
                disabled={simulating}
                className="overview-demo-btn overview-demo-btn--primary flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-medium disabled:opacity-50"
              >
                <Play className="h-3.5 w-3.5" />
                {simulating ? "Simulating…" : "Simulate cycle"}
              </button>
            </div>
            <p className="overview-demo-hint ml-auto hidden text-[11px] text-[var(--muted)] lg:block">
              Advance sensor data & trigger alerts for live demos
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
