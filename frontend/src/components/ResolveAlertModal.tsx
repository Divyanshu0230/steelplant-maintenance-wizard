"use client";

import { useState } from "react";
import { CheckCircle2, X } from "lucide-react";
import { Alert, api } from "@/lib/api";

export const RESOLUTION_TYPE_LABELS: Record<string, string> = {
  spare_replacement: "Spare part replacement",
  adjustment_calibration: "Adjustment / calibration",
  maintenance_action: "Maintenance action",
  false_alarm: "False alarm",
  operator_intervention: "Operator intervention",
  other: "Other",
};

export const RESOLUTION_TYPES = Object.keys(RESOLUTION_TYPE_LABELS);

interface ResolveAlertModalProps {
  alert: Alert;
  onClose: () => void;
  onResolved: () => void;
}

export default function ResolveAlertModal({ alert, onClose, onResolved }: ResolveAlertModalProps) {
  const [resolutionType, setResolutionType] = useState(RESOLUTION_TYPES[0]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await api.resolveAlert(alert.id, {
        resolution_type: resolutionType,
        resolution_notes: notes.trim() || undefined,
      });
      onResolved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to resolve alert");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-[var(--status-healthy)]" />
              <h3 className="font-bold">Resolve Alert</h3>
            </div>
            <p className="mt-1 text-sm text-[var(--muted)]">{alert.title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-[var(--muted)] hover:bg-[var(--nav-active)] hover:text-[var(--foreground)]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <label className="mt-4 block text-sm">
          What helped resolve this?
          <select
            value={resolutionType}
            onChange={(e) => setResolutionType(e.target.value)}
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
          >
            {RESOLUTION_TYPES.map((type) => (
              <option key={type} value={type}>
                {RESOLUTION_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </label>

        <label className="mt-3 block text-sm">
          Resolution notes
          <span className="ml-1 text-xs text-[var(--muted)]">(optional)</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="e.g. Replaced bearing on drive motor, vibration normalized"
            className="mt-1 w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
          />
        </label>

        {error && (
          <p className="mt-3 text-sm text-red-400">{error}</p>
        )}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="flex-1 rounded-lg bg-[var(--btn-bg)] py-2 text-sm font-medium text-[var(--btn-fg)] disabled:opacity-50"
          >
            {submitting ? "Saving..." : "Mark resolved"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
