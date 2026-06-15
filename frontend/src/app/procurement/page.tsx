"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Download,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShoppingCart,
  XCircle,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import AnimatedCard from "@/components/AnimatedCard";
import { api, ProcurementItem, ProcurementSummary } from "@/lib/api";
import {
  formatStatus,
  groupProcurementByDate,
  sortProcurement,
  STATUS_OPTIONS,
  statusBadgeClass,
  URGENCY_OPTIONS,
  urgencyBadgeClass,
} from "@/lib/procurementUtils";
import { useToast } from "@/components/ToastProvider";

const EMPTY_SUMMARY: ProcurementSummary = {
  total_requests: 0,
  pending: 0,
  approved: 0,
  rejected: 0,
  critical_pending: 0,
  pending_estimated_cost: 0,
  by_status: {},
  by_urgency_pending: {},
};

export default function ProcurementPage() {
  const [requests, setRequests] = useState<ProcurementItem[]>([]);
  const [summary, setSummary] = useState<ProcurementSummary>(EMPTY_SUMMARY);
  const [statusFilter, setStatusFilter] = useState("all");
  const [urgencyFilter, setUrgencyFilter] = useState("");
  const [searchText, setSearchText] = useState("");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [bulkApproving, setBulkApproving] = useState(false);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actingId, setActingId] = useState<number | null>(null);
  const { toast } = useToast();
  const searchParams = useSearchParams();

  useEffect(() => {
    const status = searchParams.get("status");
    if (status && ["pending", "approved", "rejected"].includes(status)) {
      setStatusFilter(status);
    }
  }, [searchParams]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rows, stats] = await Promise.all([
        api.getProcurement({
          status: statusFilter === "all" ? undefined : statusFilter,
          urgency: urgencyFilter || undefined,
          search: searchText.trim() || undefined,
          limit: 100,
        }),
        api.getProcurementSummary(),
      ]);
      setRequests(rows);
      setSummary(stats);
    } catch {
      setRequests([]);
      setSummary(EMPTY_SUMMARY);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, urgencyFilter, searchText]);

  useEffect(() => {
    const t = setTimeout(load, searchText ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, searchText]);

  const sorted = useMemo(() => sortProcurement(requests), [requests]);
  const grouped = useMemo(() => groupProcurementByDate(sorted), [sorted]);
  const pendingItems = useMemo(() => sorted.filter((r) => r.status === "pending"), [sorted]);

  const approve = async (id: number) => {
    setActingId(id);
    try {
      await api.approveProcurement(id);
      toast("success", `Request #${id} approved`, "Stock updated on Spare Parts");
      load();
    } catch (e) {
      toast("error", "Approve failed", e instanceof Error ? e.message : "");
    } finally {
      setActingId(null);
    }
  };

  const reject = async (id: number) => {
    setActingId(id);
    try {
      await api.rejectProcurement(id, rejectReason.trim() || undefined);
      toast("success", `Request #${id} rejected`);
      setRejectingId(null);
      setRejectReason("");
      load();
    } catch (e) {
      toast("error", "Reject failed", e instanceof Error ? e.message : "");
    } finally {
      setActingId(null);
    }
  };

  const approveAllPending = async (urgency?: string) => {
    setBulkApproving(true);
    try {
      const res = await api.approveAllPendingProcurement(urgency);
      toast("success", res.message, `${res.approved} approved`);
      load();
    } catch (e) {
      toast("error", "Bulk approve failed", e instanceof Error ? e.message : "");
    } finally {
      setBulkApproving(false);
    }
  };

  const exportPdf = async () => {
    setExporting(true);
    try {
      const blob = await api.exportProcurementPdf(
        statusFilter === "all" ? undefined : statusFilter
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Procurement_${statusFilter}_${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast("success", "Procurement PDF downloaded");
    } catch (e) {
      toast("error", "Export failed", e instanceof Error ? e.message : "");
    } finally {
      setExporting(false);
    }
  };

  const RequestCard = ({ r }: { r: ProcurementItem }) => (
    <div
      className={`rounded-xl border p-4 transition hover:border-steel-500/30 ${
        r.status === "pending" && r.urgency === "critical"
          ? "border-status-critical/40 bg-status-critical/5"
          : r.status === "pending"
            ? "border-status-warning/25 bg-[var(--background)]/50"
            : "border-[var(--border)] bg-[var(--background)]/40"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold">#{r.id}</span>
            {r.part_code && (
              <Link
                href={`/spare-parts?part=${encodeURIComponent(r.part_code)}`}
                className="font-mono text-xs text-steel-400 hover:text-steel-200"
              >
                {r.part_code}
              </Link>
            )}
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusBadgeClass(r.status)}`}>
              {formatStatus(r.status)}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${urgencyBadgeClass(r.urgency)}`}>
              {r.urgency}
            </span>
          </div>
          {r.part_name && <p className="mt-1 text-sm font-medium">{r.part_name}</p>}
          <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-[var(--muted)]">
            <span>
              Qty <strong className="text-[var(--foreground)]">{r.quantity_requested}</strong>
            </span>
            {r.lead_time_days != null && <span>{r.lead_time_days}d lead</span>}
            {r.estimated_cost != null && (
              <span>Est. ₹{r.estimated_cost.toLocaleString()}</span>
            )}
            {r.created_at && (
              <span>{new Date(r.created_at).toLocaleString()}</span>
            )}
          </div>
          {r.notes && (
            <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-[var(--muted)]">{r.notes}</p>
          )}
        </div>

        {r.status === "pending" && rejectingId !== r.id && (
          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              onClick={() => approve(r.id)}
              disabled={actingId === r.id}
              className="flex items-center gap-1 rounded-lg bg-status-healthy px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
            >
              {actingId === r.id ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <CheckCircle className="h-3 w-3" />
              )}
              Approve
            </button>
            <button
              type="button"
              onClick={() => {
                setRejectingId(r.id);
                setRejectReason("");
              }}
              disabled={actingId === r.id}
              className="flex items-center gap-1 rounded-lg border border-status-critical/40 bg-status-critical/10 px-3 py-1.5 text-xs text-status-critical disabled:opacity-50"
            >
              <XCircle className="h-3 w-3" />
              Reject
            </button>
          </div>
        )}

        {r.status === "approved" && (
          <span className="flex items-center gap-1 text-xs text-status-healthy">
            <CheckCircle className="h-3.5 w-3.5" />
            Stock updated
          </span>
        )}
        {r.status === "rejected" && (
          <span className="flex items-center gap-1 text-xs text-status-critical">
            <XCircle className="h-3.5 w-3.5" />
            Rejected
          </span>
        )}
      </div>

      {rejectingId === r.id && (
        <div className="mt-3 rounded-lg border border-status-critical/30 bg-status-critical/5 p-3">
          <p className="mb-2 text-xs text-status-critical">Rejection reason (optional)</p>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Duplicate request, budget hold, wrong specification…"
            className="mb-2 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-xs"
            rows={2}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => reject(r.id)}
              disabled={actingId === r.id}
              className="rounded-lg bg-status-critical px-3 py-1 text-xs text-white disabled:opacity-50"
            >
              Confirm reject
            </button>
            <button
              type="button"
              onClick={() => {
                setRejectingId(null);
                setRejectReason("");
              }}
              className="rounded-lg border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <AppShell>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-steel-500/15">
              <ShoppingCart className="h-5 w-5 text-steel-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Procurement</h1>
              <p className="mt-0.5 text-sm text-[var(--muted)]">
                Approve spare-part orders and update inventory stock
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => load()}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={exportPdf}
              disabled={exporting || requests.length === 0}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm disabled:opacity-50"
            >
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Export PDF
            </button>
            <Link
              href="/spare-parts?new=1"
              className="inline-flex items-center gap-2 rounded-lg bg-steel-500 px-4 py-2 text-sm font-medium"
            >
              <Plus className="h-4 w-4" />
              New request
            </Link>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--background)]/60 px-4 py-3 text-[11px] leading-relaxed text-[var(--muted)]">
          <strong className="text-[var(--foreground)]">Workflow:</strong> Engineers create requests from{" "}
          <Link href="/spare-parts" className="text-steel-400 hover:underline">
            Spare Parts
          </Link>{" "}
          or AI Chat. Supervisors <strong className="text-[var(--foreground)]">Approve</strong> here — stock
          increases automatically. <strong className="text-[var(--foreground)]">Reject</strong> with an optional
          reason for audit trail.
        </div>

        {/* Stats */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { label: "Total requests", value: summary.total_requests },
            { label: "Pending", value: summary.pending, warn: true },
            { label: "Critical pending", value: summary.critical_pending, crit: true },
            { label: "Approved", value: summary.approved, ok: true },
            {
              label: "Pending value",
              value: summary.pending_estimated_cost
                ? `₹${(summary.pending_estimated_cost / 1000).toFixed(1)}k`
                : "—",
            },
          ].map(({ label, value, ok, warn, crit }) => (
            <div
              key={label}
              className={`rounded-xl border px-4 py-3 ${
                crit && summary.critical_pending > 0
                  ? "border-status-critical/30 bg-status-critical/5"
                  : warn && summary.pending > 0
                    ? "border-status-warning/30 bg-status-warning/5"
                    : "border-[var(--border)] bg-[var(--background)]/50"
              }`}
            >
              <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                {label}
              </div>
              <div
                className={`mt-1 text-2xl font-bold ${
                  ok ? "text-status-healthy" : crit ? "text-status-critical" : warn ? "text-status-warning" : ""
                }`}
              >
                {value}
              </div>
            </div>
          ))}
        </div>

        {/* Pending queue actions */}
        {summary.pending > 0 && (
          <AnimatedCard delay={0}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-status-warning">
                <Clock className="h-4 w-4" />
                Pending approval queue ({summary.pending})
              </h2>
              <div className="flex flex-wrap gap-2">
                {summary.critical_pending > 0 && (
                  <button
                    type="button"
                    onClick={() => approveAllPending("critical")}
                    disabled={bulkApproving}
                    className="rounded-lg border border-status-critical/40 bg-status-critical/15 px-3 py-1.5 text-xs font-medium text-status-critical disabled:opacity-50"
                  >
                    {bulkApproving ? "Approving…" : `Approve ${summary.critical_pending} critical`}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => approveAllPending()}
                  disabled={bulkApproving}
                  className="rounded-lg bg-status-healthy px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                >
                  {bulkApproving ? "Approving…" : `Approve all ${summary.pending} pending`}
                </button>
              </div>
            </div>
            {summary.critical_pending > 0 && (
              <p className="mt-2 flex items-center gap-1 text-xs text-status-critical">
                <AlertTriangle className="h-3.5 w-3.5" />
                {summary.critical_pending} critical request(s) need immediate approval
              </p>
            )}
          </AnimatedCard>
        )}

        {/* Filters */}
        <AnimatedCard delay={25}>
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <div className="min-w-[200px] flex-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                Search
              </label>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
                <input
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Request #, part code, notes…"
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] py-2 pl-9 pr-3 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                Status
              </label>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {STATUS_OPTIONS.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setStatusFilter(s.value)}
                    className={`rounded-full px-3 py-1 text-xs capitalize transition ${
                      statusFilter === s.value
                        ? "bg-steel-500 text-white"
                        : "border border-[var(--border)] text-[var(--muted)]"
                    }`}
                  >
                    {s.label}
                    {s.value !== "all" && summary.by_status[s.value] != null && (
                      <span className="ml-1 opacity-70">({summary.by_status[s.value]})</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
            <select
              value={urgencyFilter}
              onChange={(e) => setUrgencyFilter(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            >
              {URGENCY_OPTIONS.map((u) => (
                <option key={u.value || "all"} value={u.value}>
                  {u.label}
                </option>
              ))}
            </select>
          </div>

          {Object.keys(summary.by_urgency_pending).length > 0 && statusFilter !== "approved" && (
            <div className="mb-4 flex flex-wrap gap-2">
              {Object.entries(summary.by_urgency_pending).map(([urgency, count]) => (
                <button
                  key={urgency}
                  type="button"
                  onClick={() => {
                    setStatusFilter("pending");
                    setUrgencyFilter(urgency);
                  }}
                  className={`rounded-full px-2.5 py-1 text-[10px] font-medium uppercase ${urgencyBadgeClass(urgency)}`}
                >
                  {urgency} pending ({count})
                </button>
              ))}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-[var(--muted)]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading requests…
            </div>
          ) : sorted.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--border)] p-8 text-center">
              <Package className="mx-auto h-8 w-8 text-[var(--muted)]" />
              <p className="mt-3 text-sm text-[var(--muted)]">No procurement requests match your filters.</p>
              <Link href="/spare-parts" className="mt-3 inline-block text-sm text-steel-400 hover:underline">
                Go to Spare Parts to create a request →
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              {grouped.map((group) => (
                <div key={group.label}>
                  <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                    {group.label}
                  </div>
                  <div className="space-y-3">
                    {group.items.map((r) => (
                      <RequestCard key={r.id} r={r} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </AnimatedCard>

        {/* Quick links */}
        <div className="flex flex-wrap gap-3 text-xs">
          <Link href="/spare-parts?low_stock=1" className="text-steel-400 hover:underline">
            View low-stock parts →
          </Link>
          <Link href="/priority" className="text-steel-400 hover:underline">
            Priority queue →
          </Link>
          {pendingItems.length > 0 && (
            <span className="text-[var(--muted)]">
              {pendingItems.length} awaiting your approval
            </span>
          )}
        </div>
      </div>
    </AppShell>
  );
}
