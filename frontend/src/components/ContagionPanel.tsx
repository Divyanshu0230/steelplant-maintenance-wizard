"use client";

import { ArrowRight, GitBranch } from "lucide-react";
import SectionHelp from "@/components/SectionHelp";

export interface ContagionEdge {
  from: string;
  to: string;
  reason: string;
  propagated_risk: number;
  severity?: string;
  source_risk?: number;
}

interface ContagionPanelProps {
  edges: ContagionEdge[];
  onFocusEquipment: (code: string) => void;
}

export default function ContagionPanel({ edges, onFocusEquipment }: ContagionPanelProps) {
  return (
    <div>
      <SectionHelp
        icon={GitBranch}
        title="Contagion Risk"
        subtitle="Click source or target asset to focus on Plant Twin"
        help="Production-line dependency model: when an upstream asset (e.g. blower) is unhealthy, downstream assets (motor, conveyor) get amplified failure risk. Click either equipment code to jump to that machine on the digital twin."
      />

      {edges.length === 0 ? (
        <p className="text-xs text-green-400">No active propagation — all source assets below 50% risk.</p>
      ) : (
        <div className="space-y-2">
          {edges.map((e, i) => (
            <div
              key={`${e.from}-${e.to}-${i}`}
              className="rounded-lg border border-[var(--border)] p-2 text-xs transition-colors hover:border-orange-500/30"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1 font-mono">
                  <button
                    type="button"
                    onClick={() => onFocusEquipment(e.from)}
                    className="cursor-pointer rounded border border-steel-500/30 bg-steel-500/10 px-2 py-1 text-steel-300 transition-colors hover:border-steel-500 hover:bg-steel-500/20 hover:text-white"
                    title="Focus source asset on Plant Twin"
                  >
                    {e.from}
                  </button>
                  <ArrowRight className="h-3.5 w-3.5 text-gray-500" />
                  <button
                    type="button"
                    onClick={() => onFocusEquipment(e.to)}
                    className="cursor-pointer rounded border border-orange-500/30 bg-orange-500/10 px-2 py-1 text-orange-300 transition-colors hover:border-orange-500 hover:bg-orange-500/20 hover:text-white"
                    title="Focus downstream asset on Plant Twin"
                  >
                    {e.to}
                  </button>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    e.severity === "high"
                      ? "bg-red-500/15 text-red-400"
                      : e.severity === "medium"
                        ? "bg-orange-500/15 text-orange-400"
                        : "bg-yellow-500/15 text-yellow-400"
                  }`}
                >
                  {(e.propagated_risk * 100).toFixed(0)}% risk
                </span>
              </div>
              <p className="mt-1.5 text-gray-500">{e.reason}</p>
              <p className="mt-1 text-[10px] text-gray-600">Click codes above to locate on map</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
