"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Clock, FileWarning, Wrench } from "lucide-react";
import AnimatedCard from "./AnimatedCard";
import { api, DelayLog, FaultMessage, OperationalSummary } from "@/lib/api";

export default function OperationalDataPanel() {
  const [summary, setSummary] = useState<OperationalSummary | null>(null);
  const [delays, setDelays] = useState<DelayLog[]>([]);
  const [faults, setFaults] = useState<FaultMessage[]>([]);

  useEffect(() => {
    Promise.all([
      api.getOperationalSummary(),
      api.getDelayLogs(),
      api.getFaultMessages(true),
    ])
      .then(([s, d, f]) => {
        setSummary(s);
        setDelays(d.items.slice(0, 5));
        setFaults(f.items.slice(0, 5));
      })
      .catch(() => {});
  }, []);

  if (!summary) return null;

  return (
    <AnimatedCard delay={320}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileWarning className="h-5 w-5 text-orange-400" />
          <h2 className="font-semibold">Operational & Failure Inputs</h2>
        </div>
        <span className="text-[11px] text-gray-500">
          {summary.delay_log_count} delays · {summary.active_fault_count} active faults ·{" "}
          {summary.fault_code_dictionary_size} fault codes
        </span>
      </div>
      <p className="mb-3 text-xs text-gray-500">
        Ingested from <code className="text-steel-400">data/operational/*.csv</code> + incident reports in RAG.
        Feeds prioritization (delay severity) and chat context.
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-gray-400">
            <Clock className="h-3.5 w-3.5" />
            Equipment delay logs
          </div>
          <div className="space-y-2">
            {delays.map((d) => (
              <div
                key={d.id}
                className="rounded-lg border border-[var(--border)] p-2 text-xs"
              >
                <div className="flex justify-between gap-2">
                  <span className="font-mono text-steel-400">{d.equipment_code}</span>
                  <span
                    className={`rounded px-1.5 py-0.5 font-bold uppercase ${
                      d.severity === "critical"
                        ? "bg-red-500/20 text-red-300"
                        : d.severity === "high"
                          ? "bg-orange-500/20 text-orange-300"
                          : "bg-yellow-500/20 text-yellow-300"
                    }`}
                  >
                    {d.delay_hours}h
                  </span>
                </div>
                <div className="mt-1 text-gray-400">{d.reason}</div>
                {d.production_loss_tonnes > 0 && (
                  <div className="mt-0.5 text-[10px] text-gray-500">
                    Production loss: {d.production_loss_tonnes}t
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-gray-400">
            <AlertTriangle className="h-3.5 w-3.5" />
            SCADA / DCS fault messages
          </div>
          <div className="space-y-2">
            {faults.map((f) => (
              <div
                key={f.id}
                className="rounded-lg border border-[var(--border)] p-2 text-xs"
              >
                <div className="flex justify-between gap-2">
                  <span className="font-mono text-steel-400">{f.fault_code}</span>
                  <span className="text-[10px] text-gray-500">{f.source}</span>
                </div>
                <div className="mt-0.5 font-medium text-gray-300">{f.equipment_code}</div>
                <div className="mt-1 text-gray-400">{f.message}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-steel-500/20 bg-steel-500/5 px-3 py-2 text-[11px] text-gray-400">
        <Wrench className="mr-1 inline h-3.5 w-3.5 text-steel-500" />
        Total recent delay exposure: <strong className="text-white">{summary.total_recent_delay_hours}h</strong>
        — used in risk scoring and plant bottleneck priority.
      </div>
    </AnimatedCard>
  );
}
