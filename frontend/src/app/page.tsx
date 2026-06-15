"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  Gauge,
  Map,
  TrendingDown,
} from "lucide-react";
import AskAIButton from "@/components/AskAIButton";
import CommandCenterHero from "@/components/CommandCenterHero";
import SectionHelp from "@/components/SectionHelp";
import AppShell from "@/components/AppShell";
import AnimatedCard from "@/components/AnimatedCard";
import PlantMap from "@/components/PlantMap";
import SensorChart from "@/components/SensorChart";
import ResolveAlertModal from "@/components/ResolveAlertModal";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useToast } from "@/components/ToastProvider";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, Alert, CommandCenter, EquipmentHealth, FleetSummary } from "@/lib/api";
import {
  SENSOR_METRICS,
  SensorMetricKey,
  formatSensorValue,
} from "@/lib/units";
import { normalizeSensorHistory } from "@/lib/sensorNormalize";
import { RISK_COLORS, alertLevelClass } from "@/lib/design-tokens";
import { getUser } from "@/lib/auth";

function HealthBarTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value?: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip-label">{label}</p>
      <p className="chart-tooltip-item">Health: {Number(payload[0].value).toFixed(1)}%</p>
    </div>
  );
}

export default function Dashboard() {
  const [health, setHealth] = useState<EquipmentHealth[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [sensorHistory, setSensorHistory] = useState<Array<Record<string, number | undefined>>>([]);
  const [selectedEquipment, setSelectedEquipment] = useState("RM-MOTOR-03");
  const [selectedMetric, setSelectedMetric] = useState<SensorMetricKey>("temperature");
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [commandCenter, setCommandCenter] = useState<CommandCenter | null>(null);
  const [fleetSummary, setFleetSummary] = useState<FleetSummary | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [demoRunning, setDemoRunning] = useState(false);
  const [guidedRunning, setGuidedRunning] = useState(false);
  const [chartKey, setChartKey] = useState(0);
  const [alertFilter, setAlertFilter] = useState<"all" | "critical" | "unacknowledged">("all");
  const [resolveTarget, setResolveTarget] = useState<Alert | null>(null);
  const [userName, setUserName] = useState<string | undefined>();
  const prevAlertCount = useRef(0);
  const alertsSectionRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const router = useRouter();

  const loadData = useCallback(async () => {
    try {
      const [h, a, sensors, cc, fs] = await Promise.all([
        api.getHealth(),
        api.getAlerts(),
        api.getSensorHistory(selectedEquipment),
        api.getCommandCenter(),
        api.getFleetSummary(),
      ]);
      setHealth(h);
      setAlerts(a);
      const rawPoints = sensors.map((s) => ({
        cycle: s.cycle ?? 0,
        temperature: s.temperature,
        vibration: s.vibration,
        pressure: s.pressure,
        motor_current: s.motor_current,
        health: s.health_indicator != null ? s.health_indicator * 100 : undefined,
      }));
      const source = sensors[0]?.data_source ?? "plant_sensors";
      const { data: normData, source: normSource } = normalizeSensorHistory(rawPoints, source);
      setSensorHistory(normData);
      setCommandCenter(cc);
      setFleetSummary(fs);
      setChartKey((k) => k + 1);
      setLastUpdated(new Date());
      setError("");

      if (fs.active_alerts > prevAlertCount.current && prevAlertCount.current > 0) {
        const latest = a[0];
        if (latest) toast("warning", latest.title, latest.message);
      }
      prevAlertCount.current = fs.active_alerts;
    } catch {
      setError(
        "Backend busy or waking up — wait 30 seconds and refresh. Avoid running Chat and Diagnosis at the same time on free tier."
      );
    }
  }, [selectedEquipment, toast]);

  const { connected: wsConnected } = useWebSocket(
    (data) => {
      if (data.health) {
        setHealth((prev) => {
          if (prev.length === 0) return prev;
          const idByCode = Object.fromEntries(prev.map((h) => [h.equipment_code, h.equipment_id]));
          const nameByCode = Object.fromEntries(prev.map((h) => [h.equipment_code, h.equipment_name]));
          return data.health!.map((h) => ({
            equipment_id: idByCode[h.equipment_code] ?? prev.find((p) => p.equipment_code === h.equipment_code)?.equipment_id ?? 0,
            equipment_code: h.equipment_code,
            equipment_name: nameByCode[h.equipment_code] ?? h.equipment_code,
            health_score: h.health_score,
            risk_level: h.risk_level,
            rul_cycles: h.rul_cycles,
          }));
        });
        setChartKey((k) => k + 1);
      }
      if (data.alerts?.length) {
        toast("warning", "New alert", data.alerts[0].title);
        loadData();
      }
    },
    () => loadData()
  );

  useEffect(() => {
    setUserName(getUser()?.full_name);
    loadData();
    const interval = setInterval(loadData, error ? 30000 : 10000);
    return () => clearInterval(interval);
  }, [loadData, error]);

  const simulateTick = async () => {
    const eq = health.find((h) => h.equipment_code === selectedEquipment);
    if (!eq?.equipment_id) {
      toast("error", "Simulate unavailable", "Reload the page — equipment IDs not loaded.");
      await loadData();
      return;
    }
    setSimulating(true);
    try {
      const res = await api.simulateSensorTick(eq.equipment_id);
      toast("success", "Sensor cycle simulated", `${selectedEquipment} → cycle ${res.cycle}`);
      await loadData();
    } catch (e) {
      toast("error", "Simulate failed", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSimulating(false);
    }
  };

  const runFailureDemo = async () => {
    const target = commandCenter?.plant_bottleneck?.equipment_code ?? selectedEquipment;
    const eq = health.find((h) => h.equipment_code === target);
    if (!eq?.equipment_id) {
      toast("error", "Failure demo unavailable", "Reload the page — equipment IDs not loaded.");
      await loadData();
      return;
    }
    setSelectedEquipment(target);
    setDemoRunning(true);
    try {
      for (let i = 0; i < 5; i++) {
        await api.simulateSensorTick(eq.equipment_id);
        await new Promise((r) => setTimeout(r, 400));
      }
      await loadData();
      toast("warning", "Failure demo complete", `${target}: 5 degradation cycles simulated — check alerts`);
      scrollToAlerts("critical");
    } catch (e) {
      toast("error", "Failure demo failed", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setDemoRunning(false);
    }
  };

  const runGuidedDemo = async () => {
    const target = commandCenter?.plant_bottleneck?.equipment_code ?? "RM-MOTOR-03";
    const eq = health.find((h) => h.equipment_code === target);
    if (!eq?.equipment_id) {
      toast("error", "Guided demo unavailable", "Equipment data not loaded yet");
      return;
    }
    setGuidedRunning(true);
    setSelectedEquipment(target);
    try {
      for (let i = 0; i < 5; i++) {
        await api.simulateSensorTick(eq.equipment_id);
        await new Promise((r) => setTimeout(r, 350));
      }
      await loadData();
      const question = encodeURIComponent(
        `What's causing the vibration spike on ${target}? Give root cause, actions, and spare parts.`
      );
      router.push(`/chat?equipment=${encodeURIComponent(target)}&question=${question}&guided=1`);
    } finally {
      setGuidedRunning(false);
    }
  };

  const equipmentCodeForAlert = (equipmentId?: number) =>
    health.find((h) => h.equipment_id === equipmentId)?.equipment_code;

  const scrollToAlerts = (filter: "all" | "critical" | "unacknowledged" = "all") => {
    setAlertFilter(filter);
    setTimeout(() => {
      alertsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  const filteredAlerts = alerts.filter((a) => {
    if (a.is_resolved) return false;
    if (alertFilter === "critical") return a.alert_level === "critical" || a.alert_level === "high";
    if (alertFilter === "unacknowledged") return !a.is_acknowledged;
    return true;
  });

  const chartData = health.map((h) => ({
    name: h.equipment_code.split("-").slice(-2).join("-"),
    health: h.health_score,
    risk: h.risk_level,
  }));
  const latest = sensorHistory[sensorHistory.length - 1];
  const avgHealth =
    health.length > 0
      ? health.reduce((sum, h) => sum + h.health_score, 0) / health.length
      : null;
  const unacknowledgedCount = alerts.filter((a) => !a.is_resolved && !a.is_acknowledged).length;
  const criticalCount = alerts.filter(
    (a) => !a.is_resolved && (a.alert_level === "critical" || a.alert_level === "high")
  ).length;
  const ALERTS_PREVIEW_LIMIT = 8;
  const visibleAlerts = filteredAlerts.slice(0, ALERTS_PREVIEW_LIMIT);
  const topPriority = commandCenter?.equipment_priority?.[0];

  return (
    <AppShell>
      <div className="overview-page w-full space-y-6">
        <CommandCenterHero
          userName={userName}
          lastUpdated={lastUpdated}
          wsConnected={wsConnected}
          fleetSummary={fleetSummary}
          commandCenter={commandCenter}
          guidedRunning={guidedRunning}
          demoRunning={demoRunning}
          simulating={simulating}
          onGuidedDemo={runGuidedDemo}
          onFailureDemo={runFailureDemo}
          onSimulate={simulateTick}
          onScrollAlerts={() => scrollToAlerts("unacknowledged")}
        />

        {error && (
          <div className="rounded-lg border border-[var(--status-critical)]/40 bg-[color-mix(in_srgb,var(--status-critical)_8%,transparent)] p-3 text-sm">
            {error}
          </div>
        )}

        {fleetSummary && (
          <div className="overview-insights-strip grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="overview-insight-card">
              <p className="overview-insight-label">Avg fleet health</p>
              <p className="overview-insight-value text-[var(--status-healthy)]">
                {avgHealth != null ? `${avgHealth.toFixed(1)}%` : "—"}
              </p>
              <p className="overview-insight-hint">ML-scored across all assets</p>
            </div>
            <div className="overview-insight-card">
              <p className="overview-insight-label">Critical / high alerts</p>
              <p className="overview-insight-value text-[var(--status-critical)]">{criticalCount}</p>
              <button
                type="button"
                onClick={() => scrollToAlerts("critical")}
                className="overview-insight-link"
              >
                Filter critical →
              </button>
            </div>
            <div className="overview-insight-card">
              <p className="overview-insight-label">Unacknowledged</p>
              <p className="overview-insight-value text-[var(--status-warning)]">
                {unacknowledgedCount}
              </p>
              <button
                type="button"
                onClick={() => scrollToAlerts("unacknowledged")}
                className="overview-insight-link"
              >
                Review now →
              </button>
            </div>
            {topPriority ? (
              <Link
                href={`/equipment/${topPriority.equipment_code}`}
                className="overview-insight-card overview-insight-card--link"
              >
                <p className="overview-insight-label flex items-center gap-1">
                  <TrendingDown className="h-3 w-3" />
                  Top priority
                </p>
                <p className="overview-insight-value text-sm">{topPriority.equipment_code}</p>
                <p className="overview-insight-hint line-clamp-1">
                  {topPriority.health_score.toFixed(0)}% · {topPriority.recommended_action}
                </p>
              </Link>
            ) : (
              <div className="overview-insight-card">
                <p className="overview-insight-label">Critical assets</p>
                <p className="overview-insight-value">{fleetSummary.critical_assets}</p>
                <p className="overview-insight-hint">Requires immediate attention</p>
              </div>
            )}
          </div>
        )}

        <div>
          <SectionHelp
            icon={Map}
            title="Plant floor & alerts"
            subtitle="Click equipment on the map to update live sensor charts below"
            help="Interactive plant map shows all assets by zone with health coloring. Active alerts panel lists unresolved issues from the ML monitoring scan — filter by critical or unacknowledged, then ask AI or resolve inline."
          />
          <div className="grid w-full gap-6 xl:grid-cols-5 xl:items-start">
          <AnimatedCard className="xl:col-span-3" delay={100} glow tilt3d>
            <PlantMap health={health} selected={selectedEquipment} onSelect={setSelectedEquipment} />
          </AnimatedCard>

          <AnimatedCard className="xl:col-span-2" delay={200} glow>
            <div ref={alertsSectionRef} className="mb-3 flex flex-wrap items-center gap-2">
              <AlertTriangle className="h-4 w-4 animate-pulse-soft text-[var(--status-critical)]" />
              <h2 className="font-semibold">Active Alerts</h2>
              <span className="overview-alerts-count rounded-full px-2 py-0.5 text-xs">
                {fleetSummary?.active_alerts ?? filteredAlerts.length}
              </span>
              {fleetSummary && filteredAlerts.length < fleetSummary.active_alerts && (
                <span className="text-[10px] text-[var(--muted)]">
                  (showing {filteredAlerts.length})
                </span>
              )}
              <div className="ml-auto flex gap-1">
                {(["all", "critical", "unacknowledged"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setAlertFilter(f)}
                    className={`overview-filter-pill capitalize ${
                      alertFilter === f ? "overview-filter-pill--active" : ""
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
            <div className="max-h-[min(28rem,60vh)] space-y-2 overflow-y-auto pr-1 overview-alerts-scroll">
              {filteredAlerts.length === 0 ? (
                <div className="overview-alerts-empty rounded-xl border border-dashed border-[var(--border)] p-6 text-center">
                  <p className="text-sm font-medium">All clear</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">No active alerts for this filter.</p>
                </div>
              ) : (
                visibleAlerts.map((alert, i) => (
                  <div
                    key={alert.id}
                    className={`alert-card alert-card-${alertLevelClass(alert.alert_level)} animate-fade-in-up rounded-lg border p-3`}
                    style={{ animationDelay: `${i * 40}ms` }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`alert-level-badge alert-level-badge-${alertLevelClass(alert.alert_level)}`}>
                        {alert.alert_level}
                      </span>
                      <span className="text-[10px] text-[var(--muted)]">
                        {new Date(alert.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="alert-title mt-1 text-sm font-semibold">{alert.title}</div>
                    <div className="mt-1 line-clamp-2 text-xs text-[var(--foreground)]/80">{alert.message}</div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <AskAIButton
                        href={`/chat?equipment=${encodeURIComponent(
                          equipmentCodeForAlert(alert.equipment_id) ?? selectedEquipment
                        )}&question=${encodeURIComponent("Diagnose this alert")}`}
                      />
                      {!alert.is_acknowledged && (
                        <button
                          onClick={() =>
                            api.acknowledgeAlert(alert.id).then(() => {
                              toast("success", "Alert acknowledged");
                              loadData();
                            })
                          }
                          className="text-xs text-[var(--status-healthy)] hover:underline"
                        >
                          Acknowledge
                        </button>
                      )}
                      {!alert.is_resolved && (
                        <button
                          onClick={() => setResolveTarget(alert)}
                          className="text-xs text-[var(--accent)] hover:underline"
                        >
                          Resolve
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
            {filteredAlerts.length > ALERTS_PREVIEW_LIMIT && (
              <p className="mt-2 text-center text-[10px] text-[var(--muted)]">
                Showing {ALERTS_PREVIEW_LIMIT} of {filteredAlerts.length} — use filters or{" "}
                <Link href="/logbook" className="text-[var(--status-healthy)] hover:underline">
                  Logbook
                </Link>{" "}
                for full history
              </p>
            )}
          </AnimatedCard>
          </div>
        </div>

        <div>
          <SectionHelp
            icon={Activity}
            title="Health trends & live sensors"
            subtitle="Bar chart from ML health · sensors advance with Simulate cycle"
            help="Equipment Health bar chart ranks fleet by ML health score. Sensor chart shows the last readings for the equipment selected on the plant map — use Simulate cycle on this page to advance sensor data in the database."
          />
          <div className="grid w-full gap-6 lg:grid-cols-2">
          <AnimatedCard delay={300} glow>
            <div className="mb-3 flex items-center gap-2">
              <Gauge className="h-4 w-4" />
              <h2 className="font-semibold">Equipment Health</h2>
            </div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} key={chartKey}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" stroke="var(--muted)" fontSize={11} />
                  <YAxis stroke="var(--muted)" fontSize={11} domain={[0, 100]} unit="%" />
                  <Tooltip
                    content={<HealthBarTooltip />}
                    cursor={{ fill: "color-mix(in srgb, var(--accent) 12%, transparent)" }}
                  />
                  <Bar dataKey="health" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry) => (
                      <Cell key={entry.name} fill={RISK_COLORS[entry.risk] || "var(--accent)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {health.map((eq, i) => (
                <Link
                  key={eq.equipment_id}
                  href={`/equipment/${eq.equipment_code}`}
                  className={`animate-scale-in rounded-lg border p-2.5 transition-all duration-300 hover:scale-[1.02] hover:border-[var(--accent)]/40 hover:shadow-md ${
                    selectedEquipment === eq.equipment_code
                      ? "border-[var(--accent)]/50 bg-[var(--nav-active)] glow-border"
                      : "border-[var(--border)]"
                  }`}
                  style={{ animationDelay: `${i * 60}ms` }}
                  onClick={() => setSelectedEquipment(eq.equipment_code)}
                >
                  <div className="truncate text-xs font-medium">{eq.equipment_code}</div>
                  <div className="mt-1 flex items-baseline justify-between">
                    <span className="text-base font-bold tabular-nums">{eq.health_score.toFixed(0)}%</span>
                    <span className={`text-[10px] font-semibold uppercase risk-${eq.risk_level}`}>
                      {eq.risk_level}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </AnimatedCard>

          <AnimatedCard delay={400} glow tilt3d>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Activity className="h-4 w-4 text-[var(--accent)]" />
              <h2 className="font-semibold">Sensors — {selectedEquipment}</h2>
              <div className="ml-auto flex flex-wrap gap-1">
                {SENSOR_METRICS.map((m) => (
                  <button
                    key={m.key}
                    onClick={() => setSelectedMetric(m.key)}
                    className={`rounded px-2 py-0.5 text-[10px] ${
                      selectedMetric === m.key
                        ? "bg-[var(--btn-bg)] text-[var(--btn-fg)]"
                        : "text-[var(--muted)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            {sensorHistory.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No sensor history yet.</p>
            ) : (
              <>
                <SensorChart key={chartKey} data={sensorHistory} selectedMetric={selectedMetric} />
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {SENSOR_METRICS.map((m, i) => (
                    <div
                      key={m.key}
                      className="animate-fade-in-up rounded-lg border border-[var(--border)] p-2.5"
                      style={{ animationDelay: `${i * 50}ms` }}
                    >
                      <div className="text-[10px] text-[var(--muted)]">{m.label}</div>
                      <div className="text-base font-bold tabular-nums">
                        {latest?.[m.key] != null
                          ? formatSensorValue(m.key, latest[m.key] as number)
                          : "—"}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </AnimatedCard>
          </div>
        </div>
      </div>

      {resolveTarget && (
        <ResolveAlertModal
          alert={resolveTarget}
          onClose={() => setResolveTarget(null)}
          onResolved={() => {
            toast("success", "Alert resolved");
            loadData();
          }}
        />
      )}
    </AppShell>
  );
}
