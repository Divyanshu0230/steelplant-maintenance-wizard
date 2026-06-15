"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  BookOpen,
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  ExternalLink,
  Filter,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Wrench,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import AnimatedCard from "@/components/AnimatedCard";
import { api, Equipment, LogbookEntry, LogbookSummary } from "@/lib/api";
import {
  groupEntriesByDate,
  logbookTemplates,
  MAINTENANCE_TYPES,
  OUTCOME_OPTIONS,
  formatTypeLabel,
  typeBadgeClass,
} from "@/lib/logbookPrompts";
import { useToast } from "@/components/ToastProvider";

const EMPTY_SUMMARY: LogbookSummary = {
  total_entries: 0,
  last_8_hours: 0,
  last_24_hours: 0,
  by_type: {},
  by_equipment: {},
};

export default function LogbookPage() {
  const [entries, setEntries] = useState<LogbookEntry[]>([]);
  const [summary, setSummary] = useState<LogbookSummary>(EMPTY_SUMMARY);
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [filterEquipment, setFilterEquipment] = useState("");
  const [filterType, setFilterType] = useState("");
  const [searchText, setSearchText] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [form, setForm] = useState({
    equipment_code: "",
    maintenance_type: "inspection",
    description: "",
    parts_used: "",
    duration_hours: "",
    cost: "",
    outcome: "completed",
  });
  const { toast } = useToast();
  const searchParams = useSearchParams();

  useEffect(() => {
    const eq = searchParams.get("equipment") || searchParams.get("equipment_code");
    if (eq) setFilterEquipment(eq);
  }, [searchParams]);

  useEffect(() => {
    api.getEquipment().then((list) => {
      setEquipmentList(list);
      if (!form.equipment_code && list.length) {
        setForm((f) => ({ ...f, equipment_code: list[0].equipment_code }));
      }
    }).catch(() => setEquipmentList([]));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rows, stats] = await Promise.all([
        api.getLogbook({
          equipmentCode: filterEquipment || undefined,
          maintenanceType: filterType || undefined,
          search: searchText.trim() || undefined,
          limit: 80,
        }),
        api.getLogbookSummary(filterEquipment || undefined),
      ]);
      setEntries(rows);
      setSummary(stats);
    } catch {
      setEntries([]);
      setSummary(EMPTY_SUMMARY);
    } finally {
      setLoading(false);
    }
  }, [filterEquipment, filterType, searchText]);

  useEffect(() => {
    const t = setTimeout(load, searchText ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, searchText]);

  const grouped = useMemo(() => groupEntriesByDate(entries), [entries]);
  const templates = useMemo(
    () => logbookTemplates(form.equipment_code || filterEquipment || "equipment"),
    [form.equipment_code, filterEquipment]
  );

  const applyTemplate = (tpl: (typeof templates)[0]) => {
    setForm((f) => ({
      ...f,
      maintenance_type: tpl.maintenance_type,
      description: tpl.description,
    }));
    setShowForm(true);
  };

  const saveEntry = async () => {
    if (form.description.trim().length < 10) {
      toast("error", "Description too short", "Add at least 10 characters");
      return;
    }
    if (!form.equipment_code) {
      toast("error", "Select equipment");
      return;
    }
    setSaving(true);
    try {
      await api.createLogbookEntry({
        equipment_code: form.equipment_code,
        description: form.description.trim(),
        maintenance_type: form.maintenance_type,
        parts_used: form.parts_used || undefined,
        duration_hours: form.duration_hours ? parseFloat(form.duration_hours) : undefined,
        cost: form.cost ? parseFloat(form.cost) : undefined,
        outcome: form.outcome,
      });
      toast("success", "Logbook entry saved");
      setForm((f) => ({
        ...f,
        description: "",
        parts_used: "",
        duration_hours: "",
        cost: "",
      }));
      setShowForm(false);
      load();
    } catch (e) {
      toast("error", "Save failed", e instanceof Error ? e.message : "");
    } finally {
      setSaving(false);
    }
  };

  const exportPdf = async () => {
    setExporting(true);
    try {
      const blob = await api.exportLogbookPdf(filterEquipment || undefined);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Logbook_${filterEquipment || "plant"}_${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast("success", "Logbook PDF downloaded");
    } catch (e) {
      toast("error", "Export failed", e instanceof Error ? e.message : "");
    } finally {
      setExporting(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-steel-500/15">
              <BookOpen className="h-5 w-5 text-steel-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Maintenance Logbook</h1>
              <p className="mt-0.5 text-sm text-[var(--muted)]">
                Digital work history per asset — feeds shift handover on Live Monitoring
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => load()}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm hover:border-steel-500/40"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={exportPdf}
              disabled={exporting || entries.length === 0}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm hover:border-steel-500/40 disabled:opacity-50"
            >
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Export PDF
            </button>
            <button
              type="button"
              onClick={() => setShowForm(!showForm)}
              className="inline-flex items-center gap-2 rounded-lg bg-steel-500 px-4 py-2 text-sm font-medium"
            >
              <Plus className="h-4 w-4" />
              {showForm ? "Cancel" : "New entry"}
            </button>
          </div>
        </div>

        {/* How it works */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--background)]/60 px-4 py-3 text-[11px] leading-relaxed text-[var(--muted)]">
          <strong className="text-[var(--foreground)]">How it works:</strong> Chat diagnoses, Priority
          actions, and shift handover can auto-log here. Add manual entries after field work. Filter by
          asset or type, use quick templates, and export PDF for shift reports.
        </div>

        {/* Stats */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Total entries", value: summary.total_entries, icon: BookOpen },
            { label: "Last 8 hours", value: summary.last_8_hours, icon: Clock },
            { label: "Last 24 hours", value: summary.last_24_hours, icon: Calendar },
            { label: "Showing", value: entries.length, icon: Filter },
          ].map(({ label, value, icon: Icon }) => (
            <div
              key={label}
              className="rounded-xl border border-[var(--border)] bg-[var(--background)]/50 px-4 py-3"
            >
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                <Icon className="h-3.5 w-3.5" />
                {label}
              </div>
              <div className="mt-1 text-2xl font-bold text-[var(--foreground)]">{value}</div>
            </div>
          ))}
        </div>

        {/* Quick templates */}
        <AnimatedCard delay={0}>
          <h2 className="mb-2 text-sm font-semibold">Quick entry templates</h2>
          <p className="mb-3 text-xs text-[var(--muted)]">
            One-click starters — edit before saving. Uses selected equipment in the form (
            {form.equipment_code || "pick equipment below"}).
          </p>
          <div className="flex flex-wrap gap-2">
            {templates.map((tpl) => (
              <button
                key={tpl.label}
                type="button"
                onClick={() => applyTemplate(tpl)}
                className="rounded-full border border-status-healthy/30 bg-status-healthy/10 px-3 py-1 text-[11px] font-medium text-status-healthy hover:bg-status-healthy/20"
              >
                {tpl.label}
              </button>
            ))}
          </div>
        </AnimatedCard>

        {/* New entry form */}
        {showForm && (
          <AnimatedCard delay={25}>
            <h2 className="mb-4 flex items-center gap-2 font-semibold">
              <Wrench className="h-5 w-5 text-steel-400" />
              New logbook entry
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <label className="text-sm">
                <span className="text-[var(--muted)]">Equipment *</span>
                <select
                  value={form.equipment_code}
                  onChange={(e) => setForm({ ...form, equipment_code: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2"
                >
                  {equipmentList.map((e) => (
                    <option key={e.id} value={e.equipment_code}>
                      {e.equipment_code} — {e.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="text-[var(--muted)]">Type</span>
                <select
                  value={form.maintenance_type}
                  onChange={(e) => setForm({ ...form, maintenance_type: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2"
                >
                  {MAINTENANCE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="text-[var(--muted)]">Outcome</span>
                <select
                  value={form.outcome}
                  onChange={(e) => setForm({ ...form, outcome: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2"
                >
                  {OUTCOME_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="mt-4 block text-sm">
              <span className="text-[var(--muted)]">Description *</span>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={4}
                placeholder="Replaced bearing on RM-MOTOR-03. Vibration reduced from 8.2 to 2.1 mm/s after test run."
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2"
              />
            </label>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <label className="text-sm">
                <span className="text-[var(--muted)]">Parts used</span>
                <input
                  value={form.parts_used}
                  onChange={(e) => setForm({ ...form, parts_used: e.target.value })}
                  placeholder="BRG-RMM-450, seal kit"
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2"
                />
              </label>
              <label className="text-sm">
                <span className="text-[var(--muted)]">Duration (hours)</span>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={form.duration_hours}
                  onChange={(e) => setForm({ ...form, duration_hours: e.target.value })}
                  placeholder="2.5"
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2"
                />
              </label>
              <label className="text-sm">
                <span className="text-[var(--muted)]">Cost (₹)</span>
                <input
                  type="number"
                  min={0}
                  value={form.cost}
                  onChange={(e) => setForm({ ...form, cost: e.target.value })}
                  placeholder="15000"
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2"
                />
              </label>
            </div>
            <button
              type="button"
              onClick={saveEntry}
              disabled={saving}
              className="mt-4 rounded-lg bg-steel-500 px-5 py-2.5 text-sm font-medium disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save entry"}
            </button>
          </AnimatedCard>
        )}

        {/* Filters + timeline */}
        <AnimatedCard delay={50}>
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <div className="min-w-[180px] flex-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                Search
              </label>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
                <input
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Description, parts, equipment…"
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] py-2 pl-9 pr-3 text-sm"
                />
              </div>
            </div>
            <label className="text-sm">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                Equipment
              </span>
              <select
                value={filterEquipment}
                onChange={(e) => setFilterEquipment(e.target.value)}
                className="mt-1 block min-w-[160px] rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              >
                <option value="">All equipment</option>
                {equipmentList.map((e) => (
                  <option key={e.id} value={e.equipment_code}>
                    {e.equipment_code}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                Type
              </span>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="mt-1 block min-w-[140px] rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              >
                <option value="">All types</option>
                {MAINTENANCE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {Object.keys(summary.by_type).length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {Object.entries(summary.by_type).map(([type, count]) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setFilterType(filterType === type ? "" : type)}
                  className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${typeBadgeClass(type)} ${
                    filterType === type ? "ring-1 ring-steel-400" : ""
                  }`}
                >
                  {formatTypeLabel(type)} ({count})
                </button>
              ))}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-[var(--muted)]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading logbook…
            </div>
          ) : entries.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--border)] p-8 text-center">
              <p className="text-sm text-[var(--muted)]">
                No entries match your filters. AI diagnoses from Chat auto-log here, or add a manual
                entry above.
              </p>
              <Link
                href="/chat"
                className="mt-3 inline-flex items-center gap-1 text-sm text-status-healthy hover:underline"
              >
                Open AI Agentic Assistant
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              {grouped.map((group) => (
                <div key={group.label}>
                  <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                    <Calendar className="h-3.5 w-3.5" />
                    {group.label}
                  </div>
                  <div className="space-y-3">
                    {group.items.map((e) => {
                      const expanded = expandedId === e.id;
                      const code = e.equipment_code || `EQ-${e.equipment_id}`;
                      return (
                        <div
                          key={e.id}
                          className="rounded-xl border border-[var(--border)] bg-[var(--background)]/40 p-4 transition hover:border-steel-500/30"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <Link
                                  href={`/equipment/${encodeURIComponent(code)}`}
                                  className="text-sm font-bold text-steel-300 hover:text-white"
                                >
                                  {code}
                                </Link>
                                {e.equipment_name && (
                                  <span className="truncate text-xs text-[var(--muted)]">
                                    {e.equipment_name}
                                  </span>
                                )}
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${typeBadgeClass(e.maintenance_type)}`}
                                >
                                  {formatTypeLabel(e.maintenance_type)}
                                </span>
                                {e.outcome && (
                                  <span className="text-[10px] uppercase text-[var(--muted)]">
                                    {e.outcome.replace("_", " ")}
                                  </span>
                                )}
                              </div>
                              <p className="mt-2 text-sm leading-relaxed text-[var(--foreground)]">
                                {expanded ? e.description : `${e.description.slice(0, 220)}${e.description.length > 220 ? "…" : ""}`}
                              </p>
                            </div>
                            <div className="shrink-0 text-right text-[11px] text-[var(--muted)]">
                              <div>{new Date(e.performed_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</div>
                              {e.performed_by && <div className="mt-0.5">{e.performed_by}</div>}
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] pt-3">
                            <div className="flex flex-wrap gap-3 text-[11px] text-[var(--muted)]">
                              {e.parts_used && <span>Parts: {e.parts_used}</span>}
                              {e.duration_hours != null && <span>{e.duration_hours}h</span>}
                              {e.cost != null && <span>₹{e.cost.toLocaleString()}</span>}
                            </div>
                            <div className="flex items-center gap-2">
                              <Link
                                href={`/chat?equipment=${encodeURIComponent(code)}`}
                                className="text-[10px] text-status-healthy hover:underline"
                              >
                                Diagnose
                              </Link>
                              {e.description.length > 220 && (
                                <button
                                  type="button"
                                  onClick={() => setExpandedId(expanded ? null : e.id)}
                                  className="inline-flex items-center gap-0.5 text-[10px] text-[var(--muted)] hover:text-[var(--foreground)]"
                                >
                                  {expanded ? (
                                    <>
                                      Less <ChevronUp className="h-3 w-3" />
                                    </>
                                  ) : (
                                    <>
                                      More <ChevronDown className="h-3 w-3" />
                                    </>
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </AnimatedCard>

        {/* Top assets */}
        {Object.keys(summary.by_equipment).length > 0 && !filterEquipment && (
          <AnimatedCard delay={75}>
            <h3 className="mb-3 text-sm font-semibold">Most logged assets</h3>
            <div className="flex flex-wrap gap-2">
              {Object.entries(summary.by_equipment).map(([code, count]) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setFilterEquipment(code)}
                  className="rounded-lg border border-[var(--border)] px-3 py-2 text-left text-sm transition hover:border-steel-500/40"
                >
                  <span className="font-semibold">{code}</span>
                  <span className="ml-2 text-xs text-[var(--muted)]">{count} entries</span>
                </button>
              ))}
            </div>
          </AnimatedCard>
        )}
      </div>
    </AppShell>
  );
}
