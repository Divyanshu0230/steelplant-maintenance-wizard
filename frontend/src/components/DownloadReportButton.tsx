"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { downloadDiagnosisReportPdf, DiagnosisReportPayload } from "@/lib/diagnosisReport";
import { useToast } from "@/components/ToastProvider";

interface DownloadReportButtonProps {
  payload: DiagnosisReportPayload;
  label?: string;
  compact?: boolean;
  className?: string;
}

export default function DownloadReportButton({
  payload,
  label = "Download PDF",
  compact = false,
  className = "",
}: DownloadReportButtonProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleDownload = async () => {
    setLoading(true);
    try {
      await downloadDiagnosisReportPdf(payload);
      toast("success", "Report downloaded");
    } catch (e) {
      toast("error", "PDF download failed", e instanceof Error ? e.message : "");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={loading}
      className={
        className ||
        `inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-1.5 text-[11px] font-medium text-[var(--foreground)] transition hover:border-status-healthy/40 hover:text-status-healthy disabled:opacity-50 ${
          compact ? "px-2.5 py-1" : ""
        }`
      }
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
      {label}
    </button>
  );
}
