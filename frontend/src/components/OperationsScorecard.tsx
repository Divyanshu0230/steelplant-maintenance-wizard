"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Activity, Gauge, Shield, TrendingDown } from "lucide-react";
import LiveSectionHeader from "@/components/LiveSectionHeader";

interface OpsScorecardProps {
  assets: {
    equipment_code: string;
    equipment_name?: string;
    health_score: number;
    risk_level: string;
    failure_probability?: number;
  }[];
  onSelectEquipment?: (code: string) => void;
}

export default function OperationsScorecard({ assets, onSelectEquipment }: OpsScorecardProps) {
  const [animated, setAnimated] = useState(0);

  const avgHealth = assets.length
    ? assets.reduce((s, a) => s + a.health_score, 0) / assets.length
    : 0;
  const atRisk = assets.filter((a) => a.risk_level === "critical" || a.risk_level === "high");
  const critical = atRisk.length;
  const opsScore = Math.round(avgHealth - critical * 12);

  useEffect(() => {
    const t = setInterval(() => setAnimated((v) => (v >= opsScore ? opsScore : v + 2)), 30);
    return () => clearInterval(t);
  }, [opsScore]);

  const grade =
    opsScore >= 75 ? "A" : opsScore >= 55 ? "B" : opsScore >= 35 ? "C" : opsScore >= 20 ? "D" : "F";
  const gradeColor =
    opsScore >= 75
      ? "text-green-400"
      : opsScore >= 55
        ? "text-yellow-400"
        : opsScore >= 35
          ? "text-orange-400"
          : "text-red-400";

  const badgeClass =
    opsScore >= 75
      ? "bg-green-500/15 text-green-400"
      : opsScore >= 55
        ? "bg-yellow-500/15 text-yellow-400"
        : opsScore >= 35
          ? "bg-orange-500/15 text-orange-400"
          : "bg-red-500/15 text-red-400";

  return (
    <div className="rounded-xl border border-[var(--accent)]/25 bg-gradient-to-br from-[var(--card)] to-[var(--surface-elevated)] p-4">
      <LiveSectionHeader
        icon={Gauge}
        title="Plant Operations Grade"
        subtitle="Letter A–F — not failure probability"
        help={`Ops index = avg fleet health (${avgHealth.toFixed(0)}%) minus 12 for each at-risk asset (${critical}). Grade F means score below 20 — schedule maintenance. Click at-risk rows to focus that machine on the twin.`}
        badge={`${animated}/100`}
        badgeClass={badgeClass}
      />

      <div className="flex items-center gap-4">
        <div className={`text-5xl font-black leading-none ${gradeColor} hologram-text`}>{grade}</div>
        <div className="grid flex-1 grid-cols-3 gap-1.5 text-center text-[10px]">
          <button
            type="button"
            onClick={() => onSelectEquipment?.(assets[0]?.equipment_code ?? "")}
            className="rounded border border-[var(--border)] p-1.5 hover:bg-white/5"
          >
            <div className="font-bold">{avgHealth.toFixed(0)}%</div>
            <div className="text-gray-600">Avg</div>
          </button>
          <button
            type="button"
            onClick={() => atRisk[0] && onSelectEquipment?.(atRisk[0].equipment_code)}
            disabled={critical === 0}
            className="rounded border border-[var(--border)] p-1.5 hover:bg-red-500/5 disabled:opacity-40"
          >
            <TrendingDown className="mx-auto h-3 w-3 text-red-400" />
            <div className="font-bold text-red-400">{critical}</div>
            <div className="text-gray-600">Risk</div>
          </button>
          <button
            type="button"
            onClick={() => {
              const stable = assets.find((a) => a.risk_level !== "critical" && a.risk_level !== "high");
              if (stable) onSelectEquipment?.(stable.equipment_code);
            }}
            className="rounded border border-[var(--border)] p-1.5 hover:bg-green-500/5"
          >
            <Shield className="mx-auto h-3 w-3 text-green-400" />
            <div className="font-bold">{assets.length - critical}</div>
            <div className="text-gray-600">OK</div>
          </button>
        </div>
      </div>

      {atRisk.length > 0 && (
        <div className="mt-3 space-y-0.5 border-t border-white/5 pt-2">
          {atRisk.map((a) => (
            <button
              key={a.equipment_code}
              type="button"
              onClick={() => onSelectEquipment?.(a.equipment_code)}
              className="flex w-full items-center justify-between rounded px-1 py-0.5 text-[10px] text-gray-400 hover:bg-white/5 hover:text-white"
            >
              <span className="font-mono text-steel-400">{a.equipment_code}</span>
              <span className="text-red-400">
                {a.failure_probability != null
                  ? `${(a.failure_probability * 100).toFixed(0)}% fail`
                  : a.risk_level}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="mt-2 flex items-center justify-between text-[10px] text-gray-600">
        <span className="flex items-center gap-1">
          <Activity className="h-3 w-3" />
          ML scans
        </span>
        <Link href="/equipment" className="text-steel-400 hover:text-steel-300">
          Fleet →
        </Link>
      </div>
    </div>
  );
}
