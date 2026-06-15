"use client";

import Link from "next/link";
import { Factory, Zap } from "lucide-react";
import { EquipmentHealth } from "@/lib/api";
import clsx from "clsx";

const RISK_SURFACE: Record<string, string> = {
  low: "risk-surface-low",
  medium: "risk-surface-medium",
  high: "risk-surface-high",
  critical: "risk-surface-critical",
};

const RISK_PULSE: Record<string, string> = {
  high: "animate-pulse-soft",
  critical: "animate-pulse-soft",
};

const POSITIONS: Record<string, { row: number; col: number; zone: string }> = {
  "BF-BLOWER-01": { row: 1, col: 1, zone: "Blast Furnace" },
  "BF-PUMP-05": { row: 1, col: 3, zone: "Blast Furnace" },
  "RM-MOTOR-03": { row: 2, col: 2, zone: "Rolling Mill" },
  "CV-SYSTEM-12": { row: 3, col: 1, zone: "Conveyor" },
  "OH-CRANE-02": { row: 3, col: 3, zone: "Overhead" },
};

interface PlantMapProps {
  health: EquipmentHealth[];
  selected?: string;
  onSelect?: (code: string) => void;
}

export default function PlantMap({ health, selected, onSelect }: PlantMapProps) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-[var(--border)] bg-gradient-to-b from-[var(--surface-elevated)] to-[var(--card)] p-6">
      <div className="mb-4 flex items-center gap-2">
        <Factory className="h-5 w-5 text-steel-500" />
        <h3 className="font-semibold">Plant Floor Overview</h3>
        <span className="ml-auto flex items-center gap-1 text-xs text-green-400">
          <span className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
          Live
        </span>
      </div>

      <div className="relative grid min-h-[280px] grid-cols-3 grid-rows-3 gap-3">
        <div className="pointer-events-none absolute inset-0 opacity-20">
          <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
                <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#3d5a80" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        {health.map((eq, i) => {
          const pos = POSITIONS[eq.equipment_code] ?? { row: 2, col: 2, zone: "Plant" };
          const risk = eq.risk_level || "medium";
          return (
            <Link
              key={eq.equipment_code}
              href={`/equipment/${eq.equipment_code}`}
              onClick={() => onSelect?.(eq.equipment_code)}
              className={clsx(
                "animate-scale-in group relative flex flex-col items-center justify-center rounded-xl border p-3 ring-2 transition-all duration-300 hover:scale-105 hover:shadow-lg",
                RISK_SURFACE[risk] ?? RISK_SURFACE.medium,
                RISK_PULSE[risk],
                selected === eq.equipment_code && "ring-offset-1 ring-offset-[var(--card)]"
              )}
              style={{
                gridRow: pos.row,
                gridColumn: pos.col,
                animationDelay: `${i * 100}ms`,
              }}
            >
              <Zap
                className={clsx(
                  "mb-1 h-5 w-5 transition-transform group-hover:scale-110",
                  risk === "critical" && "text-risk-critical",
                  risk === "high" && "text-risk-high",
                  risk === "medium" && "text-risk-medium",
                  risk === "low" && "text-risk-low"
                )}
              />
              <span className="text-center text-xs font-bold">{eq.equipment_code.split("-").slice(-2).join("-")}</span>
              <span className="text-[10px] text-gray-500">{pos.zone}</span>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-lg font-bold tabular-nums">{eq.health_score.toFixed(0)}%</span>
                <span className={clsx("text-[10px] font-bold uppercase", `risk-${risk}`)}>
                  {risk}
                </span>
              </div>
              {eq.rul_cycles != null && (
                <span className="mt-0.5 text-[10px] text-gray-400">RUL {eq.rul_cycles}c</span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
