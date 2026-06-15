"use client";

import { useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  Bot,
  Brain,
  ChevronRight,
  Cpu,
  FileText,
  Gauge,
  Layers,
  Package,
  Sparkles,
} from "lucide-react";
import type { DiagnosisResult, KnowledgeDocumentDetail, ProcessDefect, SpareRecommendation } from "@/lib/api";
import { api } from "@/lib/api";
import { ENGINE_LABELS, getEngineKind } from "@/lib/ai-display";
import MarkdownRenderer from "@/components/MarkdownRenderer";
import DocumentViewer from "@/components/DocumentViewer";
import DownloadReportButton from "@/components/DownloadReportButton";
import { payloadFromDiagnosisResult } from "@/lib/diagnosisReport";

type Tab = "summary" | "causes" | "actions" | "evidence" | "pipeline";

const RISK_STYLES: Record<string, string> = {
  critical: "bg-red-500/15 text-red-400 border-red-500/30",
  high: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  medium: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  low: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
};

const URGENCY_STYLES: Record<string, string> = {
  critical: "bg-red-500/20 text-red-300 border-red-500/30",
  high: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  medium: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  low: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
};

function formatSensorLabel(key: string): string {
  return key.replace(/_/g, " ");
}

function SparePartCard({ spare }: { spare: SpareRecommendation }) {
  const name = spare.part || spare.part_name || spare.name || spare.part_code || "Spare part";
  const urgency = (spare.urgency ?? "medium").toLowerCase();

  return (
    <div className="rounded-lg border border-white/10 bg-black/30 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-gray-100">{name}</p>
          {spare.part_code && (
            <p className="mt-0.5 font-mono text-[11px] text-steel-400">{spare.part_code}</p>
          )}
        </div>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${
            URGENCY_STYLES[urgency] ?? URGENCY_STYLES.medium
          }`}
        >
          {urgency}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
        {spare.quantity_available != null && (
          <div className="rounded-md bg-white/5 px-2 py-1.5">
            <div className="text-gray-500">In stock</div>
            <div className="font-semibold text-gray-200">{spare.quantity_available}</div>
          </div>
        )}
        {spare.quantity_recommended != null && (
          <div className="rounded-md bg-white/5 px-2 py-1.5">
            <div className="text-gray-500">Recommend</div>
            <div className="font-semibold text-cyan-300">{spare.quantity_recommended}</div>
          </div>
        )}
        {spare.lead_time_days != null && (
          <div className="rounded-md bg-white/5 px-2 py-1.5">
            <div className="text-gray-500">Lead time</div>
            <div className="font-semibold text-gray-200">{spare.lead_time_days}d</div>
          </div>
        )}
        {spare.unit_cost != null && (
          <div className="rounded-md bg-white/5 px-2 py-1.5">
            <div className="text-gray-500">Unit cost</div>
            <div className="font-semibold text-gray-200">₹{spare.unit_cost.toLocaleString()}</div>
          </div>
        )}
      </div>
      {spare.rationale && (
        <p className="mt-2 text-[11px] text-gray-500">{spare.rationale}</p>
      )}
    </div>
  );
}

function ProcessDefectCard({ defect }: { defect: ProcessDefect }) {
  return (
    <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold leading-snug text-gray-100">{defect.defect}</p>
        <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
          {Math.round(defect.confidence * 100)}%
        </span>
      </div>
      {defect.indicators?.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {defect.indicators.map((ind) => (
            <span
              key={ind}
              className="rounded-full border border-white/10 bg-black/30 px-2 py-0.5 text-[10px] text-gray-400"
            >
              {ind}
            </span>
          ))}
        </div>
      )}
      {defect.action && (
        <p className="mt-2 text-xs leading-relaxed text-gray-400">
          <span className="font-medium text-amber-300/90">Action: </span>
          {defect.action}
        </p>
      )}
    </div>
  );
}

const PRIORITY_STYLES: Record<string, string> = {
  critical: "border-l-red-500 bg-red-500/5",
  high: "border-l-orange-500 bg-orange-500/5",
  medium: "border-l-amber-500 bg-amber-500/5",
  low: "border-l-emerald-500 bg-emerald-500/5",
};

interface DiagnosisResultViewProps {
  result: DiagnosisResult;
  equipmentLabel?: string;
}

function explainField<T>(explainability: Record<string, unknown> | undefined, key: string): T | undefined {
  if (!explainability) return undefined;
  return explainability[key] as T | undefined;
}

export function DiagnosisResultView({ result, equipmentLabel }: DiagnosisResultViewProps) {
  const [tab, setTab] = useState<Tab>("summary");
  const [viewerDoc, setViewerDoc] = useState<KnowledgeDocumentDetail | null>(null);
  const [viewerLoading, setViewerLoading] = useState(false);

  const aiMode = explainField<string>(result.explainability, "ai_mode");
  const engine = getEngineKind(aiMode);
  const engineMeta = ENGINE_LABELS[engine];
  const agentSteps = explainField<string[]>(result.explainability, "agent_steps") ?? [];
  const sensors = explainField<Record<string, number>>(result.explainability, "sensor_readings");
  const spares = result.spare_recommendations ?? [];
  const defects = result.process_defects ?? [];

  const confidence =
    result.confidence_score ??
    (result.probable_causes.length
      ? Math.max(...result.probable_causes.map((c) => c.confidence))
      : 0.75);

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "summary", label: "Summary" },
    { id: "causes", label: "Causes", count: result.probable_causes.length },
    { id: "actions", label: "Actions", count: result.maintenance_actions.length },
    { id: "evidence", label: "Manuals & docs", count: result.citations.length },
    { id: "pipeline", label: "AI pipeline", count: agentSteps.length || undefined },
  ];

  const openCitation = async (source: string) => {
    setViewerLoading(true);
    setViewerDoc(null);
    try {
      setViewerDoc(await api.getKnowledgeDocumentBySource(source));
    } catch {
      try {
        const docs = await api.getKnowledgeDocuments();
        const match = docs.find(
          (d) =>
            d.title.toLowerCase().includes(source.toLowerCase()) ||
            source.toLowerCase().includes(d.title.toLowerCase())
        );
        if (match) {
          setViewerDoc(await api.getKnowledgeDocument(match.id));
        } else {
          window.open(`/knowledge?open=${encodeURIComponent(source)}`, "_blank");
        }
      } catch {
        window.open(`/knowledge?open=${encodeURIComponent(source)}`, "_blank");
      }
    } finally {
      setViewerLoading(false);
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${engineMeta.bannerClass}`}
        >
          {engine === "api" ? <Sparkles className="h-3.5 w-3.5" /> : <Brain className="h-3.5 w-3.5" />}
          {engineMeta.label}
        </span>
        {result.risk_level && (
          <span
            className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize ${
              RISK_STYLES[result.risk_level] ?? RISK_STYLES.medium
            }`}
          >
            {result.risk_level} risk
          </span>
        )}
        <span className="rounded-full border border-slate-600 bg-slate-800/60 px-3 py-1 text-xs text-slate-300">
          Confidence {(confidence * 100).toFixed(0)}%
        </span>
        {result.rul_cycles != null && (
          <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs text-blue-300">
            RUL ~{Math.round(result.rul_cycles)} cycles
          </span>
        )}
        {result.failure_probability != null && (
          <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs text-purple-300">
            Failure prob {(result.failure_probability * 100).toFixed(0)}%
          </span>
        )}
        {result.equipment_code && (
          <DownloadReportButton
            payload={payloadFromDiagnosisResult(result, result.equipment_code, equipmentLabel)}
            label="Download report PDF"
            className="inline-flex items-center gap-1.5 rounded-full border border-steel-500/40 bg-steel-500/10 px-3 py-1 text-xs font-semibold text-steel-300 transition hover:bg-steel-500/20"
          />
        )}
      </div>

      <div className="flex flex-wrap gap-1 rounded-xl border border-white/10 bg-black/20 p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              tab === t.id ? "bg-steel-500/20 text-white" : "text-gray-400 hover:text-gray-200"
            }`}
          >
            {t.label}
            {t.count != null && t.count > 0 && (
              <span className="ml-1.5 rounded-full bg-white/10 px-1.5 text-[10px]">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/20 p-5 md:p-6">
        {tab === "summary" && (
          <div className="space-y-5">
            {equipmentLabel && (
              <p className="text-sm text-gray-400">
                Equipment: <span className="font-medium text-gray-200">{equipmentLabel}</span>
              </p>
            )}
            <MarkdownRenderer content={result.diagnosis} className="text-sm leading-relaxed text-gray-200" />
            {sensors && Object.keys(sensors).length > 0 && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-300">
                  <Gauge className="h-4 w-4 text-cyan-400" />
                  Sensor context used
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                  {Object.entries(sensors).map(([k, v]) => (
                    <div key={k} className="rounded-lg bg-black/30 px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wide text-gray-500">
                        {formatSensorLabel(k)}
                      </div>
                      <div className="font-mono text-sm text-cyan-300">{Number(v).toFixed(3)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {(spares.length > 0 || defects.length > 0) && (
              <div className="space-y-4">
                {spares.length > 0 && (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-300">
                      <Package className="h-4 w-4 text-steel-400" />
                      Recommended spare parts
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-normal text-gray-400">
                        {spares.length}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {spares.slice(0, 5).map((s, i) => (
                        <SparePartCard key={s.part_code ?? i} spare={s} />
                      ))}
                    </div>
                  </div>
                )}
                {defects.length > 0 && (
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                    <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-200">
                      <AlertTriangle className="h-4 w-4 text-amber-400" />
                      Process-related defects
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-normal text-amber-300/80">
                        {defects.length}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {defects.slice(0, 5).map((d, i) => (
                        <ProcessDefectCard key={`${d.defect}-${i}`} defect={d} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {tab === "causes" && (
          <div className="space-y-3">
            {result.probable_causes.length === 0 ? (
              <p className="text-sm text-gray-500">No ranked causes returned.</p>
            ) : (
              result.probable_causes.map((c, i) => (
                <div key={i} className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-xs font-bold text-gray-500">#{i + 1}</span>
                      <h4 className="mt-0.5 font-semibold text-gray-100">{c.cause}</h4>
                    </div>
                    <span className="shrink-0 rounded-full bg-cyan-500/15 px-2.5 py-0.5 text-xs font-semibold text-cyan-400">
                      {(c.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                  {c.evidence && (
                    <p className="mt-2 text-sm leading-relaxed text-gray-400">{c.evidence}</p>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {tab === "actions" && (
          <div className="space-y-3">
            {result.maintenance_actions.length === 0 ? (
              <p className="text-sm text-gray-500">No maintenance actions suggested.</p>
            ) : (
              result.maintenance_actions.map((a, i) => (
                <div
                  key={i}
                  className={`rounded-xl border border-white/10 border-l-4 p-4 ${
                    PRIORITY_STYLES[a.priority?.toLowerCase()] ?? PRIORITY_STYLES.medium
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-300">
                      {a.priority}
                    </span>
                    {a.timeframe && <span className="text-xs text-gray-500">{a.timeframe}</span>}
                  </div>
                  <p className="mt-2 font-medium text-gray-100">{a.action}</p>
                  {a.rationale && <p className="mt-1.5 text-sm text-gray-400">{a.rationale}</p>}
                </div>
              ))
            )}
          </div>
        )}

        {tab === "evidence" && (
          <div className="space-y-4">
            <p className="text-sm text-gray-400">
              Grounded in indexed manuals and SOPs via RAG — click a source to open the document
              viewer.
            </p>
            {result.citations.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/20 p-8 text-center text-sm text-gray-500">
                <FileText className="mx-auto mb-2 h-8 w-8 opacity-40" />
                No manual citations. Index documents from the Knowledge page.
              </div>
            ) : (
              result.citations.map((c, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => openCitation(c.source)}
                  className="group w-full rounded-xl border border-white/10 bg-white/5 p-4 text-left transition-colors hover:border-cyan-500/40 hover:bg-white/10"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4 shrink-0 text-cyan-400" />
                      <span className="font-semibold text-gray-100 group-hover:text-cyan-300">
                        {c.source}
                      </span>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-gray-500 group-hover:text-cyan-400" />
                  </div>
                  {c.excerpt && (
                    <p className="mt-2 line-clamp-3 text-sm italic leading-relaxed text-gray-400">
                      &ldquo;{c.excerpt}&rdquo;
                    </p>
                  )}
                </button>
              ))
            )}
          </div>
        )}

        {tab === "pipeline" && (
          <div className="space-y-4">
            <p className="text-sm text-gray-400">
              Nine agents run in sequence: document RAG, domain rules, operational logs, ML anomaly +
              RUL, RCA, planner, spares, alerts — then Agentic AI synthesizes the answer. If unavailable,
              Knowledge Engine still uses real ML + RAG.
            </p>
            {agentSteps.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Cpu className="h-4 w-4" />
                Step trace not included in this response.
              </div>
            ) : (
              <ol className="relative space-y-0 border-l border-white/20 pl-6">
                {agentSteps.map((step, i) => (
                  <li key={i} className="relative pb-4 last:pb-0">
                    <span className="absolute -left-[1.65rem] flex h-6 w-6 items-center justify-center rounded-full border border-white/20 bg-black/40 text-[10px] font-bold text-gray-400">
                      {i + 1}
                    </span>
                    <p className="text-sm text-gray-300">{step}</p>
                  </li>
                ))}
              </ol>
            )}
            <div className={`rounded-xl border p-4 ${engineMeta.bannerClass}`}>
              <div className="flex items-center gap-2 text-sm font-semibold">
                {engine === "api" ? (
                  <>
                    <Bot className="h-4 w-4" />
                    <span>Agentic AI synthesis active</span>
                  </>
                ) : (
                  <>
                    <Layers className="h-4 w-4" />
                    <span>Knowledge Engine (ML + RAG + rules)</span>
                  </>
                )}
              </div>
              <p className="mt-1 text-xs opacity-80">{engineMeta.hint}</p>
            </div>
          </div>
        )}
      </div>

      <DocumentViewer doc={viewerDoc} loading={viewerLoading} onClose={() => setViewerDoc(null)} />
    </div>
  );
}
