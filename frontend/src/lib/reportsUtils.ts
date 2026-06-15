import type { ReportSummary } from "@/lib/api";

export const REPORT_TYPE_OPTIONS = [
  { value: "", label: "All types" },
  { value: "maintenance_summary", label: "Maintenance summary" },
  { value: "shift_briefing", label: "Shift briefing" },
  { value: "diagnosis_export", label: "Diagnosis export" },
] as const;

export const REPORT_TEMPLATES = [
  {
    id: "shift",
    title: "Shift handover briefing",
    description: "Plant-wide alerts, logbook & priorities — instant PDF",
    reportType: "shift_briefing" as const,
    icon: "briefing",
    fast: true,
    preferCritical: false,
  },
  {
    id: "maintenance",
    title: "Equipment maintenance report",
    description: "Full AI diagnosis with RCA, RUL, actions & spares",
    reportType: "maintenance_summary" as const,
    icon: "maintenance",
    fast: false,
    preferCritical: false,
  },
  {
    id: "critical",
    title: "Critical asset review",
    description: "Deep-dive report for high-criticality equipment",
    reportType: "maintenance_summary" as const,
    icon: "critical",
    fast: false,
    preferCritical: true,
  },
] as const;

export function formatReportType(type: string): string {
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function reportTypeBadgeClass(type: string): string {
  const t = type.toLowerCase();
  if (t === "shift_briefing") return "bg-steel-500/15 text-steel-300";
  if (t === "diagnosis_export") return "bg-status-warning/15 text-status-warning";
  return "bg-status-healthy/15 text-status-healthy";
}

export function riskBadgeClass(risk?: string): string {
  const r = (risk || "medium").toLowerCase();
  if (r === "critical") return "bg-status-critical/15 text-status-critical";
  if (r === "high") return "bg-status-warning/15 text-status-warning";
  if (r === "low") return "bg-status-healthy/15 text-status-healthy";
  return "bg-steel-500/15 text-steel-300";
}

export function groupReportsByDate(
  reports: ReportSummary[]
): { label: string; items: ReportSummary[] }[] {
  const groups = new Map<string, ReportSummary[]>();
  for (const report of reports) {
    if (!report.created_at) continue;
    const d = new Date(report.created_at);
    const key = d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const list = groups.get(key) || [];
    list.push(report);
    groups.set(key, list);
  }
  return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
}

export function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
