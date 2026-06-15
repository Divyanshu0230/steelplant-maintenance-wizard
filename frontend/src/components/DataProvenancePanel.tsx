"use client";

import { Database, Info } from "lucide-react";

const ITEMS = [
  { feature: "Health / RUL / Risk / Alerts", source: "ML on C-MAPSS", tag: "computed" },
  { feature: "Sensor charts & Failure Replay", source: "C-MAPSS DB history", tag: "cmapss" },
  { feature: "Delay logs & fault messages", source: "operational CSV + TATA samples", tag: "csv" },
  { feature: "Chat citations", source: "Manuals, SOPs, incident docs (RAG)", tag: "docs" },
  { feature: "Maintenance debt", source: "Formula on ML health + static ₹/hr table", tag: "formula" },
  { feature: "Downtime ticker (accumulated ₹)", source: "Client animation for demo", tag: "demo" },
  { feature: "3D plant layout", source: "Visual map — positions are fictional", tag: "demo" },
  { feature: "Live Stream", source: "Simulated ticks (×1.02) on C-MAPSS baseline", tag: "simulated" },
];

const TAG_STYLE: Record<string, string> = {
  cmapss: "bg-[color-mix(in_srgb,var(--status-info)_18%,transparent)] text-[var(--status-info)]",
  computed: "bg-[color-mix(in_srgb,var(--status-healthy)_18%,transparent)] text-[var(--status-healthy)]",
  csv: "bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] text-[var(--accent)]",
  docs: "bg-[color-mix(in_srgb,var(--status-info)_15%,transparent)] text-[var(--status-info)]",
  formula: "bg-[color-mix(in_srgb,var(--status-warning)_18%,transparent)] text-[var(--status-warning)]",
  demo: "bg-[var(--surface-elevated)] text-[var(--muted)]",
  simulated: "bg-[color-mix(in_srgb,var(--status-warning)_18%,transparent)] text-[var(--status-warning)]",
};

export default function DataProvenancePanel() {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
      <div className="mb-3 flex items-center gap-2">
        <Database className="h-4 w-4 text-[var(--accent)]" />
        <h2 className="text-sm font-semibold text-white">Data provenance (judge Q&A)</h2>
      </div>
      <div className="space-y-2">
        {ITEMS.map((item) => (
          <div key={item.feature} className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-gray-300">{item.feature}</span>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">{item.source}</span>
              <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${TAG_STYLE[item.tag]}`}>
                {item.tag}
              </span>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 flex items-start gap-1.5 text-[10px] text-gray-500">
        <Info className="mt-0.5 h-3 w-3 shrink-0" />
        100% hackathon-aligned: all required inputs/outputs implemented. Not live Tata SCADA — accepts real data via POST /sensors/ingest.
      </p>
    </div>
  );
}
