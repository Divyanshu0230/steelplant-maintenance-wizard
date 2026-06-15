"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardCopy,
  MessageSquare,
  NotebookPen,
  RotateCcw,
  Users,
} from "lucide-react";
import SectionHelp from "@/components/SectionHelp";
import { api } from "@/lib/api";
import {
  clearHandoverReview,
  getHandoverNotes,
  handoverFingerprint,
  isHandoverReviewedFor,
  saveHandoverNotes,
  saveHandoverReview,
} from "@/lib/shiftHandover";
import { useToast } from "@/components/ToastProvider";

export interface ShiftAlert {
  equipment_code: string;
  level: string;
  title: string;
  created_at?: string;
}

interface ShiftHandoverPanelProps {
  alertCount: number;
  criticalCount: number;
  logbookEntries: number;
  bottleneckCode: string | null;
  criticalAlerts: ShiftAlert[];
  recommendedAction: string;
  onFocusEquipment: (code: string) => void;
  onScrollToEvents: () => void;
  onHandoverSubmitted?: () => void;
}

export default function ShiftHandoverPanel({
  alertCount,
  criticalCount,
  logbookEntries,
  bottleneckCode,
  criticalAlerts,
  recommendedAction,
  onFocusEquipment,
  onScrollToEvents,
  onHandoverSubmitted,
}: ShiftHandoverPanelProps) {
  const { toast } = useToast();
  const [notes, setNotes] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [completedAt, setCompletedAt] = useState<string | null>(null);
  const [savedToLogbook, setSavedToLogbook] = useState(false);

  const fingerprint = useMemo(
    () => handoverFingerprint(alertCount, criticalCount, bottleneckCode, criticalAlerts),
    [alertCount, criticalCount, bottleneckCode, criticalAlerts]
  );

  const syncReviewState = useCallback(() => {
    const record = isHandoverReviewedFor(fingerprint);
    if (record) {
      setCompletedAt(record.reviewedAt);
      setSavedToLogbook(record.logbookSaved);
      setNotes("");
      setConfirmed(false);
    } else {
      setCompletedAt(null);
      setSavedToLogbook(false);
      setNotes(getHandoverNotes());
    }
  }, [fingerprint]);

  useEffect(() => {
    syncReviewState();
  }, [syncReviewState]);

  const saveNotes = (value: string) => {
    setNotes(value);
    saveHandoverNotes(value);
  };

  const buildSummary = () =>
    [
      "=== Shift Handover Summary ===",
      `Alerts: ${alertCount} (${criticalCount} critical)`,
      `Logbook entries (8h): ${logbookEntries}`,
      bottleneckCode ? `Bottleneck: ${bottleneckCode}` : "",
      "",
      "Critical items:",
      ...criticalAlerts.map((a) => `- [${a.level}] ${a.equipment_code}: ${a.title}`),
      "",
      `Recommended: ${recommendedAction}`,
      notes.trim() ? `\nEngineer notes:\n${notes.trim()}` : "",
    ]
      .filter(Boolean)
      .join("\n");

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(buildSummary());
      toast("success", "Copied", "Handover summary copied to clipboard");
    } catch {
      toast("error", "Copy failed", "Could not access clipboard");
    }
  };

  const submitHandover = async () => {
    if (!confirmed) {
      toast("info", "Confirm first", "Check the box to confirm you reviewed this handover");
      return;
    }
    setSubmitting(true);
    const summary = buildSummary();
    const equipmentCode =
      bottleneckCode || criticalAlerts[0]?.equipment_code || "RM-MOTOR-03";
    let logbookOk = false;

    try {
      await api.createLogbookEntry({
        equipment_code: equipmentCode,
        maintenance_type: "shift_handover",
        description: summary.slice(0, 2000),
        parts_used: "",
      });
      logbookOk = true;
    } catch {
      logbookOk = false;
    }

    const reviewedAt = new Date().toISOString();
    saveHandoverReview({
      fingerprint,
      reviewedAt,
      logbookSaved: logbookOk,
      alertCount,
      criticalCount,
      bottleneckCode,
    });
    saveHandoverNotes("");
    setNotes("");
    setConfirmed(false);
    setCompletedAt(reviewedAt);
    setSavedToLogbook(logbookOk);
    onHandoverSubmitted?.();

    toast(
      "success",
      "Handover submitted",
      logbookOk
        ? "Saved to Logbook — alerts cleared from this panel until new shift data"
        : "Marked complete locally — could not save to logbook API"
    );
    setSubmitting(false);
  };

  const resetHandover = () => {
    clearHandoverReview();
    setCompletedAt(null);
    setSavedToLogbook(false);
    setNotes("");
    setConfirmed(false);
    toast("info", "Handover reset", "Showing current shift alerts again");
  };

  const focusFromAlert = (code: string) => {
    onFocusEquipment(code);
  };

  if (completedAt) {
    return (
      <div>
        <SectionHelp
          icon={Users}
          title="Shift Handover"
          subtitle="Completed for this shift window"
          badge="Done"
          badgeClass="bg-green-500/15 text-green-400"
          help="This handover was submitted and cleared from the active list. New alerts in the next 8h window will appear here again. Reset if you need to re-open the same shift items."
        />
        <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-green-400" />
          <p className="mt-2 text-sm font-semibold text-green-300">Handover submitted</p>
          <p className="mt-1 text-xs text-gray-400">
            {new Date(completedAt).toLocaleString()}
            {savedToLogbook ? " · saved to Logbook" : " · local record only"}
          </p>
          <p className="mt-2 text-[11px] text-gray-500">
            {alertCount} alerts / {criticalCount} critical acknowledged — cleared from this panel
          </p>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href="/logbook"
            className="flex flex-1 items-center justify-center gap-1 rounded bg-steel-500/20 py-2 text-[11px] text-steel-300 hover:bg-steel-500/30"
          >
            View Logbook <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <button
            type="button"
            onClick={resetHandover}
            className="flex flex-1 items-center justify-center gap-1 rounded border border-[var(--border)] py-2 text-[11px] text-gray-400 hover:text-white"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Show alerts again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <SectionHelp
        icon={Users}
        title="Shift Handover"
        subtitle="Review → submit → saves to Logbook & clears this list"
        badge="Last 8h"
        help="Review critical items, add outgoing notes, confirm, then Submit handover. Submitted handovers are saved to the Logbook and removed from this panel until new alerts arrive in the next shift window."
      />

      <div className="grid grid-cols-3 gap-2 text-center">
        <button
          type="button"
          onClick={onScrollToEvents}
          className="rounded-lg border border-[var(--border)] bg-[var(--background)]/50 p-2 transition-colors hover:border-steel-500/50 hover:bg-white/5"
        >
          <div className="text-lg font-bold text-white">{alertCount}</div>
          <div className="text-[10px] text-gray-500">Alerts · click</div>
        </button>
        <button
          type="button"
          onClick={onScrollToEvents}
          className="rounded-lg border border-red-500/30 bg-red-500/5 p-2 transition-colors hover:border-red-500/50"
        >
          <div className="text-lg font-bold text-red-400">{criticalCount}</div>
          <div className="text-[10px] text-gray-500">Critical · click</div>
        </button>
        <Link
          href="/logbook"
          className="rounded-lg border border-[var(--border)] bg-[var(--background)]/50 p-2 transition-colors hover:border-steel-500/50 hover:bg-white/5"
        >
          <div className="text-lg font-bold text-steel-400">{logbookEntries}</div>
          <div className="text-[10px] text-gray-500">Logs · open</div>
        </Link>
      </div>

      {bottleneckCode && (
        <button
          type="button"
          onClick={() => onFocusEquipment(bottleneckCode)}
          className="mt-3 flex w-full cursor-pointer items-center justify-between rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-left text-xs transition-colors hover:border-orange-500/50"
        >
          <span className="text-orange-300">Bottleneck · click to focus</span>
          <span className="font-mono font-bold text-white">{bottleneckCode}</span>
        </button>
      )}

      {criticalAlerts.length > 0 ? (
        <div className="mt-3 max-h-36 space-y-1.5 overflow-y-auto">
          {criticalAlerts.map((a, i) => (
            <div
              key={`${a.equipment_code}-${i}`}
              className="group flex items-stretch gap-1 rounded border border-[var(--border)] transition-colors hover:border-steel-500/40"
            >
              <button
                type="button"
                onClick={() => focusFromAlert(a.equipment_code)}
                className="flex min-w-0 flex-1 cursor-pointer items-start gap-2 p-2 text-left text-xs"
              >
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
                <div className="min-w-0">
                  <div className="font-mono text-steel-400 group-hover:text-white">{a.equipment_code}</div>
                  <div className="truncate text-gray-400">{a.title}</div>
                  <div className="mt-0.5 text-[10px] uppercase text-red-400/80">{a.level}</div>
                </div>
              </button>
              <Link
                href={`/equipment/${a.equipment_code}`}
                className="flex shrink-0 items-center border-l border-[var(--border)] px-2 text-gray-500 hover:bg-white/5 hover:text-steel-300"
                title="Open equipment page"
              >
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-xs text-green-400">No critical alerts in the last 8 hours.</p>
      )}

      <div className="mt-3 rounded border border-steel-500/30 bg-steel-500/5 p-3 text-xs text-steel-300">
        <div className="font-medium text-steel-200">Recommended action</div>
        <p className="mt-1 leading-relaxed">{recommendedAction}</p>
      </div>

      <div className="mt-3">
        <label className="mb-1 flex items-center gap-1 text-[10px] font-medium text-gray-500">
          <NotebookPen className="h-3 w-3" />
          Outgoing shift notes (included in submission)
        </label>
        <textarea
          value={notes}
          onChange={(e) => saveNotes(e.target.value)}
          rows={2}
          placeholder="e.g. RM-MOTOR-03 vibration elevated — incoming shift to verify after 2h cooldown…"
          className="w-full resize-none rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-xs text-gray-300"
        />
      </div>

      <label className="mt-2 flex cursor-pointer items-center gap-2 text-[11px] text-gray-400">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="rounded border-[var(--border)]"
        />
        <CheckCircle2 className={`h-3.5 w-3.5 ${confirmed ? "text-green-400" : "text-gray-600"}`} />
        I reviewed all items — ready to submit handover
      </label>

      <button
        type="button"
        disabled={!confirmed || submitting}
        onClick={submitHandover}
        className="mt-3 w-full rounded-lg bg-green-600 py-2.5 text-xs font-semibold text-white transition-opacity hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {submitting ? "Submitting…" : "Submit handover → Logbook"}
      </button>
      <p className="mt-1 text-center text-[10px] text-gray-600">
        Submits to Logbook and clears alerts from this panel
      </p>

      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={copySummary}
          className="flex flex-1 items-center justify-center gap-1 rounded border border-[var(--border)] py-2 text-[11px] text-gray-400 hover:text-white"
        >
          <ClipboardCopy className="h-3.5 w-3.5" /> Copy
        </button>
        <Link
          href={`/chat?equipment=${encodeURIComponent(bottleneckCode || criticalAlerts[0]?.equipment_code || "RM-MOTOR-03")}`}
          className="flex flex-1 items-center justify-center gap-1 rounded bg-steel-500/20 py-2 text-[11px] text-steel-300 hover:bg-steel-500/30"
        >
          <MessageSquare className="h-3.5 w-3.5" /> Ask AI
        </Link>
      </div>
    </div>
  );
}
