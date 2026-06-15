"use client";

import Link from "next/link";
import {
  AlertTriangle,
  BookOpen,
  ClipboardList,
  Loader2,
  Package,
  Sparkles,
  Target,
  ThumbsDown,
  ThumbsUp,
  Wrench,
} from "lucide-react";
import DownloadReportButton from "@/components/DownloadReportButton";
import { ChatResponse } from "@/lib/api";
import { payloadFromChatResponse } from "@/lib/diagnosisReport";

type Tab = "causes" | "actions" | "spares";

interface DiagnosisInsightPanelProps {
  response: ChatResponse;
  equipmentCode: string;
  equipmentName?: string;
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  feedbackSent: boolean;
  savingLogbook: boolean;
  requestingPart: string | null;
  onFeedback: (type: "confirmation" | "rejection") => void;
  onSaveLogbook: () => void;
  onRequestPart: (partCode: string, partName: string) => void;
}

export default function DiagnosisInsightPanel({
  response,
  equipmentCode,
  equipmentName,
  activeTab,
  onTabChange,
  feedbackSent,
  savingLogbook,
  requestingPart,
  onFeedback,
  onSaveLogbook,
  onRequestPart,
}: DiagnosisInsightPanelProps) {
  const tabs: { id: Tab; label: string; icon: typeof Target; count: number }[] = [
    { id: "causes", label: "Causes", icon: Target, count: response.probable_causes?.length ?? 0 },
    { id: "actions", label: "Actions", icon: Wrench, count: response.maintenance_actions?.length ?? 0 },
    { id: "spares", label: "Spares", icon: Package, count: response.spare_recommendations?.length ?? 0 },
  ];

  const risk = response.risk_level || "medium";
  const isUrgent = risk === "critical" || risk === "high";
  const reportPayload = payloadFromChatResponse(response, equipmentCode, equipmentName);

  return (
    <div className="chat-insight-panel flex h-full max-h-[calc(100vh-12rem)] flex-col overflow-hidden rounded-2xl">
      <div className="chat-insight-header shrink-0 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-bold">
              <Sparkles className="h-4 w-4 text-status-healthy" />
              Structured insights
            </h3>
            <p className="mt-0.5 text-[11px] text-[var(--muted)]">Causes · actions · spares</p>
          </div>
          <span className={`risk-${risk} rounded-full border border-current/30 px-2 py-0.5 text-[10px] font-bold uppercase`}>
            {risk}
          </span>
        </div>
        <div className="mt-2">
          <DownloadReportButton payload={reportPayload} compact />
        </div>
      </div>

      {isUrgent && (
        <div className="chat-emergency-banner mx-4 shrink-0 rounded-xl px-3 py-2 text-xs">
          <div className="flex items-center gap-2 font-semibold uppercase tracking-wide">
            <AlertTriangle className="h-4 w-4" />
            Review actions promptly
          </div>
        </div>
      )}

      <div className="grid shrink-0 grid-cols-3 gap-1.5 border-b border-[var(--border)] p-3">
        {tabs.map(({ id, label, icon: Icon, count }) => (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            className={`chat-insight-tab flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-[10px] font-semibold ${
              activeTab === id ? "chat-insight-tab--active" : "text-[var(--muted)] hover:bg-[var(--surface-elevated)]"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
            {count > 0 && (
              <span className="rounded-full bg-status-healthy/20 px-1.5 py-0.5 text-[9px] text-status-healthy">
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {activeTab === "causes" && (
          <div className="space-y-2">
            {(response.probable_causes ?? []).map((c, idx) => (
              <div key={idx} className="chat-insight-card rounded-xl p-3 text-xs">
                <div className="mb-1 flex items-start justify-between gap-2">
                  <span className="font-semibold leading-snug">{c.cause}</span>
                  <span className="chat-confidence-pill shrink-0 rounded-lg px-2 py-0.5 font-mono text-[10px]">
                    {(c.confidence * 100).toFixed(0)}%
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed text-[var(--muted)]">{c.evidence}</p>
              </div>
            ))}
            {!response.probable_causes?.length && (
              <p className="py-6 text-center text-xs text-[var(--muted)]">No root causes identified.</p>
            )}
          </div>
        )}

        {activeTab === "actions" && (
          <div className="space-y-2">
            {(response.maintenance_actions ?? []).map((a, idx) => (
              <div key={idx} className="chat-insight-card rounded-xl p-3 text-xs">
                <span className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-bold uppercase risk-${a.priority}`}>
                  {a.priority}
                </span>
                <p className="mt-2 font-semibold leading-snug">{a.action}</p>
                <p className="mt-1 text-[11px] text-[var(--muted)]">
                  {a.timeframe} — {a.rationale}
                </p>
              </div>
            ))}
            {!response.maintenance_actions?.length && (
              <p className="py-6 text-center text-xs text-[var(--muted)]">No actions recommended.</p>
            )}
          </div>
        )}

        {activeTab === "spares" && (
          <div className="space-y-2">
            {(response.spare_recommendations ?? []).map((s, idx) => {
              const rec = s as {
                part_code?: string;
                part?: string;
                quantity_recommended?: number;
                lead_time_days?: number;
              };
              return (
                <div
                  key={idx}
                  className="chat-insight-card flex items-center justify-between gap-2 rounded-xl p-3 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-semibold">{rec.part ?? rec.part_code}</p>
                    <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                      {rec.part_code} · Qty {rec.quantity_recommended} · {rec.lead_time_days}d lead
                    </p>
                  </div>
                  {rec.part_code && (
                    <button
                      onClick={() => onRequestPart(rec.part_code!, rec.part ?? rec.part_code!)}
                      disabled={requestingPart === rec.part_code}
                      className="chat-send-btn shrink-0 rounded-lg px-2.5 py-1 text-[10px] font-semibold disabled:opacity-50"
                    >
                      {requestingPart === rec.part_code ? "..." : "Request"}
                    </button>
                  )}
                </div>
              );
            })}
            {!response.spare_recommendations?.length && (
              <p className="py-6 text-center text-xs text-[var(--muted)]">No spare parts suggested.</p>
            )}
          </div>
        )}
      </div>

      <div className="flex shrink-0 flex-wrap gap-1.5 border-t border-[var(--border)] bg-[var(--surface-elevated)]/50 p-3">
        <button
          onClick={() => onFeedback("confirmation")}
          disabled={feedbackSent}
          className="flex items-center gap-1 rounded-lg border border-status-healthy/40 bg-status-healthy/10 px-2.5 py-1 text-[10px] font-medium text-status-healthy disabled:opacity-50"
        >
          <ThumbsUp className="h-3 w-3" /> Helpful
        </button>
        <button
          onClick={() => onFeedback("rejection")}
          disabled={feedbackSent}
          className="flex items-center gap-1 rounded-lg border border-status-critical/40 bg-status-critical/10 px-2.5 py-1 text-[10px] font-medium text-status-critical disabled:opacity-50"
        >
          <ThumbsDown className="h-3 w-3" /> Not helpful
        </button>
        <button
          onClick={onSaveLogbook}
          disabled={savingLogbook}
          className="flex items-center gap-1 rounded-lg border border-[var(--border)] px-2.5 py-1 text-[10px] font-medium text-[var(--muted)] disabled:opacity-50"
        >
          {savingLogbook ? <Loader2 className="h-3 w-3 animate-spin" /> : <ClipboardList className="h-3 w-3" />}
          Save
        </button>
        <Link
          href={`/logbook?equipment=${encodeURIComponent(equipmentCode)}`}
          className="flex items-center gap-1 rounded-lg border border-[var(--border)] px-2.5 py-1 text-[10px] font-medium text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          <BookOpen className="h-3 w-3" /> Logbook
        </Link>
      </div>
    </div>
  );
}
