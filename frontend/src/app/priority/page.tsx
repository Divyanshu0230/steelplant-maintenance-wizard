"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUp,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  ListOrdered,
  Microscope,
  Package,
  Pencil,
  Pin,
  RefreshCw,
  RotateCcw,
  Search,
  Wrench,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import SectionHelp from "@/components/SectionHelp";
import AnimatedCard from "@/components/AnimatedCard";
import { api } from "@/lib/api";
import {
  clearAllPriorityActionStatuses,
  clearPriorityActionStatus,
  getPriorityActionStatuses,
  isPriorityActionDeferred,
  isPriorityActionDone,
  PriorityActionStatus,
  setPriorityActionStatus,
} from "@/lib/priorityActions";
import {
  clearPriorityOverride,
  getPriorityOverrides,
  MANUAL_ACTION_OPTIONS,
  PriorityOverride,
  setPriorityOverride,
} from "@/lib/priorityOverrides";
import { useToast } from "@/components/ToastProvider";

interface PriorityRow {
  equipment_code: string;
  equipment_name: string;
  criticality: string;
  health_score: number;
  risk_level: string;
  rul_cycles?: number;
  failure_probability?: number;
  priority_score: number;
  delay_hours_30d: number;
  delay_severity_score: number;
  recommended_action: string;
  spares_low_stock?: number;
  spares_available?: number;
}

type DisplayRow = PriorityRow & {
  display_score: number;
  display_action: string;
  override?: PriorityOverride;
  ml_rank: number;
};

type FilterTab = "all" | "pending" | "completed" | "deferred" | "critical" | "manual";
type SortMode = "auto" | "score" | "health" | "delay";

const ACTION_COLOR: Record<string, string> = {
  "Immediate Shutdown": "text-red-400 bg-red-500/15 border-red-500/40",
  "Urgent — within 24h": "text-orange-400 bg-orange-500/15 border-orange-500/40",
  "Plan maintenance — 1 week": "text-yellow-400 bg-yellow-500/15 border-yellow-500/40",
  Monitor: "text-green-400 bg-green-500/15 border-green-500/40",
};

const RISK_ROW: Record<string, string> = {
  critical: "bg-red-500/5",
  high: "bg-orange-500/5",
  medium: "",
  low: "",
};

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function buildDisplayRows(
  rows: PriorityRow[],
  overrides: Record<string, PriorityOverride>,
  sortMode: SortMode
): DisplayRow[] {
  const base = rows.map((r, i) => {
    const override = overrides[r.equipment_code];
    const adj = override?.score_adjustment ?? 0;
    return {
      ...r,
      display_score: Math.round((r.priority_score + adj) * 10) / 10,
      display_action: override?.custom_action || r.recommended_action,
      override,
      ml_rank: i + 1,
    };
  });

  const sorted = [...base].sort((a, b) => {
    if (sortMode === "auto") {
      if (a.override?.pinned && !b.override?.pinned) return -1;
      if (!a.override?.pinned && b.override?.pinned) return 1;
      return b.display_score - a.display_score;
    }
    if (sortMode === "score") return b.priority_score - a.priority_score;
    if (sortMode === "health") return a.health_score - b.health_score;
    if (sortMode === "delay") return b.delay_hours_30d - a.delay_hours_30d;
    return 0;
  });

  return sorted;
}

type OverrideDraft = {
  score_adjustment: number;
  pinned: boolean;
  custom_action: string;
  note: string;
};

function defaultDraft(override?: PriorityOverride): OverrideDraft {
  return {
    score_adjustment: override?.score_adjustment ?? 0,
    pinned: override?.pinned ?? false,
    custom_action: override?.custom_action ?? "",
    note: override?.note ?? "",
  };
}

