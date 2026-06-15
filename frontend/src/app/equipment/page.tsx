"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  ArrowUpRight,
  Cpu,
  LayoutGrid,
  List,
  Plus,
  Radio,
  Search,
  ShieldCheck,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import SectionHelp from "@/components/SectionHelp";
import AddEquipmentModal from "@/components/AddEquipmentModal";
import AnimatedCard from "@/components/AnimatedCard";
import HealthGauge from "@/components/HealthGauge";
import { useToast } from "@/components/ToastProvider";
import { api, Equipment, EquipmentHealth } from "@/lib/api";
import { classifyFleetHealth, matchesHealthFilter, FleetHealthBucket } from "@/lib/fleetHealth";
import clsx from "clsx";

type HealthFilter = "all" | FleetHealthBucket;

const HEALTH_FILTERS: HealthFilter[] = ["all", "healthy", "warning", "critical"];

const FILTER_LABELS: Record<HealthFilter, string> = {
  all: "All assets",
  healthy: "Healthy",
  warning: "Warning",
  critical: "Critical",
};

const HEALTH_FILTER_STYLES: Record<"all" | "healthy" | "warning" | "critical", { active: string; idle: string }> = {
  all: {
    active: "bg-[var(--accent)] text-[var(--accent-foreground)]",
    idle: "border border-[var(--border)] text-[var(--muted)]",
  },
  healthy: {
    active: "bg-status-healthy text-[#052e14] font-semibold",
    idle: "border border-status-healthy/40 text-status-healthy",
  },
  warning: {
    active: "bg-status-warning text-[#1a1400] font-semibold",
    idle: "border border-status-warning/40 text-status-warning",
  },
  critical: {
    active: "bg-status-critical text-white font-semibold",
    idle: "border border-status-critical/40 text-status-critical",
  },
};

function statusBadgeClass(status: string): string {
  if (status === "CRITICAL") return "badge-critical rounded border px-2 py-0.5 text-[10px] font-bold";
  if (status === "DEGRADED") return "badge-degraded rounded border px-2 py-0.5 text-[10px] font-bold";
  return "badge-operational rounded border px-2 py-0.5 text-[10px] font-bold";
}

const RISK_ICON: Record<string, string> = {
  low: "text-risk-low",
  medium: "text-risk-medium",
  high: "text-risk-high",
  critical: "text-risk-critical",
};

function zoneFor(eq: Equipment): string {
  return eq.location || "Plant";
}

