"use client";

import { useEffect, useState } from "react";
import { IndianRupee, Pause, Play } from "lucide-react";
import LiveSectionHeader from "@/components/LiveSectionHeader";

interface DowntimeTickerProps {
  debtInr: number;
  criticalCount: number;
  debtItemCount?: number;
  manualDebtInr?: number;
}

export default function DowntimeTicker({
  debtInr,
  criticalCount,
  debtItemCount = 0,
  manualDebtInr = 0,
}: DowntimeTickerProps) {
  const [tick, setTick] = useState(0);
  const [paused, setPaused] = useState(false);
  const totalDebt = debtInr + manualDebtInr;
  const ratePerMin = Math.max(1200, Math.round(totalDebt / 480) + criticalCount * 850);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setTick((x) => x + ratePerMin), 1000);
    return () => clearInterval(t);
  }, [ratePerMin, paused]);

  const line = [
    `₹${ratePerMin.toLocaleString()}/min exposure rate`,
    `Session counter ₹${tick.toLocaleString()}${paused ? " (paused)" : ""}`,
    debtItemCount > 0
      ? `${debtItemCount} deferred asset(s)`
      : "No auto debt — fleet health ≥ 70%",
    manualDebtInr > 0 ? `+ ₹${manualDebtInr.toLocaleString()} manual entries` : null,
    criticalCount > 0 ? `${criticalCount} critical asset(s) on watch` : "No critical assets",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="overflow-hidden rounded-xl border border-red-500/30 bg-gradient-to-r from-red-950/40 to-[var(--card)] p-3">
      <LiveSectionHeader
        icon={IndianRupee}
        title="Downtime Risk Ticker"
        subtitle="Projected ₹/min if maintenance stays deferred — not bank debt"
        help="The scrolling rate combines maintenance-debt API totals plus any manual entries you add. The session counter ticks every second while running — pause freezes both the counter and the scroll animation."
        badge={paused ? "Paused" : "Live"}
        badgeClass={paused ? "bg-white/10 text-gray-400" : "bg-red-500/15 text-red-400"}
      />
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          className="flex items-center gap-1 rounded border border-white/10 px-2 py-0.5 text-[10px] text-gray-400 hover:text-white"
        >
          {paused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
          {paused ? "Resume" : "Pause"}
        </button>
      </div>
      <div className={`ticker-track mt-1 flex whitespace-nowrap text-sm ${paused ? "ticker-track-paused" : ""}`}>
        <span className="mx-4 text-red-400">{line} · </span>
        <span className="mx-4 text-red-400" aria-hidden>
          {line} ·
        </span>
      </div>
    </div>
  );
}
