"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  LayoutGrid,
  List,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShoppingCart,
  Sparkles,
  Wrench,
  X,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import AnimatedCard from "@/components/AnimatedCard";
import {
  api,
  Equipment,
  SparePart,
  SparePartsSummary,
  SpareRecommendation,
} from "@/lib/api";
import {
  EQUIPMENT_TYPE_LABELS,
  EQUIPMENT_TYPE_OPTIONS,
  QUICK_RESTOCK_PARTS,
  recommendQty,
  stockBadgeClass,
  stockFillPercent,
  stockLabel,
  stockStatus,
  urgencyClass,
} from "@/lib/sparePartsUtils";
import { useToast } from "@/components/ToastProvider";

const EMPTY_NEW = {
  part_code: "",
  name: "",
  equipment_type: "general",
  quantity_requested: 1,
  minimum_stock: 2,
  unit_cost: "",
  supplier: "",
  lead_time_days: 7,
  urgency: "high",
  notes: "",
};

const EMPTY_SUMMARY: SparePartsSummary = {
  total_parts: 0,
  low_stock_count: 0,
  out_of_stock_count: 0,
  healthy_count: 0,
  inventory_value: 0,
  pending_procurement: 0,
  by_equipment_type: {},
  critical_parts: [],
};

export default function SparePartsPage() {
  const [parts, setParts] = useState<SparePart[]>([]);
  const [summary, setSummary] = useState<SparePartsSummary>(EMPTY_SUMMARY);
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [recommendations, setRecommendations] = useState<SpareRecommendation[]>([]);
  const [recMeta, setRecMeta] = useState<{ code?: string; risk?: string; failProb?: number }>({});
  const [lowOnly, setLowOnly] = useState(false);
  const [filterType, setFilterType] = useState("");
  const [filterEquipment, setFilterEquipment] = useState("");
  const [searchText, setSearchText] = useState("");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [loading, setLoading] = useState(true);
  const [recLoading, setRecLoading] = useState(false);
  const [requestingId, setRequestingId] = useState<number | null>(null);
  const [highlightPart, setHighlightPart] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newForm, setNewForm] = useState(EMPTY_NEW);
  const [submittingNew, setSubmittingNew] = useState(false);
  const [qtyModal, setQtyModal] = useState<SparePart | null>(null);
  const [customQty, setCustomQty] = useState(1);
  const highlightRef = useRef<HTMLDivElement | null>(null);
  const { toast } = useToast();
  const searchParams = useSearchParams();

  useEffect(() => {
    const part = searchParams.get("part");
    if (searchParams.get("low_stock") === "1") setLowOnly(true);
    if (searchParams.get("new") === "1") setShowNewForm(true);
    if (part) {
      setHighlightPart(part);
      setSearchText(part);
    }
    const eq = searchParams.get("equipment");
    if (eq) setFilterEquipment(eq);
  }, [searchParams]);

  useEffect(() => {
    api.getEquipment().then(setEquipmentList).catch(() => setEquipmentList([]));
  }, []);

  useEffect(() => {
    if (highlightPart && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightPart, parts]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rows, stats] = await Promise.all([
        api.getSpareParts({
          lowStockOnly: lowOnly,
          equipmentType: filterType || undefined,
          search: searchText.trim() || undefined,
        }),
        api.getSparePartsSummary(),
      ]);
      setParts(rows);
      setSummary(stats);
    } catch {
      setParts([]);
      setSummary(EMPTY_SUMMARY);
    } finally {
      setLoading(false);
    }
  }, [lowOnly, filterType, searchText]);

  const loadRecommendations = useCallback(async (code?: string) => {
    setRecLoading(true);
    try {
      const res = await api.getSpareRecommendations(code || filterEquipment || undefined);
      setRecommendations(res.recommendations);
      setRecMeta({
        code: res.equipment_code,
        risk: res.risk_level,
        failProb: res.failure_probability,
      });
    } catch {
      setRecommendations([]);
    } finally {
      setRecLoading(false);
    }
  }, [filterEquipment]);

  useEffect(() => {
    const t = setTimeout(load, searchText ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, searchText]);

  useEffect(() => {
    loadRecommendations(filterEquipment || undefined);
  }, [filterEquipment, loadRecommendations]);

  const sortedParts = useMemo(() => {
    return [...parts].sort((a, b) => {
      const sa = stockStatus(a);
      const sb = stockStatus(b);
      const order = { out_of_stock: 0, low_stock: 1, healthy: 2 };
      if (order[sa] !== order[sb]) return order[sa] - order[sb];
      return a.part_code.localeCompare(b.part_code);
    });
  }, [parts]);

  const requestProcurement = async (part: SparePart, qty?: number) => {
    setRequestingId(part.id);
    const quantity = qty ?? recommendQty(part);
    try {
      const res = await api.createProcurement({
        spare_part_id: part.id,
        quantity_requested: quantity,
        urgency: part.quantity_available <= 0 ? "critical" : "high",
        notes: `Procurement request for ${part.part_code} — ${part.name}`,
      });
      toast("success", `Request #${res.id} created`, `${part.name} · qty ${quantity}`);
      setQtyModal(null);
      load();
      loadRecommendations();
    } catch (e) {
      toast("error", "Request failed", e instanceof Error ? e.message : "");
    } finally {
      setRequestingId(null);
    }
  };

  const submitNewPart = async () => {
    if (!newForm.part_code.trim() || !newForm.name.trim()) {
      toast("error", "Missing fields", "Part code and name are required");
      return;
    }
    setSubmittingNew(true);
    try {
      const res = await api.requestNewSparePart({
        part_code: newForm.part_code.trim().toUpperCase(),
        name: newForm.name.trim(),
        equipment_type: newForm.equipment_type,
        quantity_requested: newForm.quantity_requested,
        minimum_stock: newForm.minimum_stock,
        unit_cost: newForm.unit_cost ? Number(newForm.unit_cost) : undefined,
        supplier: newForm.supplier || undefined,
        lead_time_days: newForm.lead_time_days,
        urgency: newForm.urgency,
        notes: newForm.notes || `Engineer requested new spare part: ${newForm.part_code}`,
      });
      toast("success", res.message, `Procurement #${res.procurement_id} created`);
      setShowNewForm(false);
      setNewForm(EMPTY_NEW);
      load();
      loadRecommendations();
    } catch (e) {
      toast("error", "Request failed", e instanceof Error ? e.message : "");
    } finally {
      setSubmittingNew(false);
    }
  };

  const jumpToPart = (code: string) => {
    setHighlightPart(code);
    setSearchText(code);
    setLowOnly(false);
  };

  const renderPartActions = (p: SparePart, compact = false) => {
    const status = stockStatus(p);
    return (
      <button
        type="button"
        onClick={() => {
          setQtyModal(p);
          setCustomQty(recommendQty(p));
        }}
        disabled={requestingId === p.id}
        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
          status !== "healthy"
            ? "bg-steel-500 text-white hover:bg-steel-400"
            : "border border-[var(--border)] text-[var(--muted)] hover:border-steel-500/40"
        } ${compact ? "px-2 py-1" : ""}`}
      >
        {requestingId === p.id ? (
          <Loader2 className="inline h-3 w-3 animate-spin" />
        ) : status === "out_of_stock" ? (
          "Order now"
        ) : status === "low_stock" ? (
          "Restock"
        ) : (
          "Request"
        )}
      </button>
    );
  };

  const PartCard = ({ p }: { p: SparePart }) => {
    const status = stockStatus(p);
    const highlighted = highlightPart === p.part_code;
    const fill = stockFillPercent(p);
    return (
      <div
        ref={highlighted ? highlightRef : undefined}
        className={`rounded-xl border bg-[var(--background)]/40 p-4 transition hover:border-steel-500/40 ${
          highlighted ? "border-steel-500 ring-1 ring-steel-500/40" : "border-[var(--border)]"
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-mono text-xs text-steel-400">{p.part_code}</p>
            <p className="mt-0.5 text-sm font-semibold leading-snug">{p.name}</p>
            {p.equipment_type && (
              <p className="mt-1 text-[10px] text-[var(--muted)]">
                {EQUIPMENT_TYPE_LABELS[p.equipment_type] || p.equipment_type}
              </p>
            )}
          </div>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${stockBadgeClass(status)}`}>
            {stockLabel(status)}
          </span>
        </div>
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-[11px] text-[var(--muted)]">
            <span>
              Stock <strong className="text-[var(--foreground)]">{p.quantity_available}</strong> / min {p.minimum_stock}
            </span>
            <span>{fill}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[var(--border)]">
            <div
              className={`h-full rounded-full transition-all ${
                status === "out_of_stock"
                  ? "bg-status-critical"
                  : status === "low_stock"
                    ? "bg-status-warning"
                    : "bg-status-healthy"
              }`}
              style={{ width: `${fill}%` }}
            />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-[var(--muted)]">
          <span>{p.lead_time_days}d lead</span>
          {p.unit_cost != null && <span>₹{p.unit_cost.toLocaleString()}</span>}
          {p.supplier && <span className="truncate">{p.supplier}</span>}
        </div>
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-[var(--border)] pt-3">
          {renderPartActions(p)}
          <Link
            href={`/procurement`}
            className="text-[10px] text-steel-400 hover:text-steel-200"
          >
            Procurement →
          </Link>
        </div>
      </div>
    );
  };

  return (
    <AppShell>
      {/* Modals */}
      {showNewForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">Request new spare part</h3>
              <button type="button" onClick={() => setShowNewForm(false)} className="text-[var(--muted)] hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-4 text-xs text-[var(--muted)]">
              Adds to catalog (qty 0) and creates a procurement request in one step.
            </p>
            <div className="space-y-3 text-sm">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs text-[var(--muted)]">Part code *</span>
                  <input
                    value={newForm.part_code}
                    onChange={(e) => setNewForm({ ...newForm, part_code: e.target.value })}
                    placeholder="BRG-RMM-500"
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-[var(--muted)]">Part name *</span>
                  <input
                    value={newForm.name}
                    onChange={(e) => setNewForm({ ...newForm, name: e.target.value })}
                    placeholder="Bearing Assembly Kit"
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2"
                  />
                </label>
              </div>
              <label className="block">
                <span className="text-xs text-[var(--muted)]">Equipment type</span>
                <select
                  value={newForm.equipment_type}
                  onChange={(e) => setNewForm({ ...newForm, equipment_type: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2"
                >
                  {EQUIPMENT_TYPE_OPTIONS.filter((t) => t.value).map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block">
                  <span className="text-xs text-[var(--muted)]">Qty to order *</span>
                  <input
                    type="number"
                    min={1}
                    value={newForm.quantity_requested}
                    onChange={(e) => setNewForm({ ...newForm, quantity_requested: Number(e.target.value) })}
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-[var(--muted)]">Min stock</span>
                  <input
                    type="number"
                    min={1}
                    value={newForm.minimum_stock}
                    onChange={(e) => setNewForm({ ...newForm, minimum_stock: Number(e.target.value) })}
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-[var(--muted)]">Lead (days)</span>
                  <input
                    type="number"
                    min={1}
                    value={newForm.lead_time_days}
                    onChange={(e) => setNewForm({ ...newForm, lead_time_days: Number(e.target.value) })}
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2"
                  />
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs text-[var(--muted)]">Supplier</span>
                  <input
                    value={newForm.supplier}
                    onChange={(e) => setNewForm({ ...newForm, supplier: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-[var(--muted)]">Unit cost (₹)</span>
                  <input
                    value={newForm.unit_cost}
                    onChange={(e) => setNewForm({ ...newForm, unit_cost: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2"
                  />
                </label>
              </div>
              <label className="block">
                <span className="text-xs text-[var(--muted)]">Notes</span>
                <textarea
                  value={newForm.notes}
                  onChange={(e) => setNewForm({ ...newForm, notes: e.target.value })}
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2"
                />
              </label>
            </div>
            <div className="mt-5 flex gap-2">
              <button
                onClick={submitNewPart}
                disabled={submittingNew}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-steel-500 py-2 text-sm font-medium disabled:opacity-50"
              >
                {submittingNew ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Submit request
              </button>
              <button
                onClick={() => setShowNewForm(false)}
                className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--muted)]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {qtyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
            <h3 className="font-bold">Request {qtyModal.part_code}</h3>
            <p className="mt-1 text-xs text-[var(--muted)]">{qtyModal.name}</p>
            <p className="mt-2 text-[11px] text-[var(--muted)]">
              Current stock {qtyModal.quantity_available} · min {qtyModal.minimum_stock}
            </p>
            <label className="mt-4 block text-sm">
              Quantity
              <input
                type="number"
                min={1}
                value={customQty}
                onChange={(e) => setCustomQty(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2"
              />
            </label>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => requestProcurement(qtyModal, customQty)}
                disabled={requestingId === qtyModal.id}
                className="flex-1 rounded-lg bg-steel-500 py-2 text-sm disabled:opacity-50"
              >
                {requestingId === qtyModal.id ? "Submitting…" : "Submit request"}
              </button>
              <button onClick={() => setQtyModal(null)} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-steel-500/15">
              <Package className="h-5 w-5 text-steel-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Spare Parts Inventory</h1>
              <p className="mt-0.5 text-sm text-[var(--muted)]">
                Stock levels, AI recommendations, and one-click procurement
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
            <Link
              href="/procurement"
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm hover:border-steel-500/40"
            >
              <ShoppingCart className="h-4 w-4" />
              Procurement
              {summary.pending_procurement > 0 && (
                <span className="rounded-full bg-status-warning/20 px-1.5 text-[10px] text-status-warning">
                  {summary.pending_procurement}
                </span>
              )}
            </Link>
            <button
              type="button"
              onClick={() => setShowNewForm(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-steel-500 px-4 py-2 text-sm font-medium"
            >
              <Plus className="h-4 w-4" />
              New part
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--background)]/60 px-4 py-3 text-[11px] leading-relaxed text-[var(--muted)]">
          <strong className="text-[var(--foreground)]">How it works:</strong> Inventory feeds AI Diagnosis
          and Chat spare recommendations. Low stock affects Priority ranking. Click{" "}
          <strong className="text-[var(--foreground)]">Restock</strong> to create a procurement request — approve
          on the Procurement page to update stock.
        </div>

        {/* Stats */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { label: "Total parts", value: summary.total_parts },
            { label: "In stock", value: summary.healthy_count, ok: true },
            { label: "Low stock", value: summary.low_stock_count, warn: true },
            { label: "Out of stock", value: summary.out_of_stock_count, crit: true },
            {
              label: "Inventory value",
              value: `₹${(summary.inventory_value / 1000).toFixed(0)}k`,
            },
          ].map(({ label, value, ok, warn, crit }) => (
            <div
              key={label}
              className={`rounded-xl border px-4 py-3 ${
                crit && summary.out_of_stock_count > 0
                  ? "border-status-critical/30 bg-status-critical/5"
                  : warn && summary.low_stock_count > 0
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

        {/* AI Recommendations */}
        <AnimatedCard delay={0}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="h-4 w-4 text-amber-300" />
              AI spare recommendations
            </h2>
            <select
              value={filterEquipment}
              onChange={(e) => setFilterEquipment(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-xs"
            >
              <option value="">Plant-wide (low stock focus)</option>
              {equipmentList.map((e) => (
                <option key={e.id} value={e.equipment_code}>
                  {e.equipment_code}
                </option>
              ))}
            </select>
          </div>
          {recMeta.code && (
            <p className="mb-3 text-xs text-[var(--muted)]">
              For <strong className="text-[var(--foreground)]">{recMeta.code}</strong>
              {recMeta.risk && (
                <span>
                  {" "}
                  · risk <span className="uppercase text-status-warning">{recMeta.risk}</span>
                </span>
              )}
              {recMeta.failProb != null && recMeta.failProb > 0 && (
                <span> · failure {(recMeta.failProb * 100).toFixed(0)}%</span>
              )}
            </p>
          )}
          {recLoading ? (
            <div className="flex items-center gap-2 py-6 text-sm text-[var(--muted)]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading recommendations…
            </div>
          ) : recommendations.length === 0 ? (
            <p className="py-4 text-sm text-[var(--muted)]">No urgent spare recommendations right now.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {recommendations.slice(0, 6).map((rec) => {
                const part = parts.find((p) => p.part_code === rec.part_code);
                return (
                  <div
                    key={rec.part_code}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] p-3"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold">{rec.part ?? rec.part_code}</span>
                        {rec.urgency && (
                          <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase ${urgencyClass(rec.urgency)}`}>
                            {rec.urgency}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[10px] text-[var(--muted)]">
                        {rec.part_code} · qty {rec.quantity_recommended} · {rec.lead_time_days}d lead
                      </p>
                      {rec.rationale && (
                        <p className="mt-1 text-[10px] text-[var(--muted)]">{rec.rationale}</p>
                      )}
                    </div>
                    {part ? (
                      <button
                        type="button"
                        onClick={() => requestProcurement(part, rec.quantity_recommended)}
                        disabled={requestingId === part.id}
                        className="shrink-0 rounded-lg bg-steel-500 px-2.5 py-1 text-[10px] font-semibold disabled:opacity-50"
                      >
                        Request
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => rec.part_code && jumpToPart(rec.part_code)}
                        className="shrink-0 text-[10px] text-steel-400 hover:underline"
                      >
                        Find
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {filterEquipment && (
            <Link
              href={`/chat?equipment=${encodeURIComponent(filterEquipment)}`}
              className="mt-3 inline-flex items-center gap-1 text-xs text-status-healthy hover:underline"
            >
              Ask AI which spares {filterEquipment} needs
              <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </AnimatedCard>

        {/* Critical + quick */}
        {summary.critical_parts.length > 0 && (
          <AnimatedCard delay={25}>
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-status-warning">
              <AlertTriangle className="h-4 w-4" />
              Critical stock alerts
            </h2>
            <div className="flex flex-wrap gap-2">
              {summary.critical_parts.map((c) => (
                <button
                  key={c.part_code}
                  type="button"
                  onClick={() => jumpToPart(c.part_code)}
                  className="rounded-lg border border-status-warning/30 bg-status-warning/10 px-3 py-2 text-left text-xs hover:bg-status-warning/15"
                >
                  <span className="font-mono font-semibold">{c.part_code}</span>
                  <span className="ml-2 text-status-warning">
                    {c.quantity_available}/{c.minimum_stock}
                  </span>
                </button>
              ))}
            </div>
          </AnimatedCard>
        )}

        {/* Inventory */}
        <AnimatedCard delay={50}>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-[200px] flex-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                Search parts
              </label>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
                <input
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Part code, name, supplier…"
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] py-2 pl-9 pr-3 text-sm"
                />
              </div>
            </div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            >
              {EQUIPMENT_TYPE_OPTIONS.map((t) => (
                <option key={t.value || "all"} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
              <input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} />
              Low stock only
            </label>
            <div className="flex rounded-lg border border-[var(--border)] p-0.5">
              <button
                type="button"
                onClick={() => setViewMode("cards")}
                className={`rounded-md p-1.5 ${viewMode === "cards" ? "bg-steel-500/30" : ""}`}
                title="Card view"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`rounded-md p-1.5 ${viewMode === "table" ? "bg-steel-500/30" : ""}`}
                title="Table view"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="mb-3 flex flex-wrap gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              Quick find:
            </span>
            {QUICK_RESTOCK_PARTS.map((q) => (
              <button
                key={q.code}
                type="button"
                onClick={() => jumpToPart(q.code)}
                className="rounded-full border border-[var(--border)] px-2.5 py-0.5 text-[10px] hover:border-steel-500/40"
              >
                {q.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-[var(--muted)]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading inventory…
            </div>
          ) : sortedParts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--border)] p-8 text-center">
              <p className="text-sm text-[var(--muted)]">No parts match your filters.</p>
              <button
                type="button"
                onClick={() => setShowNewForm(true)}
                className="mt-3 text-sm text-steel-400 hover:underline"
              >
                Request a new spare part
              </button>
            </div>
          ) : viewMode === "cards" ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {sortedParts.map((p) => (
                <PartCard key={p.id} p={p} />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted)]">
                    <th className="p-2">Code</th>
                    <th className="p-2">Name</th>
                    <th className="p-2">Stock</th>
                    <th className="p-2">Status</th>
                    <th className="p-2">Lead</th>
                    <th className="p-2">Cost</th>
                    <th className="p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedParts.map((p) => {
                    const status = stockStatus(p);
                    const highlighted = highlightPart === p.part_code;
                    return (
                      <tr
                        key={p.id}
                        ref={highlighted ? (el) => { highlightRef.current = el; } : undefined}
                        className={`border-b border-[var(--border)]/50 hover:bg-steel-500/5 ${
                          highlighted ? "bg-steel-500/15" : ""
                        }`}
                      >
                        <td className="p-2 font-mono text-xs">{p.part_code}</td>
                        <td className="p-2">{p.name}</td>
                        <td className="p-2 font-semibold">
                          {p.quantity_available}
                          <span className="text-[var(--muted)]"> / {p.minimum_stock}</span>
                        </td>
                        <td className="p-2">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] ${stockBadgeClass(status)}`}>
                            {stockLabel(status)}
                          </span>
                        </td>
                        <td className="p-2">{p.lead_time_days}d</td>
                        <td className="p-2">₹{p.unit_cost?.toLocaleString() ?? "—"}</td>
                        <td className="p-2">{renderPartActions(p, true)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </AnimatedCard>

        {/* By equipment type breakdown */}
        {Object.keys(summary.by_equipment_type).length > 0 && (
          <AnimatedCard delay={75}>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Wrench className="h-4 w-4 text-steel-400" />
              Stock by equipment type
            </h3>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(summary.by_equipment_type).map(([type, stats]) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setFilterType(type)}
                  className={`rounded-xl border p-3 text-left transition hover:border-steel-500/40 ${
                    filterType === type ? "border-steel-500/50 bg-steel-500/10" : "border-[var(--border)]"
                  }`}
                >
                  <div className="text-sm font-semibold">
                    {EQUIPMENT_TYPE_LABELS[type] || type}
                  </div>
                  <div className="mt-1 flex gap-3 text-[11px] text-[var(--muted)]">
                    <span>{stats.total} parts</span>
                    {stats.low > 0 && <span className="text-status-warning">{stats.low} low</span>}
                    {stats.out > 0 && <span className="text-status-critical">{stats.out} out</span>}
                  </div>
                </button>
              ))}
            </div>
          </AnimatedCard>
        )}
      </div>
    </AppShell>
  );
}