export default function EquipmentFleetPage() {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [health, setHealth] = useState<EquipmentHealth[]>([]);
  const [filter, setFilter] = useState("");
  const [zone, setZone] = useState("all");
  const [healthFilter, setHealthFilter] = useState<HealthFilter>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const resultsRef = useRef<HTMLDivElement>(null);

  const applyHealthFilter = useCallback(
    (next: HealthFilter) => {
      setHealthFilter(next);
      const params = new URLSearchParams(searchParams.toString());
      if (next === "all") {
        params.delete("filter");
      } else {
        params.set("filter", next);
      }
      const qs = params.toString();
      router.replace(qs ? `/equipment?${qs}` : "/equipment", { scroll: false });
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
    },
    [router, searchParams]
  );

  const loadFleet = useCallback(async () => {
    const [eq, h] = await Promise.all([api.getEquipment(), api.getHealth()]);
    setEquipment(eq);
    setHealth(h);
    setLoading(false);
  }, []);

  useEffect(() => {
    const f = searchParams.get("filter");
    if (f === "healthy" || f === "warning" || f === "critical") {
      setHealthFilter(f);
    } else {
      setHealthFilter("all");
    }
  }, [searchParams]);

  useEffect(() => {
    loadFleet();
  }, [loadFleet]);

  const healthMap = Object.fromEntries(health.map((h) => [h.equipment_code, h]));
  const zones = ["all", ...Array.from(new Set(equipment.map(zoneFor)))];

  const filtered = equipment
    .filter((e) => {
      const q = filter.toLowerCase();
      const matchQ =
        !q ||
        e.equipment_code.toLowerCase().includes(q) ||
        e.name.toLowerCase().includes(q) ||
        e.equipment_type.toLowerCase().includes(q);
      const matchZ = zone === "all" || zoneFor(e) === zone;
      return matchQ && matchZ && matchesHealthFilter(healthMap[e.equipment_code], healthFilter);
    })
    .sort((a, b) => {
      const ha = healthMap[a.equipment_code]?.health_score ?? 100;
      const hb = healthMap[b.equipment_code]?.health_score ?? 100;
      return ha - hb;
    });

  const healthyCount = equipment.filter(
    (e) => classifyFleetHealth(healthMap[e.equipment_code]) === "healthy"
  ).length;
  const warningCount = equipment.filter(
    (e) => classifyFleetHealth(healthMap[e.equipment_code]) === "warning"
  ).length;
  const criticalCount = equipment.filter(
    (e) => classifyFleetHealth(healthMap[e.equipment_code]) === "critical"
  ).length;

  const onEquipmentCreated = (created: Equipment) => {
    toast("success", "Equipment added", `${created.equipment_code} registered with baseline sensors`);
    loadFleet();
    router.push(`/equipment/${created.equipment_code}`);
  };

  return (
    <AppShell>
      <div className="equipment-page space-y-6">
        <section className="equipment-fleet-hero">
          <div className="equipment-fleet-hero-mesh" aria-hidden />
          <div className="relative z-10 p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="equipment-fleet-eyebrow mb-2 flex items-center gap-2">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Fleet management
                </p>
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Equipment Fleet</h1>
                <p className="mt-2 max-w-xl text-sm text-[var(--muted)]">
                  {equipment.length} assets · ML health monitoring · sorted by lowest health first
                </p>
                <p className="mt-2 text-xs text-[var(--muted)]">
                  Demo data: NASA C-MAPSS mapped to steel assets. Use{" "}
                  <strong className="text-[var(--foreground)]">Simulate cycle</strong> on Overview to
                  advance sensors — values refresh every 10s.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-[var(--muted)]" />
                  <input
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder="Search fleet..."
                    className="rounded-xl border border-[var(--border)] bg-[var(--background)] py-2 pl-9 pr-3 text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddModal(true)}
                  className="equipment-add-btn flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium"
                >
                  <Plus className="h-4 w-4" />
                  Add equipment
                </button>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <button
                type="button"
                onClick={() => applyHealthFilter("all")}
                className={clsx(
                  "equipment-fleet-stat equipment-fleet-stat--clickable text-left",
                  healthFilter === "all" && "equipment-fleet-stat--active"
                )}
              >
                <span className="equipment-fleet-stat-value">{equipment.length}</span>
                <span className="equipment-fleet-stat-label">Total assets</span>
              </button>
              <button
                type="button"
                onClick={() => applyHealthFilter("healthy")}
                className={clsx(
                  "equipment-fleet-stat equipment-fleet-stat--green equipment-fleet-stat--clickable text-left",
                  healthFilter === "healthy" && "equipment-fleet-stat--active"
                )}
              >
                <span className="equipment-fleet-stat-value">{healthyCount}</span>
                <span className="equipment-fleet-stat-label">Healthy · click to view</span>
              </button>
              <button
                type="button"
                onClick={() => applyHealthFilter("warning")}
                className={clsx(
                  "equipment-fleet-stat equipment-fleet-stat--amber equipment-fleet-stat--clickable text-left",
                  healthFilter === "warning" && "equipment-fleet-stat--active"
                )}
              >
                <span className="equipment-fleet-stat-value">{warningCount}</span>
                <span className="equipment-fleet-stat-label">Warning · click to view</span>
              </button>
              <button
                type="button"
                onClick={() => applyHealthFilter("critical")}
                className={clsx(
                  "equipment-fleet-stat equipment-fleet-stat--red equipment-fleet-stat--clickable text-left",
                  healthFilter === "critical" && "equipment-fleet-stat--active"
                )}
              >
                <span className="equipment-fleet-stat-value">{criticalCount}</span>
                <span className="equipment-fleet-stat-label">Critical · click to view</span>
              </button>
            </div>
          </div>
        </section>

        <SectionHelp
          icon={Cpu}
          title="Fleet registry"
          subtitle="Search, filter by health, add equipment, open detail pages"
          help="All plant assets with ML health scores from the latest scan. Click Healthy/Warning/Critical stats to filter. Grid or list view — each card links to full sensor history, alerts, and maintenance actions."
        />

        <AnimatedCard glow delay={0}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {HEALTH_FILTERS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => applyHealthFilter(f)}
                  className={clsx(
                    "rounded-full px-3 py-1 text-xs capitalize transition-all",
                    healthFilter === f ? HEALTH_FILTER_STYLES[f].active : HEALTH_FILTER_STYLES[f].idle
                  )}
                >
                  {f}
                  {f !== "all" && (
                    <span className="ml-1 opacity-80">
                      (
                      {f === "healthy"
                        ? healthyCount
                        : f === "warning"
                          ? warningCount
                          : criticalCount}
                      )
                    </span>
                  )}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex rounded-lg border border-[var(--border)] p-0.5">
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  className={clsx(
                    "rounded-md p-1.5",
                    viewMode === "grid" ? "bg-[var(--btn-bg)] text-[var(--btn-fg)]" : "text-[var(--muted)]"
                  )}
                  aria-label="Grid view"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className={clsx(
                    "rounded-md p-1.5",
                    viewMode === "list" ? "bg-[var(--btn-bg)] text-[var(--btn-fg)]" : "text-[var(--muted)]"
                  )}
                  aria-label="List view"
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {zones.map((z) => (
              <button
                key={z}
                onClick={() => setZone(z)}
                className={clsx(
                  "rounded-full px-3 py-1 text-xs capitalize transition-all",
                  zone === z
                    ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                    : "border border-[var(--border)] text-[var(--muted)]"
                )}
              >
                {z}{" "}
                {z !== "all" && `(${equipment.filter((e) => zoneFor(e) === z).length})`}
              </button>
            ))}
          </div>
        </AnimatedCard>

        <div ref={resultsRef}>
          {!loading && (
            <p className="mb-3 text-sm text-[var(--muted)]">
              {healthFilter === "all" ? (
                <>Showing all <strong className="text-[var(--foreground)]">{filtered.length}</strong> assets</>
              ) : (
                <>
                  Viewing <strong className="text-[var(--foreground)]">{FILTER_LABELS[healthFilter]}</strong> —{" "}
                  <strong className="text-[var(--foreground)]">{filtered.length}</strong> machine
                  {filtered.length === 1 ? "" : "s"}
                  {filtered.length === 0 && (
                    <button
                      type="button"
                      onClick={() => applyHealthFilter("all")}
                      className="ml-2 text-[var(--status-healthy)] hover:underline"
                    >
                      Show all
                    </button>
                  )}
                </>
              )}
            </p>
          )}

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-44 rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <AnimatedCard className="text-center">
            <Cpu className="mx-auto h-10 w-10 text-[var(--muted)]" />
            <p className="mt-3 font-medium">
              No {healthFilter === "all" ? "" : `${healthFilter} `}equipment in this view
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {healthFilter !== "all"
                ? `No machines are currently classified as ${healthFilter}. Try another filter.`
                : "Try a different search or add a new asset to the fleet."}
            </p>
            {healthFilter !== "all" && (
              <button
                type="button"
                onClick={() => applyHealthFilter("all")}
                className="equipment-add-btn mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium"
              >
                Show all assets
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="mt-3 inline-flex items-center gap-2 rounded-xl border border-[var(--border)] px-4 py-2 text-sm"
            >
              <Plus className="h-4 w-4" />
              Add equipment
            </button>
          </AnimatedCard>
        ) : viewMode === "grid" ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((eq, i) => {
              const h = healthMap[eq.equipment_code];
              const risk = h?.risk_level || "medium";
              const status =
                risk === "critical" || (h && h.health_score < 40)
                  ? "CRITICAL"
                  : risk === "high" || (h && h.health_score < 60)
                    ? "DEGRADED"
                    : "OPERATIONAL";
              const riskKey = ["low", "medium", "high", "critical"].includes(risk) ? risk : "medium";

              return (
                <div
                  key={eq.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => router.push(`/equipment/${eq.equipment_code}`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") router.push(`/equipment/${eq.equipment_code}`);
                  }}
                  className="animate-scale-in block cursor-pointer"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <AnimatedCard hover className={clsx("eq-risk-card-" + riskKey, "h-full transition-all")}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Cpu className={clsx("h-5 w-5", RISK_ICON[riskKey] ?? "text-steel-500")} />
                        <div>
                          <div className="font-semibold">{eq.name}</div>
                          <div className="text-xs text-[var(--muted)]">
                            {zoneFor(eq)} · {eq.equipment_type.replace(/_/g, " ")}
                          </div>
                        </div>
                      </div>
                      <span className={statusBadgeClass(status)}>{status}</span>
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                      <HealthGauge score={h?.health_score ?? 75} size={72} riskLevel={risk} />
                      <div className="text-right text-xs text-[var(--muted)]">
                        <div className="font-mono text-[11px]">{eq.equipment_code}</div>
                        <div className={clsx("mt-1 capitalize font-semibold", `risk-label-${riskKey}`)}>
                          Risk: {risk}
                        </div>
                        {h?.rul_cycles != null && <div>RUL: {h.rul_cycles}c</div>}
                        <div className="mt-1 capitalize">Crit: {eq.criticality}</div>
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2 border-t border-[var(--border)] pt-3">
                      <span className="equipment-card-action">
                        <Activity className="h-3 w-3" />
                        View details
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push("/live");
                        }}
                        className="equipment-card-action"
                      >
                        <Radio className="h-3 w-3" />
                        Live monitor
                      </button>
                    </div>
                  </AnimatedCard>
                </div>
              );
            })}
          </div>
        ) : (
          <AnimatedCard delay={100}>
            <div className="space-y-2">
              {filtered.map((eq, i) => {
                const h = healthMap[eq.equipment_code];
                const risk = h?.risk_level || "medium";
                const riskKey = ["low", "medium", "high", "critical"].includes(risk) ? risk : "medium";
                return (
                  <Link
                    key={eq.id}
                    href={`/equipment/${eq.equipment_code}`}
                    className={clsx(
                      "equipment-list-row animate-fade-in-up flex flex-wrap items-center gap-4 rounded-xl border p-3 transition-all hover:border-[var(--accent)]/40",
                      `eq-risk-card-${riskKey}`
                    )}
                    style={{ animationDelay: `${i * 40}ms` }}
                  >
                    <HealthGauge score={h?.health_score ?? 75} size={48} riskLevel={risk} />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{eq.name}</p>
                      <p className="text-xs text-[var(--muted)]">
                        {eq.equipment_code} · {zoneFor(eq)} · {eq.equipment_type.replace(/_/g, " ")}
                      </p>
                    </div>
                    <div className="text-right text-xs">
                      <p className={clsx("font-bold capitalize", `risk-${riskKey}`)}>{risk} risk</p>
                      {h?.rul_cycles != null && (
                        <p className="text-[var(--muted)]">RUL {h.rul_cycles}c</p>
                      )}
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-[var(--muted)]" />
                  </Link>
                );
              })}
            </div>
          </AnimatedCard>
        )}
        </div>
      </div>

      {showAddModal && (
        <AddEquipmentModal onClose={() => setShowAddModal(false)} onCreated={onEquipmentCreated} />
      )}
    </AppShell>
  );
}
