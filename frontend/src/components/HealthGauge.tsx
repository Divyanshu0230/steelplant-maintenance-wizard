"use client";

import { healthGaugeColor } from "@/lib/design-tokens";

interface HealthGaugeProps {
  score: number;
  size?: number;
  riskLevel?: string;
}

export default function HealthGauge({ score, size = 64, riskLevel }: HealthGaugeProps) {
  const clamped = Math.max(0, Math.min(100, score));
  const color = healthGaugeColor(clamped, riskLevel);
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (clamped / 100) * circ;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth={6} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={6}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700"
        />
      </svg>
      <span className="absolute text-xs font-bold tabular-nums">{clamped.toFixed(0)}%</span>
    </div>
  );
}
