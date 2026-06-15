"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  Calendar,
  MapPin,
  Pencil,
  Play,
  Radio,
  Square,
  Zap,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import AnimatedCard from "@/components/AnimatedCard";
import ContagionPanel from "@/components/ContagionPanel";
import DowntimeTicker from "@/components/DowntimeTicker";
import EmergencyQuickActions from "@/components/EmergencyQuickActions";
import FailureReplayScrubber from "@/components/FailureReplayScrubber";
import HealthGauge from "@/components/HealthGauge";
import MaintenanceDebtPanel from "@/components/MaintenanceDebtPanel";
import OperationsScorecard from "@/components/OperationsScorecard";
import Plant3DScene from "@/components/Plant3DScene";
import SectionHelp from "@/components/SectionHelp";
import ShiftHandoverPanel from "@/components/ShiftHandoverPanel";
import VibrationSpectrum from "@/components/VibrationSpectrum";
import { scrollToSection, useSectionSpy } from "@/hooks/useSectionSpy";
import { useLiveEventFeed, useWebSocket } from "@/hooks/useWebSocket";
import { api, Equipment, LiveAsset } from "@/lib/api";
import {
  addManualDebtEntry,
  clearCalendarOverride,
  getCalendarOverrides,
  getManualDebtEntries,
  ManualDebtEntry,
  removeManualDebtEntry,
  setCalendarOverride,
} from "@/lib/liveOverrides";
import { useToast } from "@/components/ToastProvider";

const SEVERITY_COLOR: Record<string, string> = {
  critical: "text-status-critical border-status-critical",
  high: "text-[var(--status-warning)] border-[color-mix(in_srgb,var(--status-warning)_40%,transparent)]",
  warning: "text-status-warning border-status-warning",
  info: "text-[var(--muted)] border-[var(--border)]",
};

type CalendarItem = {
  equipment_code: string;
  equipment_name?: string;
  days_until: number;
  rul_cycles?: number;
  health_score?: number;
  failure_probability?: number;
  estimated_service_date: string;
  urgency: string;
  window_action: string;
};

type DebtItem = {
  equipment_code: string;
  debt_inr: number;
  health_score: number;
  deferred_days?: number;
  action?: string;
};

type CalendarFilter = "all" | "overdue" | "soon" | "planned";

const LIVE_SECTIONS = [
  { id: "twin", label: "Plant Twin" },
  { id: "sensors", label: "Sensor History" },
  { id: "shift", label: "Shift Ops" },
  { id: "planning", label: "Planning" },
] as const;

const LIVE_SECTION_IDS = LIVE_SECTIONS.map((s) => s.id);