export default function PriorityPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<PriorityRow[]>([]);
  const [methodology, setMethodology] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const [filter, setFilter] = useState<FilterTab>("pending");
  const [sortMode, setSortMode] = useState<SortMode>("auto");
  const [search, setSearch] = useState("");
  const [statuses, setStatuses] = useState<Record<string, PriorityActionStatus>>({});
  const rowsRef = useRef<PriorityRow[]>([]);
  const [overrides, setOverrides] = useState<Record<string, PriorityOverride>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});
  const [overrideDraft, setOverrideDraft] = useState<Record<string, OverrideDraft>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [editTab, setEditTab] = useState<"action" | "priority">("action");

  const syncLocal = useCallback(() => {
    setStatuses(getPriorityActionStatuses());
    setOverrides(getPriorityOverrides());
  }, []);

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      const prevSnapshot = rowsRef.current
        .map((r) => `${r.equipment_code}:${r.priority_score}`)
        .join("|");
      try {
        const r = await api.getPriorityRanking();
        rowsRef.current = r.ranking;
        setRows(r.ranking);
        setMethodology(r.methodology);
        setLastRefreshedAt(new Date());
        syncLocal();
        if (isRefresh) {
          const newSnapshot = r.ranking
            .map((x) => `${x.equipment_code}:${x.priority_score}`)
            .join("|");
          toast(
            "success",
            "Queue refreshed",
            newSnapshot === prevSnapshot && rowsRef.current.length > 0
              ? `${r.ranking.length} assets · scores unchanged (live ML data)`
              : `Top: ${r.ranking[0]?.equipment_code ?? "—"} · ${r.ranking.length} assets`
          );
        }
      } catch (e) {
        toast(
          "error",
          isRefresh ? "Refresh failed" : "Load failed",
          e instanceof Error ? e.message : "Check backend is running"
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [syncLocal, toast]
  );

  useEffect(() => {
    load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const displayRows = useMemo(
    () => buildDisplayRows(rows, overrides, sortMode),
    [rows, overrides, sortMode]
  );

  const stats = useMemo(() => {
    const pending = displayRows.filter(
      (r) => !isPriorityActionDone(r.equipment_code, r.recommended_action)
    );
    const completed = displayRows.filter((r) =>
      isPriorityActionDone(r.equipment_code, r.recommended_action)
    );
    const deferred = displayRows.filter((r) =>
      isPriorityActionDeferred(r.equipment_code, r.recommended_action)
    );
    const manual = displayRows.filter((r) => r.override);
    const urgent = pending.filter(
      (r) =>
        r.risk_level === "critical" ||
        r.display_action === "Immediate Shutdown" ||
        r.display_action === "Urgent — within 24h"
    );
    const lowSpares = pending.filter((r) => (r.spares_low_stock ?? 0) > 0).length;
    return {
      pending: pending.length,
      completed: completed.length,
      deferred: deferred.length,
      manual: manual.length,
      urgent: urgent.length,
      lowSpares,
    };
  }, [displayRows, statuses]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return displayRows.filter((r) => {
      const done = isPriorityActionDone(r.equipment_code, r.recommended_action);
      const deferred = isPriorityActionDeferred(r.equipment_code, r.recommended_action);
      const hasOverride = Boolean(r.override);

      if (filter === "pending" && done) return false;
      if (filter === "completed" && !done) return false;
      if (filter === "deferred" && !deferred) return false;
      if (filter === "manual" && !hasOverride) return false;
      if (filter === "critical") {
        if (done) return false;
        const isCritical =
          r.risk_level === "critical" ||
          r.display_action === "Immediate Shutdown" ||
          r.display_action === "Urgent — within 24h";
        if (!isCritical) return false;
      }

      if (!q) return true;
      return (
        r.equipment_code.toLowerCase().includes(q) ||
        r.equipment_name.toLowerCase().includes(q) ||
        r.display_action.toLowerCase().includes(q)
      );
    });
  }, [displayRows, filter, search, statuses]);

  const topPending = displayRows.find(
    (r) => !isPriorityActionDone(r.equipment_code, r.recommended_action)
  );

  const markDone = async (row: DisplayRow, saveLogbook: boolean) => {
    setSaving(row.equipment_code);
    const note = noteDraft[row.equipment_code]?.trim();
    let logbookOk = false;

    if (saveLogbook) {
      try {
        await api.createLogbookEntry({
          equipment_code: row.equipment_code,
          description: `Priority action completed: ${row.display_action}${note ? ` — ${note}` : ""}`,
          maintenance_type: "corrective",
        });
        logbookOk = true;
      } catch {
        logbookOk = false;
      }
    }

    setPriorityActionStatus(row.equipment_code, row.recommended_action, "completed", {
      note,
      logbook_saved: logbookOk,
      priority_score: row.display_score,
    });
    syncLocal();
    setExpanded(null);
    setSaving(null);
    toast("success", "Action marked done", row.equipment_code);
  };

  const markDeferred = (row: DisplayRow) => {
    setPriorityActionStatus(row.equipment_code, row.recommended_action, "deferred", {
      note: noteDraft[row.equipment_code]?.trim(),
      priority_score: row.display_score,
    });
    syncLocal();
    toast("success", "Deferred", row.equipment_code);
  };

  const reopen = (row: DisplayRow) => {
    clearPriorityActionStatus(row.equipment_code);
    syncLocal();
    toast("success", "Reopened", row.equipment_code);
  };

  const resetDemoQueue = () => {
    clearAllPriorityActionStatuses();
    syncLocal();
    setFilter("pending");
    toast("success", "Queue restored", "All items back in Pending for demo");
  };

  const saveOverride = (row: DisplayRow) => {
    const draft = overrideDraft[row.equipment_code] ?? defaultDraft(row.override);
    setPriorityOverride(row.equipment_code, {
      score_adjustment: draft.score_adjustment,
      pinned: draft.pinned,
      custom_action: draft.custom_action || undefined,
      note: draft.note || undefined,
    });
    syncLocal();
    toast("success", "Manual priority saved", row.equipment_code);
  };

  const removeOverride = (equipmentCode: string) => {
    clearPriorityOverride(equipmentCode);
    syncLocal();
    toast("success", "Override cleared", equipmentCode);
  };

  const openExpand = (row: DisplayRow) => {
    const code = row.equipment_code;
    if (expanded === code) {
      setExpanded(null);
      return;
    }
    setExpanded(code);
    setEditTab("action");
    setOverrideDraft((d) => ({
      ...d,
      [code]: defaultDraft(row.override),
    }));
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <SectionHelp
          icon={ListOrdered}
          title="Plant Priority Ranking"
          subtitle="Maintenance queue — manual priority, mark done, refresh live scores"
          help={
            methodology ||
            "ML composite score ranks assets. Supervisors can pin items, boost scores, or override recommended actions. Refresh pulls latest health/RUL from the API."
          }
        />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {[
            { label: "Pending", value: stats.pending, color: "text-orange-300" },
            { label: "Urgent", value: stats.urgent, color: "text-red-400" },
            { label: "Manual edits", value: stats.manual, color: "text-cyan-400" },
            { label: "Completed", value: stats.completed, color: "text-emerald-400" },
            { label: "Deferred", value: stats.deferred, color: "text-amber-300" },
            { label: "Low spares", value: stats.lowSpares, color: "text-steel-400" },
          ].map((s) => (
            <AnimatedCard key={s.label} delay={0} className="!p-4">
              <div className="text-[10px] uppercase tracking-wide text-gray-500">{s.label}</div>
              <div className={`mt-1 text-2xl font-bold tabular-nums ${s.color}`}>{s.value}</div>
            </AnimatedCard>
          ))}
        </div>

        {topPending && (
          <AnimatedCard delay={40} className="border-red-500/20 bg-gradient-to-r from-red-500/10 to-transparent">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-red-400">
                  <AlertTriangle className="h-4 w-4" />
                  Top bottleneck
                  {topPending.override?.pinned && (
                    <span className="flex items-center gap-0.5 rounded bg-cyan-500/20 px-1.5 py-0.5 text-[9px] text-cyan-300">
                      <Pin className="h-2.5 w-2.5" /> Pinned
                    </span>
                  )}
                </div>
                <h2 className="mt-1 text-lg font-bold text-white">
                  {topPending.equipment_code} — {topPending.equipment_name}
                </h2>
                <p className="mt-1 text-sm text-gray-400">
                  Score {topPending.display_score}
                  {topPending.override?.score_adjustment
                    ? ` (ML ${topPending.priority_score} +${topPending.override.score_adjustment})`
                    : ""}{" "}
                  · Health {topPending.health_score.toFixed(0)}% · {topPending.delay_hours_30d.toFixed(1)}h delay
                </p>
                <span
                  className={`mt-2 inline-block rounded border px-2 py-0.5 text-[10px] font-bold ${
                    ACTION_COLOR[topPending.display_action] ?? "border-white/10 text-gray-400"
                  }`}
                >
                  {topPending.display_action}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => markDone(topPending, true)}
                  disabled={saving === topPending.equipment_code}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Mark done + logbook
                </button>
                <button
                  type="button"
                  onClick={() => openExpand(topPending)}
                  className="flex items-center gap-1 rounded-lg border border-cyan-500/30 px-3 py-2 text-xs text-cyan-300 hover:bg-cyan-500/10"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit priority
                </button>
                <Link
                  href={`/equipment/${topPending.equipment_code}`}
                  className="rounded-lg border border-white/15 px-3 py-2 text-xs font-medium text-gray-300 hover:border-steel-500/40"
                >
                  Open equipment
                </Link>
              </div>
            </div>
          </AnimatedCard>
        )}

        <AnimatedCard delay={80}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1 rounded-lg border border-white/10 bg-black/20 p-1">
              {(
                [
                  ["pending", "Pending"],
                  ["all", "All"],
                  ["critical", "Critical"],
                  ["manual", "Manual"],
                  ["deferred", "Deferred"],
                  ["completed", "Done"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFilter(id)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    filter === id ? "bg-steel-500/25 text-white" : "text-gray-400 hover:text-gray-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as SortMode)}
                className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-xs"
              >
                <option value="auto">Sort: Auto (manual + score)</option>
                <option value="score">Sort: ML score</option>
                <option value="health">Sort: Health (worst first)</option>
                <option value="delay">Sort: Delay hours</option>
              </select>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search equipment…"
                  className="rounded-lg border border-[var(--border)] bg-[var(--background)] py-1.5 pl-8 pr-3 text-xs"
                />
              </div>
              <button
                type="button"
                onClick={() => load(true)}
                disabled={refreshing || loading}
                className="flex items-center gap-1.5 rounded-lg border border-steel-500/40 bg-steel-500/10 px-3 py-1.5 text-xs font-medium text-steel-300 hover:bg-steel-500/20 disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
                {refreshing ? "Refreshing…" : "Refresh"}
              </button>
              {stats.completed > 0 && (
                <button
                  type="button"
                  onClick={resetDemoQueue}
                  className="flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-300 hover:bg-amber-500/20"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset demo queue
                </button>
              )}
            </div>
          </div>

          {lastRefreshedAt && (
            <p className="mb-3 text-[10px] text-gray-600">
              Last refreshed: {formatWhen(lastRefreshedAt.toISOString())}
              {refreshing && <span className="ml-2 text-steel-400">Updating from API…</span>}
            </p>
          )}

          <div className={`relative ${refreshing ? "opacity-60 pointer-events-none" : ""}`}>
            {loading && rows.length === 0 ? (
              <p className="py-12 text-center text-sm text-gray-500">Loading priority queue…</p>
            ) : filteredRows.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm text-gray-500">
                  {filter === "pending" && stats.completed > 0
                    ? "All items marked done — nothing left in Pending."
                    : "No items in this view. Try another filter or clear search."}
                </p>
                {filter === "pending" && stats.completed > 0 && (
                  <button
                    type="button"
                    onClick={resetDemoQueue}
                    className="mt-4 inline-flex items-center gap-2 rounded-lg bg-amber-500/20 px-4 py-2 text-sm font-medium text-amber-300 hover:bg-amber-500/30"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Reset demo queue — show all items again
                  </button>
                )}
                {filter === "pending" && stats.completed > 0 && (
                  <p className="mt-3 text-xs text-gray-600">
                    Or open the <button type="button" onClick={() => setFilter("completed")} className="text-steel-400 underline">Done</button> tab and reopen items one by one.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredRows.map((r, i) => {
                  const done = isPriorityActionDone(r.equipment_code, r.recommended_action);
                  const deferred = isPriorityActionDeferred(r.equipment_code, r.recommended_action);
                  const statusEntry = statuses[r.equipment_code];
                  const isOpen = expanded === r.equipment_code;
                  const draft = overrideDraft[r.equipment_code] ?? defaultDraft(r.override);

                  return (
                    <div
                      key={r.equipment_code}
                      className={`rounded-xl border border-white/10 transition-colors ${
                        done ? "bg-emerald-500/5 opacity-80" : RISK_ROW[r.risk_level] ?? "bg-white/[0.02]"
                      } ${i === 0 && filter === "pending" && !done ? "ring-1 ring-red-500/30" : ""}`}
                    >
                      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                        <div className="w-10 shrink-0 text-center">
                          <div className="text-sm font-bold text-white">#{i + 1}</div>
                          {r.ml_rank !== i + 1 && (
                            <div className="text-[9px] text-gray-600">ML #{r.ml_rank}</div>
                          )}
                        </div>

                        <div className="min-w-[140px] flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Link
                              href={`/equipment/${r.equipment_code}`}
                              className={`font-semibold hover:text-steel-400 ${done ? "text-gray-400 line-through" : "text-white"}`}
                            >
                              {r.equipment_code}
                            </Link>
                            {r.override && (
                              <span className="rounded bg-cyan-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-cyan-300">
                                Manual
                              </span>
                            )}
                            {r.override?.pinned && <Pin className="h-3 w-3 text-cyan-400" />}
                          </div>
                          <div className="text-xs text-gray-500">{r.equipment_name}</div>
                        </div>

                        <div className="hidden sm:flex items-center gap-4 text-xs tabular-nums text-gray-400">
                          <span>H {r.health_score.toFixed(0)}%</span>
                          <span className={`uppercase risk-${r.risk_level}`}>{r.risk_level}</span>
                          <span>{r.delay_hours_30d.toFixed(1)}h</span>
                          <span className="font-bold text-white" title={`ML base: ${r.priority_score}`}>
                            {r.display_score}
                            {r.override?.score_adjustment ? (
                              <span className="ml-0.5 text-[9px] text-cyan-400">
                                +{r.override.score_adjustment}
                              </span>
                            ) : null}
                          </span>
                        </div>

                        <span
                          className={`rounded border px-2 py-0.5 text-[10px] font-bold whitespace-nowrap ${
                            ACTION_COLOR[r.display_action] ?? "border-white/10 text-gray-400"
                          }`}
                        >
                          {r.display_action}
                        </span>

                        {done ? (
                          <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" /> Done
                          </span>
                        ) : deferred ? (
                          <span className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                            <Clock className="h-3 w-3" /> Deferred
                          </span>
                        ) : (
                          <span className="rounded-full bg-orange-500/10 px-2 py-0.5 text-[10px] font-semibold text-orange-300">
                            Pending
                          </span>
                        )}

                        <div className="flex items-center gap-1">
                          {!done && (
                            <>
                              <button
                                type="button"
                                title="Mark done"
                                onClick={() => markDone(r, false)}
                                disabled={saving === r.equipment_code}
                                className="rounded-lg bg-emerald-600/80 p-2 text-white hover:bg-emerald-500 disabled:opacity-50"
                              >
                                <CheckCircle2 className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                title="Defer"
                                onClick={() => markDeferred(r)}
                                className="rounded-lg border border-amber-500/30 p-2 text-amber-400 hover:bg-amber-500/10"
                              >
                                <Clock className="h-4 w-4" />
                              </button>
                            </>
                          )}
                          {done && (
                            <button
                              type="button"
                              title="Reopen"
                              onClick={() => reopen(r)}
                              className="rounded-lg border border-white/10 p-2 text-gray-400 hover:text-white"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            title="Expand / edit"
                            onClick={() => openExpand(r)}
                            className="rounded-lg border border-white/10 p-2 text-gray-400 hover:text-white"
                          >
                            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>

                      {isOpen && (
                        <div className="border-t border-white/10 bg-black/20 px-4 py-3">
                          <div className="mb-3 flex gap-1">
                            <button
                              type="button"
                              onClick={() => setEditTab("action")}
                              className={`rounded-md px-3 py-1 text-xs ${editTab === "action" ? "bg-white/10 text-white" : "text-gray-500"}`}
                            >
                              Complete action
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditTab("priority")}
                              className={`rounded-md px-3 py-1 text-xs ${editTab === "priority" ? "bg-cyan-500/20 text-cyan-300" : "text-gray-500"}`}
                            >
                              Manual priority
                            </button>
                          </div>

                          {editTab === "priority" ? (
                            <div className="space-y-3">
                              <div className="grid gap-3 sm:grid-cols-2">
                                <div>
                                  <label className="text-[10px] text-gray-600">Score boost (+points)</label>
                                  <div className="mt-1 flex items-center gap-2">
                                    <input
                                      type="range"
                                      min={0}
                                      max={50}
                                      value={draft.score_adjustment}
                                      onChange={(e) =>
                                        setOverrideDraft((d) => ({
                                          ...d,
                                          [r.equipment_code]: {
                                            ...draft,
                                            score_adjustment: Number(e.target.value),
                                          },
                                        }))
                                      }
                                      className="flex-1"
                                    />
                                    <span className="w-8 text-xs font-bold text-cyan-300">
                                      +{draft.score_adjustment}
                                    </span>
                                  </div>
                                  <p className="mt-1 text-[10px] text-gray-600">
                                    ML base {r.priority_score} → display{" "}
                                    {r.priority_score + draft.score_adjustment}
                                  </p>
                                </div>
                                <div>
                                  <label className="text-[10px] text-gray-600">Override action</label>
                                  <select
                                    value={draft.custom_action}
                                    onChange={(e) =>
                                      setOverrideDraft((d) => ({
                                        ...d,
                                        [r.equipment_code]: { ...draft, custom_action: e.target.value },
                                      }))
                                    }
                                    className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-xs"
                                  >
                                    <option value="">Use ML recommendation</option>
                                    {MANUAL_ACTION_OPTIONS.map((a) => (
                                      <option key={a} value={a}>
                                        {a}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                              <label className="flex items-center gap-2 text-xs text-gray-300">
                                <input
                                  type="checkbox"
                                  checked={draft.pinned}
                                  onChange={(e) =>
                                    setOverrideDraft((d) => ({
                                      ...d,
                                      [r.equipment_code]: { ...draft, pinned: e.target.checked },
                                    }))
                                  }
                                />
                                <Pin className="h-3.5 w-3.5 text-cyan-400" />
                                Pin to top of queue
                              </label>
                              <div>
                                <label className="text-[10px] text-gray-600">Supervisor note</label>
                                <input
                                  value={draft.note}
                                  onChange={(e) =>
                                    setOverrideDraft((d) => ({
                                      ...d,
                                      [r.equipment_code]: { ...draft, note: e.target.value },
                                    }))
                                  }
                                  placeholder="e.g. Melting shop requested urgent crane check"
                                  className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-xs"
                                />
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => saveOverride(r)}
                                  className="flex items-center gap-1 rounded-lg bg-cyan-600 px-3 py-2 text-xs font-semibold text-white hover:bg-cyan-500"
                                >
                                  <ArrowUp className="h-3.5 w-3.5" />
                                  Save manual priority
                                </button>
                                {r.override && (
                                  <button
                                    type="button"
                                    onClick={() => removeOverride(r.equipment_code)}
                                    className="rounded-lg border border-white/10 px-3 py-2 text-xs text-gray-400 hover:text-white"
                                  >
                                    Clear override
                                  </button>
                                )}
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-xs text-gray-400">
                                <div>
                                  <span className="text-gray-600">Failure prob</span>
                                  <div className="font-medium text-gray-300">
                                    {r.failure_probability != null
                                      ? `${(r.failure_probability * 100).toFixed(0)}%`
                                      : "—"}
                                  </div>
                                </div>
                                <div>
                                  <span className="text-gray-600">RUL</span>
                                  <div className="font-medium text-gray-300">{r.rul_cycles ?? "—"} cycles</div>
                                </div>
                                <div>
                                  <span className="text-gray-600">Spares</span>
                                  <div className="font-medium text-gray-300 flex items-center gap-1">
                                    <Package className="h-3 w-3" />
                                    {r.spares_low_stock ?? 0} low
                                  </div>
                                </div>
                                <div>
                                  <span className="text-gray-600">Criticality</span>
                                  <div className="font-medium capitalize text-gray-300">{r.criticality}</div>
                                </div>
                              </div>

                              {statusEntry && (
                                <p className="mt-2 text-[11px] text-gray-500">
                                  Last update: {formatWhen(statusEntry.updated_at)}
                                  {statusEntry.note && ` · ${statusEntry.note}`}
                                </p>
                              )}

                              {!done && (
                                <div className="mt-3 flex flex-wrap items-end gap-2">
                                  <div className="min-w-[200px] flex-1">
                                    <label className="text-[10px] text-gray-600">Completion note</label>
                                    <input
                                      value={noteDraft[r.equipment_code] ?? ""}
                                      onChange={(e) =>
                                        setNoteDraft((d) => ({
                                          ...d,
                                          [r.equipment_code]: e.target.value,
                                        }))
                                      }
                                      placeholder="e.g. Bearing replaced"
                                      className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-xs"
                                    />
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => markDone(r, true)}
                                    disabled={saving === r.equipment_code}
                                    className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                                  >
                                    <Wrench className="h-3.5 w-3.5" />
                                    Done + logbook
                                  </button>
                                  <Link
                                    href="/diagnosis"
                                    className="flex items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-xs text-gray-300 hover:border-steel-500/40"
                                  >
                                    <Microscope className="h-3.5 w-3.5" />
                                    Diagnose
                                  </Link>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </AnimatedCard>
      </div>
    </AppShell>
  );
}
