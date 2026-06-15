"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Calendar,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Download,
  Eye,
  FileText,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  Sun,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import AnimatedCard from "@/components/AnimatedCard";
import MarkdownRenderer from "@/components/MarkdownRenderer";
import { api, Equipment, ReportDetail, ReportSummary, ReportsSummaryStats } from "@/lib/api";
import {
  formatRelativeTime,
  formatReportType,
  groupReportsByDate,
  REPORT_TEMPLATES,
  REPORT_TYPE_OPTIONS,
  reportTypeBadgeClass,
  riskBadgeClass,
} from "@/lib/reportsUtils";
import { useToast } from "@/components/ToastProvider";

const EMPTY_STATS: ReportsSummaryStats = {
  total_reports: 0,
  last_24_hours: 0,
  last_7_days: 0,
  by_type: {},
  by_equipment: {},
};

export default function ReportsPage() {
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [stats, setStats] = useState<ReportsSummaryStats>(EMPTY_STATS);
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [generateEquipment, setGenerateEquipment] = useState("");
  const [historyEquipment, setHistoryEquipment] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [searchText, setSearchText] = useState("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [preview, setPreview] = useState<ReportDetail | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const { toast } = useToast();
  const searchParams = useSearchParams();

  useEffect(() => {
    const eq = searchParams.get("equipment") || searchParams.get("equipment_code");
    if (eq) setHistoryEquipment(eq);
    const type = searchParams.get("type");
    if (type) setTypeFilter(type);
  }, [searchParams]);

  useEffect(() => {
    api.getEquipment().then((list) => {
      setEquipmentList(list);
      if (!generateEquipment && list.length) {
        const critical = list.find((e) => e.criticality === "critical") || list[0];
        setGenerateEquipment(critical.equipment_code);
      }
    }).catch(() => setEquipmentList([]));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rows, summary] = await Promise.all([
        api.listReports({
          limit: 80,
          reportType: typeFilter || undefined,
          equipmentCode: historyEquipment || undefined,
          search: searchText.trim() || undefined,
        }),
        api.getReportsSummary(),
      ]);
      setReports(rows);
      setStats(summary);
    } catch {
      setReports([]);
      setStats(EMPTY_STATS);
    } finally {
      setLoading(false);
    }
  }, [typeFilter, historyEquipment, searchText]);

  useEffect(() => {
    const t = setTimeout(load, searchText ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, searchText]);

  const grouped = useMemo(() => groupReportsByDate(reports), [reports]);

  const downloadPdf = async (id: number, title: string) => {
    setDownloadingId(id);
    try {
      const blob = await api.downloadReportPdf(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title.replace(/\s+/g, "_").slice(0, 80)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast("success", "PDF downloaded");
    } catch (e) {
      toast("error", "Download failed", e instanceof Error ? e.message : "");
    } finally {
      setDownloadingId(null);
    }
  };

  const runTemplate = async (templateId: string) => {
    const template = REPORT_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;

    setGenerating(templateId);
    try {
      if (template.reportType === "shift_briefing") {
        const blob = await api.generateShiftBriefingPdf();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "Shift_Handover_Briefing.pdf";
        a.click();
        URL.revokeObjectURL(url);
        toast("success", "Shift briefing ready", "Saved to report history");
      } else {
        let code = generateEquipment;
        if (template.preferCritical) {
          const crit = equipmentList.find((e) => e.criticality === "critical");
          if (crit) code = crit.equipment_code;
        }
        if (!code) throw new Error("Select equipment first");
        await api.generateReport(code, template.reportType);
        toast("success", "Report generated", code);
      }
      load();
    } catch (e) {
      toast("error", "Generation failed", e instanceof Error ? e.message : "");
    } finally {
      setGenerating(null);
    }
  };

  const togglePreview = async (id: number) => {
    if (expandedId === id) {
      setExpandedId(null);
      setPreview(null);
      return;
    }
    setExpandedId(id);
    setPreviewLoading(true);
    try {
      const detail = await api.getReport(id);
      setPreview(detail);
    } catch {
      setPreview(null);
      toast("error", "Could not load preview");
    } finally {
      setPreviewLoading(false);
    }
  };

  const summaryText =
    preview?.content && typeof preview.content.executive_summary === "string"
      ? preview.content.executive_summary
      : undefined;

  const previewActions =
    preview?.content &&
    Array.isArray(preview.content.maintenance_actions) &&
    preview.content.maintenance_actions.length > 0
      ? (preview.content.maintenance_actions as { action?: string; priority?: string }[])
      : null;

  return (
    <AppShell>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-steel-500/15">
              <FileText className="h-5 w-5 text-steel-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Maintenance Reports</h1>
              <p className="mt-0.5 text-sm text-[var(--muted)]">
                AI-generated PDFs — equipment diagnosis, shift handover & diagnosis exports
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-xs text-[var(--muted)] hover:border-steel-500/40 hover:text-steel-200"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* Stats */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Total reports", value: stats.total_reports, icon: FileText },
            { label: "Last 24 hours", value: stats.last_24_hours, icon: Sun },
            { label: "Last 7 days", value: stats.last_7_days, icon: Calendar },
            {
              label: "Latest",
              value: stats.latest_at ? formatRelativeTime(stats.latest_at) : "—",
              icon: ClipboardList,
              text: true,
            },
          ].map(({ label, value, icon: Icon, text }) => (
            <div
              key={label}
              className="rounded-xl border border-[var(--border)] bg-[var(--background)]/40 px-4 py-3"
            >
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                <Icon className="h-3.5 w-3.5" />
                {label}
              </div>
              <div className={`mt-1 font-bold ${text ? "text-sm text-steel-300" : "text-2xl text-steel-400"}`}>
                {value}
              </div>
            </div>
          ))}
        </div>

        {/* Quick generate */}
        <AnimatedCard glow delay={0}>
          <h2 className="mb-1 flex items-center gap-2 font-semibold">
            <Sparkles className="h-5 w-5 text-steel-400" />
            Generate report
          </h2>
          <p className="mb-4 text-xs text-[var(--muted)]">
            Shift briefing is instant. Equipment reports run the full AI pipeline (may take ~30s).
          </p>

          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                Equipment for AI report
              </label>
              <select
                value={generateEquipment}
                onChange={(e) => setGenerateEquipment(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              >
                {equipmentList.map((eq) => (
                  <option key={eq.equipment_code} value={eq.equipment_code}>
                    {eq.equipment_code} — {eq.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                Filter history by equipment
              </label>
              <select
                value={historyEquipment}
                onChange={(e) => setHistoryEquipment(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              >
                <option value="">All equipment</option>
                {equipmentList.map((eq) => (
                  <option key={eq.equipment_code} value={eq.equipment_code}>
                    {eq.equipment_code}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {REPORT_TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => runTemplate(t.id)}
                disabled={generating !== null || (!t.fast && !generateEquipment)}
                className="rounded-xl border border-[var(--border)] bg-[var(--background)]/50 p-4 text-left transition hover:border-steel-500/40 hover:bg-steel-500/5 disabled:opacity-50"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold">{t.title}</span>
                  {t.fast ? (
                    <span className="rounded-full bg-status-healthy/15 px-2 py-0.5 text-[9px] font-semibold text-status-healthy">
                      Instant
                    </span>
                  ) : (
                    <span className="rounded-full bg-steel-500/15 px-2 py-0.5 text-[9px] font-semibold text-steel-300">
                      AI pipeline
                    </span>
                  )}
                </div>
                <p className="text-[11px] leading-relaxed text-[var(--muted)]">{t.description}</p>
                <div className="mt-3 flex items-center gap-1 text-[11px] font-medium text-steel-400">
                  {generating === t.id ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Generating…
                    </>
                  ) : (
                    <>
                      <Download className="h-3.5 w-3.5" />
                      Generate PDF
                    </>
                  )}
                </div>
              </button>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-[var(--muted)]">
            <span>Also export from</span>
            <Link href="/diagnosis" className="text-steel-400 hover:underline">
              AI Diagnosis
            </Link>
            <span>·</span>
            <Link href="/chat" className="text-steel-400 hover:underline">
              Agentic Chat
            </Link>
            <span>·</span>
            <Link href="/logbook" className="text-steel-400 hover:underline">
              Digital Logbook
            </Link>
          </div>
        </AnimatedCard>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
            <input
              type="search"
              placeholder="Search reports, equipment…"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] py-2 pl-9 pr-3 text-sm"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
          >
            {REPORT_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* History */}
        <AnimatedCard delay={100}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Report history</h2>
            <span className="text-xs text-[var(--muted)]">{reports.length} shown</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-[var(--muted)]">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading reports…
            </div>
          ) : reports.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--border)] py-12 text-center">
              <FileText className="mx-auto mb-2 h-8 w-8 text-[var(--muted)]" />
              <p className="text-sm text-[var(--muted)]">No reports yet.</p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Generate a shift briefing or equipment maintenance report above.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {grouped.map(({ label, items }) => (
                <div key={label}>
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                    <Calendar className="h-3.5 w-3.5" />
                    {label}
                  </div>
                  <div className="space-y-2">
                    {items.map((r) => (
                      <div
                        key={r.id}
                        className="rounded-xl border border-[var(--border)] bg-[var(--background)]/40 transition hover:border-steel-500/30"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3 p-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold">{r.title}</span>
                              <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${reportTypeBadgeClass(r.report_type)}`}>
                                {formatReportType(r.report_type)}
                              </span>
                              {r.risk_level && (
                                <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase ${riskBadgeClass(r.risk_level)}`}>
                                  {r.risk_level}
                                </span>
                              )}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[var(--muted)]">
                              {r.equipment_code && (
                                <Link
                                  href={`/equipment/${r.equipment_code}`}
                                  className="text-steel-400 hover:underline"
                                >
                                  {r.equipment_code}
                                  {r.equipment_name ? ` · ${r.equipment_name}` : ""}
                                </Link>
                              )}
                              <span>{formatRelativeTime(r.created_at)}</span>
                              <span>·</span>
                              <span>{new Date(r.created_at).toLocaleString()}</span>
                            </div>
                            {r.summary_preview && (
                              <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-[var(--muted)]">
                                {r.summary_preview}
                              </p>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => togglePreview(r.id)}
                              className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-[11px] hover:border-steel-500/40"
                            >
                              {expandedId === r.id ? (
                                <ChevronUp className="h-3.5 w-3.5" />
                              ) : (
                                <Eye className="h-3.5 w-3.5" />
                              )}
                              Preview
                            </button>
                            <button
                              type="button"
                              onClick={() => downloadPdf(r.id, r.title)}
                              disabled={downloadingId === r.id}
                              className="inline-flex items-center gap-1 rounded-lg bg-steel-500/20 px-2.5 py-1.5 text-[11px] font-medium text-steel-200 hover:bg-steel-500/30 disabled:opacity-50"
                            >
                              {downloadingId === r.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Download className="h-3.5 w-3.5" />
                              )}
                              PDF
                            </button>
                          </div>
                        </div>

                        {expandedId === r.id && (
                          <div className="border-t border-[var(--border)] px-4 py-3">
                            {previewLoading ? (
                              <div className="flex items-center gap-2 py-4 text-xs text-[var(--muted)]">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Loading preview…
                              </div>
                            ) : summaryText ? (
                              <div className="prose-sm max-w-none text-sm">
                                <MarkdownRenderer content={summaryText.slice(0, 3000)} />
                              </div>
                            ) : (
                              <p className="text-xs text-[var(--muted)]">No summary available for this report.</p>
                            )}
                            {previewActions && (
                                <div className="mt-3 rounded-lg border border-[var(--border)] p-3">
                                  <div className="mb-2 flex items-center gap-1 text-xs font-semibold text-steel-400">
                                    <AlertTriangle className="h-3.5 w-3.5" />
                                    Maintenance actions
                                  </div>
                                  <ul className="space-y-1 text-xs text-[var(--muted)]">
                                    {previewActions.slice(0, 5).map((a, i) => (
                                      <li key={i}>
                                        [{a.priority || "—"}] {a.action}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </AnimatedCard>

        {/* Type breakdown */}
        {Object.keys(stats.by_type).length > 0 && (
          <AnimatedCard delay={150}>
            <h3 className="mb-3 text-sm font-semibold">Reports by type</h3>
            <div className="flex flex-wrap gap-2">
              {Object.entries(stats.by_type).map(([type, count]) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setTypeFilter(type)}
                  className={`rounded-full px-3 py-1 text-xs transition ${
                    typeFilter === type
                      ? "bg-steel-500 text-white"
                      : "border border-[var(--border)] text-[var(--muted)] hover:border-steel-500/40"
                  }`}
                >
                  {formatReportType(type)} ({count})
                </button>
              ))}
            </div>
          </AnimatedCard>
        )}
      </div>
    </AppShell>
  );
}