export default function LiveMonitoringPage() {
  const [assets, setAssets] = useState<LiveAsset[]>([]);
  const [selected3d, setSelected3d] = useState("RM-MOTOR-03");
  const [lastScan, setLastScan] = useState<string | null>(null);
  const [briefing, setBriefing] = useState({
    alert_count: 0,
    critical_count: 0,
    logbook_entries: 0,
    bottleneck_code: null as string | null,
    critical_alerts: [] as { equipment_code: string; level: string; title: string }[],
    recommended_handover_action: "",
  });
  const [contagion, setContagion] = useState<
    { from: string; to: string; reason: string; propagated_risk: number; severity?: string }[]
  >([]);
  const [debt, setDebt] = useState(0);
  const [debtItems, setDebtItems] = useState<DebtItem[]>([]);
  const [debtInterpretation, setDebtInterpretation] = useState("");
  const [calendar, setCalendar] = useState<CalendarItem[]>([]);
  const [calendarCounts, setCalendarCounts] = useState({ overdue: 0, soon: 0, planned: 0 });
  const [calendarFilter, setCalendarFilter] = useState<CalendarFilter>("all");
  const [whatIfCode, setWhatIfCode] = useState("RM-MOTOR-03");
  const [delayDays, setDelayDays] = useState(7);
  const [whatIfResult, setWhatIfResult] = useState<Record<string, unknown> | null>(null);
  const [streamActive, setStreamActive] = useState(false);
  const [streamTickCount, setStreamTickCount] = useState(0);
  const [equipmentIds, setEquipmentIds] = useState<Record<string, number>>({});
  const [manualDebt, setManualDebt] = useState<ManualDebtEntry[]>([]);
  const [calendarOverrides, setCalendarOverrides] = useState<Record<string, { estimated_service_date: string; note?: string }>>({});
  const [showDebtForm, setShowDebtForm] = useState(false);
  const [debtForm, setDebtForm] = useState({ equipment_code: "", debt_inr: "", note: "" });
  const [editingCalendar, setEditingCalendar] = useState<string | null>(null);
  const [calendarForm, setCalendarForm] = useState({ date: "", note: "" });
  const [highlightedCode, setHighlightedCode] = useState<string | null>(null);
  const activeSection = useSectionSpy(LIVE_SECTION_IDS);
  const { toast } = useToast();
  const { events, refresh: refreshEvents, prepend } = useLiveEventFeed(4000);

  const load = useCallback(async () => {
    try {
      const [status, brief, cont, debtRes, cal] = await Promise.all([
        api.getLiveMonitoringStatus(),
        api.getShiftBriefing(),
        api.getContagionRisk(),
        api.getMaintenanceDebt(),
        api.getPredictiveCalendar(),
      ]);
      setAssets(status.assets);
      setLastScan(status.last_scan?.timestamp ?? null);
      setBriefing({
        alert_count: brief.alert_count,
        critical_count: brief.critical_count,
        logbook_entries: brief.logbook_entries ?? 0,
        bottleneck_code: brief.bottleneck_code ?? null,
        critical_alerts: brief.critical_alerts ?? [],
        recommended_handover_action: brief.recommended_handover_action,
      });
      setContagion(cont.edges);
      setDebt(debtRes.total_debt_inr);
      setDebtItems(debtRes.items ?? []);
      setDebtInterpretation(debtRes.interpretation ?? "");
      setCalendar(cal.schedule);
      setCalendarCounts(cal.counts ?? { overdue: 0, soon: 0, planned: 0 });
    } catch (err) {
      console.error("Live monitoring load failed:", err);
    }
  }, []);

  useEffect(() => {
    load();
    setManualDebt(getManualDebtEntries());
    setCalendarOverrides(getCalendarOverrides());
    api.getEquipment().then((eq: Equipment[]) => {
      setEquipmentIds(Object.fromEntries(eq.map((e) => [e.equipment_code, e.id])));
    });
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const eq = params.get("equipment");
    if (eq) setSelected3d(eq);
  }, []);

  useEffect(() => {
    setWhatIfCode(selected3d);
  }, [selected3d]);

  const { connected } = useWebSocket(
    () => {
      load();
      refreshEvents();
    },
    (tick) => {
      prepend({
        id: Date.now(),
        type: "sensor_tick",
        message: `Live tick cycle ${tick.cycle} on ${tick.equipment_code}`,
        equipment_code: tick.equipment_code,
        severity: "info",
        timestamp: new Date().toISOString(),
        data: tick as unknown as Record<string, unknown>,
      });
      load();
    }
  );

  const runWhatIf = async () => {
    setWhatIfResult(await api.getWhatIf(whatIfCode, delayDays));
  };

  useEffect(() => {
    if (!streamActive) return;
    const codes = Object.keys(equipmentIds);
    if (!codes.length) return;
    let i = 0;
    const tick = async () => {
      const code = codes[i % codes.length];
      const id = equipmentIds[code];
      if (id) {
        try {
          await api.simulateSensorTick(id);
          setStreamTickCount((c) => c + 1);
        } catch {
          /* ignore */
        }
      }
      i++;
    };
    tick();
    const t = setInterval(tick, 3000);
    return () => clearInterval(t);
  }, [streamActive, equipmentIds]);

  const selectedAsset = assets.find((a) => a.equipment_code === selected3d);
  const criticalCount = assets.filter((a) => a.risk_level === "critical" || a.risk_level === "high").length;
  const codes = assets.map((a) => a.equipment_code);

  const filteredCalendar = useMemo(() => {
    const merged = calendar.map((c) => {
      const override = calendarOverrides[c.equipment_code];
      if (!override) return { ...c, isEdited: false };
      return {
        ...c,
        estimated_service_date: override.estimated_service_date,
        window_action: override.note || c.window_action,
        isEdited: true,
      };
    });
    if (calendarFilter === "all") return merged;
    return merged.filter((c) => c.urgency === calendarFilter);
  }, [calendar, calendarFilter, calendarOverrides]);

  const manualDebtTotal = manualDebt.reduce((s, m) => s + m.debt_inr, 0);
  const totalDebtDisplay = debt + manualDebtTotal;

  const addDebt = () => {
    const amount = Number(debtForm.debt_inr);
    if (!debtForm.equipment_code || !amount || amount <= 0) {
      toast("error", "Invalid entry", "Pick equipment and enter a positive ₹ amount");
      return;
    }
    addManualDebtEntry({
      equipment_code: debtForm.equipment_code,
      debt_inr: amount,
      note: debtForm.note || "Manual entry",
    });
    setManualDebt(getManualDebtEntries());
    setDebtForm({ equipment_code: "", debt_inr: "", note: "" });
    setShowDebtForm(false);
    toast("success", "Debt recorded", "Manual maintenance debt added");
  };

  const saveCalendarEdit = (code: string) => {
    if (!calendarForm.date) {
      toast("error", "Date required", "Pick a service date");
      return;
    }
    setCalendarOverride({
      equipment_code: code,
      estimated_service_date: calendarForm.date,
      note: calendarForm.note || undefined,
    });
    setCalendarOverrides(getCalendarOverrides());
    setEditingCalendar(null);
    toast("success", "Calendar updated", `${code} service date saved locally`);
  };

  const focusEquipment = useCallback(
    (code: string) => {
      if (!code) return;
      setSelected3d(code);
      setHighlightedCode(code);
      scrollToSection("twin");
      window.setTimeout(() => setHighlightedCode(null), 2600);
    },
    []
  );

  const scrollToEvents = () => {
    scrollToSection("shift");
    const eventsEl = document.getElementById("live-events");
    eventsEl?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  return (
    <AppShell>
      <div className="live-page space-y-5 pb-2">
        <DowntimeTicker
          debtInr={debt}
          criticalCount={criticalCount}
          debtItemCount={debtItems.length + manualDebt.length}
          manualDebtInr={manualDebtTotal}
        />

        {/* Compact hero + section jump */}
        <div className="rounded-2xl border border-steel-500/20 bg-gradient-to-br from-[var(--card)] via-[#0d1520] to-[var(--background)] p-4 animate-fade-in">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="flex items-center gap-2 text-xl font-bold hologram-text">
                <Radio className={`h-6 w-6 ${connected ? "animate-pulse text-green-400" : "text-gray-500"}`} />
                Live Monitoring
              </h1>
              <p className="mt-0.5 text-xs text-gray-500">
                WS {connected ? "on" : "off"}
                {lastScan && ` · scan ${new Date(lastScan).toLocaleTimeString()}`}
                {streamActive && ` · simulating ${streamTickCount} ticks`}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  const next = !streamActive;
                  setStreamActive(next);
                  if (next) setStreamTickCount(0);
                  toast("info", next ? "Live stream ON" : "Stopped", next ? "Sensor ticks every 3s" : "Monitoring only");
                }}
                className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium ${
                  streamActive
                    ? "border border-red-500/40 bg-red-500/20 text-red-300"
                    : "bg-steel-500 text-white"
                }`}
              >
                {streamActive ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                {streamActive ? "Stop" : "Live Stream"}
              </button>
              <Link href="/" className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-gray-400 hover:text-white">
                Dashboard
              </Link>
            </div>
          </div>
          <nav className="sticky top-[7.5rem] z-20 -mx-1 mt-3 flex flex-wrap gap-2 rounded-xl border border-white/5 bg-[var(--card)]/90 p-2 backdrop-blur-sm">
            <span className="mr-1 self-center text-[10px] uppercase tracking-wide text-gray-600">You are in:</span>
            {LIVE_SECTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => scrollToSection(s.id)}
                className={`live-section-nav-btn rounded-full border border-[var(--border)] px-3 py-1 text-[11px] font-medium ${
                  activeSection === s.id ? "is-active" : "text-gray-400 hover:text-white"
                }`}
              >
                {s.label}
              </button>
            ))}
          </nav>
        </div>

        {/* ── Plant Twin ── */}
        <section id="twin" className="scroll-mt-32 space-y-4">
          <SectionHelp
            icon={MapPin}
            title="Plant Digital Twin"
            subtitle="Click machines on the map — failure % below is ML prediction, separate from ops grade"
            help="Zone map shows blast furnace, rolling mill, and logistics areas. Select an asset to drive vibration charts, what-if, and emergency actions. Start Live Stream to simulate sensor ticks across all 5 assets every 3 seconds."
          />
          <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
            <div className="lg:col-span-2">
              <Plant3DScene
                assets={assets}
                selected={selected3d}
                onSelect={focusEquipment}
                streamActive={streamActive}
              />
            </div>
            <div className="flex flex-col gap-3">
              <OperationsScorecard assets={assets} onSelectEquipment={focusEquipment} />
              <EmergencyQuickActions equipmentCode={selected3d} riskLevel={selectedAsset?.risk_level} />
            </div>
          </div>

          <div>
            <SectionHelp
              icon={Activity}
              title="Fleet Pulse"
              subtitle="Tap a card to sync twin, charts, and simulators"
              help="Health from latest ML scan. Green pulse = stable; red ping = critical/high. RUL = remaining useful life in operating cycles."
            />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {assets.map((a, i) => (
              <AnimatedCard
                key={a.equipment_code}
                delay={i * 60}
                tilt3d
                className={`relative cursor-pointer overflow-hidden ${
                  selected3d === a.equipment_code ? "ring-2 ring-steel-500" : ""
                } ${highlightedCode === a.equipment_code ? "equipment-focus-ring ring-2 ring-steel-400" : ""}`}
              >
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => focusEquipment(a.equipment_code)}
                >
                  <div
                    className={`absolute right-2 top-2 h-2 w-2 rounded-full ${
                      a.pulse === "critical" ? "animate-ping bg-red-500" : "animate-pulse bg-green-500"
                    }`}
                  />
                  <div className="text-xs font-mono text-steel-500">{a.equipment_code}</div>
                  <div className="text-sm font-medium">{a.equipment_name}</div>
                  <div className="mt-3 flex items-center justify-between">
                    <HealthGauge score={a.health_score} size={52} />
                    <div className="text-right text-xs">
                      <div className={`font-bold uppercase risk-${a.risk_level}`}>{a.risk_level}</div>
                      <div className="text-gray-500">RUL {a.rul_cycles ?? "—"}</div>
                      {a.failure_probability != null && (
                        <div className="text-red-400/80">
                          {(a.failure_probability * 100).toFixed(0)}% fail
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              </AnimatedCard>
            ))}
          </div>
          </div>
        </section>

        {/* ── Sensor History ── */}
        <section id="sensors" className="scroll-mt-32">
          <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
            <FailureReplayScrubber
              equipmentCodes={codes.length ? codes : ["RM-MOTOR-03"]}
              defaultCode={selected3d}
              className="min-h-[28rem]"
            />
            <VibrationSpectrum
              active={streamActive || connected}
              equipmentCode={selected3d}
              className="min-h-[28rem]"
            />
          </div>
        </section>

        {/* ── Shift Operations ── */}
        <section id="shift" className="scroll-mt-32">
        <div className="grid gap-4 lg:grid-cols-3">
          <AnimatedCard className="lg:col-span-2" delay={100} glow>
            <div id="live-events">
            <SectionHelp
              icon={Activity}
              title="Live Event Stream"
              badge={`${events.length} events`}
              help="WebSocket feed from monitoring scans and live-stream sensor ticks. Start Live Stream to populate. Each tick advances one asset's sensor cycle in the database and broadcasts here."
            />
            <div className="max-h-72 space-y-1 overflow-y-auto font-mono text-xs">
              {events.length === 0 ? (
                <p className="text-gray-500">
                  No events yet — click <strong>Start Live Stream</strong> or wait for the 60s ML scan.
                </p>
              ) : (
                events.map((e) => (
                  <button
                    key={`${e.id}-${e.timestamp}`}
                    type="button"
                    onClick={() => e.equipment_code && focusEquipment(e.equipment_code)}
                    className={`animate-slide-in-right flex w-full gap-2 rounded border px-2 py-1.5 text-left transition-colors hover:bg-white/5 ${
                      SEVERITY_COLOR[e.severity] || SEVERITY_COLOR.info
                    }`}
                  >
                    <span className="shrink-0 text-gray-600">
                      {new Date(e.timestamp).toLocaleTimeString()}
                    </span>
                    <span className="shrink-0 uppercase text-gray-500">[{e.type}]</span>
                    <span className="text-gray-300">{e.message}</span>
                  </button>
                ))
              )}
            </div>
            </div>
          </AnimatedCard>

          <AnimatedCard delay={150}>
            <ShiftHandoverPanel
              alertCount={briefing.alert_count}
              criticalCount={briefing.critical_count}
              logbookEntries={briefing.logbook_entries}
              bottleneckCode={briefing.bottleneck_code}
              criticalAlerts={briefing.critical_alerts}
              recommendedAction={briefing.recommended_handover_action}
              onFocusEquipment={focusEquipment}
              onScrollToEvents={scrollToEvents}
              onHandoverSubmitted={load}
            />
          </AnimatedCard>
        </div>
        </section>

        {/* ── Planning ── */}
        <section id="planning" className="scroll-mt-32 space-y-4">
        <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
          <AnimatedCard delay={200} className="h-fit">
            <SectionHelp
              icon={Zap}
              title="What-If Simulator"
              help="Uses current ML predictions from the database. If you delay maintenance N days, it projects lower RUL, higher failure %, and estimated downtime cost. Helps justify scheduling — data is computed, not random."
            />
            <select
              value={whatIfCode}
              onChange={(e) => setWhatIfCode(e.target.value)}
              className="mb-2 w-full rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-sm"
            >
              {assets.map((a) => (
                <option key={a.equipment_code} value={a.equipment_code}>
                  {a.equipment_code}
                </option>
              ))}
            </select>
            <label className="text-xs text-gray-500">
              Delay maintenance {delayDays} days
              <input
                type="range"
                min={1}
                max={30}
                value={delayDays}
                onChange={(e) => setDelayDays(Number(e.target.value))}
                className="mt-1 w-full"
              />
            </label>
            <button
              onClick={runWhatIf}
              className="mt-2 w-full rounded bg-steel-500 py-2 text-xs font-medium transition-transform hover:scale-105"
            >
              Run simulation
            </button>
            {whatIfResult && !whatIfResult.error && (
              <div className="mt-3 space-y-2 rounded-lg border border-[var(--border)] bg-[var(--background)]/40 p-3 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-gray-500">RUL now</div>
                    <div className="font-bold">{String(whatIfResult.current_rul_cycles)} cycles</div>
                  </div>
                  <div>
                    <div className="text-gray-500">RUL after delay</div>
                    <div className="font-bold text-orange-400">
                      {String(whatIfResult.projected_rul_cycles)} cycles
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500">Fail % now</div>
                    <div className="font-bold">
                      {(((whatIfResult.current_failure_probability as number) ?? 0) * 100).toFixed(0)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500">Fail % after</div>
                    <div className="font-bold text-red-400">
                      {(((whatIfResult.projected_failure_probability as number) ?? 0) * 100).toFixed(0)}%
                    </div>
                  </div>
                </div>
                {whatIfResult.estimated_downtime_cost_inr != null && (
                  <div className="border-t border-white/5 pt-2 text-red-300">
                    Est. cost impact ₹{Number(whatIfResult.estimated_downtime_cost_inr).toLocaleString()}
                  </div>
                )}
                <div className="text-gray-400">{String(whatIfResult.recommendation)}</div>
                {whatIfResult.safe_to_delay === true && (
                  <span className="inline-block rounded bg-green-500/15 px-2 py-0.5 text-green-400">
                    Safe to delay (per model)
                  </span>
                )}
                {whatIfResult.safe_to_delay === false && (
                  <span className="inline-block rounded bg-red-500/15 px-2 py-0.5 text-red-400">
                    Not safe to delay
                  </span>
                )}
              </div>
            )}
          </AnimatedCard>

          <AnimatedCard delay={250} className="h-fit">
            <ContagionPanel edges={contagion} onFocusEquipment={focusEquipment} />
          </AnimatedCard>

          <AnimatedCard delay={300} className="h-fit">
            <MaintenanceDebtPanel
              totalDebtDisplay={totalDebtDisplay}
              debtInterpretation={debtInterpretation}
              debtItems={debtItems}
              manualDebt={manualDebt}
              assets={assets}
              showDebtForm={showDebtForm}
              debtForm={debtForm}
              onToggleForm={() => setShowDebtForm((v) => !v)}
              onDebtFormChange={setDebtForm}
              onAddDebt={addDebt}
              onRemoveManual={(id) => {
                removeManualDebtEntry(id);
                setManualDebt(getManualDebtEntries());
              }}
              onFocusEquipment={focusEquipment}
            />
          </AnimatedCard>
        </div>

        {/* Predictive calendar */}
        <AnimatedCard delay={350}>
          <SectionHelp
            icon={Calendar}
            title="Predictive Maintenance Calendar"
            subtitle="Sorted by RUL — overdue & soon appear when ML predicts low remaining cycles"
            help="ML-predicted service dates from RUL cycles. Click pencil to override a date manually (saved in your browser) — useful when planners reschedule shutdowns outside the model."
          />
          <div className="mb-4 flex flex-wrap gap-2">
            {(
              [
                ["all", `All (${calendar.length})`],
                ["overdue", `Overdue (${calendarCounts.overdue})`],
                ["soon", `Soon (${calendarCounts.soon})`],
                ["planned", `Planned (${calendarCounts.planned})`],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setCalendarFilter(key)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  calendarFilter === key
                    ? "bg-steel-500 text-white"
                    : "border border-[var(--border)] text-gray-400 hover:text-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {filteredCalendar.length === 0 ? (
              <p className="col-span-full text-sm text-gray-500">
                No items in this filter — try &quot;All&quot; or &quot;Planned&quot;.
              </p>
            ) : (
              filteredCalendar.map((c, i) => (
                <div
                  key={c.equipment_code}
                  className={`animate-fade-in-up rounded-lg border p-3 text-xs ${
                    c.urgency === "overdue"
                      ? "border-red-500/50 bg-red-500/10"
                      : c.urgency === "soon"
                        ? "border-status-warning bg-status-warning/10"
                        : "border-[var(--border)]"
                  } ${"isEdited" in c && c.isEdited ? "ring-1 ring-steel-500/40" : ""}`}
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <div className="flex items-start justify-between gap-1">
                    <button type="button" className="min-w-0 flex-1 text-left" onClick={() => focusEquipment(c.equipment_code)}>
                      <div className="font-mono font-bold">{c.equipment_code}</div>
                      <div className="truncate text-gray-500">{c.equipment_name}</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCalendar(c.equipment_code);
                        setCalendarForm({
                          date: c.estimated_service_date,
                          note: calendarOverrides[c.equipment_code]?.note || "",
                        });
                      }}
                      className="shrink-0 rounded p-1 text-gray-500 hover:bg-white/5 hover:text-steel-300"
                      title="Edit service date"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="capitalize text-steel-500">
                      {c.urgency}
                      {"isEdited" in c && c.isEdited && <span className="ml-1 text-steel-400">· edited</span>}
                    </span>
                    {c.failure_probability != null && (
                      <span className="font-bold text-red-400/90">
                        {(c.failure_probability * 100).toFixed(0)}% fail
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-gray-500">{c.estimated_service_date}</div>
                  <div className="mt-1 text-[10px] text-gray-600">
                    RUL {c.rul_cycles ?? "—"} · {c.days_until}d
                  </div>
                  {editingCalendar === c.equipment_code && (
                    <div className="mt-2 space-y-1.5 border-t border-white/10 pt-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="date"
                        value={calendarForm.date}
                        onChange={(e) => setCalendarForm((f) => ({ ...f, date: e.target.value }))}
                        className="w-full rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1"
                      />
                      <input
                        placeholder="Planner note"
                        value={calendarForm.note}
                        onChange={(e) => setCalendarForm((f) => ({ ...f, note: e.target.value }))}
                        className="w-full rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1"
                      />
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => saveCalendarEdit(c.equipment_code)}
                          className="flex-1 rounded bg-steel-500 py-1 text-[10px]"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            clearCalendarOverride(c.equipment_code);
                            setCalendarOverrides(getCalendarOverrides());
                            setEditingCalendar(null);
                          }}
                          className="rounded border border-[var(--border)] px-2 py-1 text-[10px] text-gray-400"
                        >
                          Reset
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
          <p className="mt-3 text-[10px] text-gray-600">
            <strong className="text-gray-500">fail %</strong> = ML failure probability — different from the ops letter grade (A–F) on the scorecard.
          </p>
        </AnimatedCard>
        </section>
      </div>
    </AppShell>
  );
}
