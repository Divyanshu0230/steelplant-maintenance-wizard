import type { ProcurementItem } from "@/lib/api";

export const URGENCY_OPTIONS = [
  { value: "", label: "All urgency" },
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
] as const;

export const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
] as const;

export function statusBadgeClass(status: string): string {
  const s = status.toLowerCase();
  if (s === "approved") return "bg-status-healthy/15 text-status-healthy";
  if (s === "rejected") return "bg-status-critical/15 text-status-critical";
  return "bg-status-warning/15 text-status-warning";
}

export function urgencyBadgeClass(urgency: string): string {
  const u = urgency.toLowerCase();
  if (u === "critical") return "bg-status-critical/15 text-status-critical";
  if (u === "high") return "bg-status-warning/15 text-status-warning";
  if (u === "medium") return "bg-steel-500/15 text-steel-300";
  return "bg-[var(--border)]/60 text-[var(--muted)]";
}

export function formatStatus(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function groupProcurementByDate(
  items: ProcurementItem[]
): { label: string; items: ProcurementItem[] }[] {
  const groups = new Map<string, ProcurementItem[]>();
  for (const item of items) {
    if (!item.created_at) continue;
    const d = new Date(item.created_at);
    const key = d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const list = groups.get(key) || [];
    list.push(item);
    groups.set(key, list);
  }
  return Array.from(groups.entries()).map(([label, rows]) => ({ label, items: rows }));
}

export function sortProcurement(items: ProcurementItem[]): ProcurementItem[] {
  const urgencyOrder: Record<string, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  return [...items].sort((a, b) => {
    if (a.status === "pending" && b.status !== "pending") return -1;
    if (b.status === "pending" && a.status !== "pending") return 1;
    const ua = urgencyOrder[a.urgency?.toLowerCase() || "medium"] ?? 2;
    const ub = urgencyOrder[b.urgency?.toLowerCase() || "medium"] ?? 2;
    if (ua !== ub) return ua - ub;
    return (b.created_at || "").localeCompare(a.created_at || "");
  });
}
