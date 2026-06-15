"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  CheckCircle2,
  Cpu,
  Database,
  Loader2,
  MessageSquare,
  Microscope,
  Radio,
  Sparkles,
  Star,
  Zap,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import SectionHelp from "@/components/SectionHelp";
import AnimatedCard from "@/components/AnimatedCard";
import { DiagnosisResultView } from "@/components/DiagnosisResultView";
import { api, AiStatus, DiagnosisResult, Equipment } from "@/lib/api";
import { ENGINE_LABELS } from "@/lib/ai-display";
import { HACKATHON_SCENARIOS, SCENARIO_CATEGORIES } from "@/lib/hackathonScenarios";
import { useToast } from "@/components/ToastProvider";

const PIPELINE_STEPS = [
  { icon: BookOpen, label: "RAG search", desc: "Manuals & SOPs from Knowledge Base" },
  { icon: Database, label: "Operational logs", desc: "Fault codes, delays, defects" },
  { icon: Cpu, label: "ML models", desc: "C-MAPSS anomaly + RUL prediction" },
  { icon: Sparkles, label: "Agentic AI", desc: "Multi-agent synthesis when configured" },
];

export default function DiagnosisPage() {
  const { toast } = useToast();
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null);
  const [equipmentId, setEquipmentId] = useState<number | "">("");
  const [query, setQuery] = useState("");
  const [fault, setFault] = useState("");
  const [vibration, setVibration] = useState("");
  const [temperature, setTemperature] = useState("");
  const [current, setCurrent] = useState("");
  const [result, setResult] = useState<DiagnosisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingSensors, setLoadingSensors] = useState(false);
  const [rating, setRating] = useState(0);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [scenarioFilter, setScenarioFilter] = useState<string>("all");
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);

  useEffect(() => {
    api.getEquipment().then(setEquipment);
    api.getAiStatus().then(setAiStatus).catch(() => setAiStatus(null));
  }, []);

  const selectedEquipment = equipment.find((e) => e.id === equipmentId);

  const loadScenario = (id: string) => {
    const s = HACKATHON_SCENARIOS.find((x) => x.id === id);
    if (!s) return;
    const eq = equipment.find((e) => e.equipment_code === s.equipment);
    if (eq) setEquipmentId(eq.id);
    setQuery(s.query);
    setFault(s.fault ?? "");
    const sd = s.sensor_data;
    setVibration(String(sd.vibration_mm_s ?? ""));
    setTemperature(String(sd.temperature_c ?? ""));
    setCurrent(String(sd.current_a ?? ""));
    setResult(null);
    setRating(0);
    setFeedbackSent(false);
    setActiveScenarioId(id);
  };

  const filteredScenarios = HACKATHON_SCENARIOS.filter(
    (s) => scenarioFilter === "all" || s.category === scenarioFilter
  );

  const loadLiveSensors = async () => {
    if (!selectedEquipment) {
      toast("error", "Select equipment", "Choose an asset first.");
      return;
    }
    setLoadingSensors(true);
    try {
      const history = await api.getSensorHistory(selectedEquipment.equipment_code, 1);
      const latest = history[history.length - 1];
      if (!latest) {
        toast("error", "No sensor data", "No readings found for this equipment.");
        return;
      }
      if (latest.vibration != null) setVibration(String(latest.vibration));
      if (latest.temperature != null) setTemperature(String(latest.temperature));
      if (latest.motor_current != null) setCurrent(String(latest.motor_current));
      toast("success", "Live sensors loaded", `From ${latest.data_source ?? "monitoring feed"}`);
    } catch (e) {
      toast("error", "Sensor load failed", e instanceof Error ? e.message : "");
    } finally {
      setLoadingSensors(false);
    }
  };

  const runDiagnosis = async () => {
    if (!equipmentId || !query.trim()) {
      toast("error", "Missing fields", "Select equipment and enter symptoms.");
      return;
    }
    setLoading(true);
    setFeedbackSent(false);
    try {
      const sensor_data: Record<string, number> = {};
      if (vibration) sensor_data.vibration_mm_s = parseFloat(vibration);
      if (temperature) sensor_data.temperature_c = parseFloat(temperature);
      if (current) sensor_data.current_a = parseFloat(current);

      const res = await api.diagnose({
        equipment_id: Number(equipmentId),
        query,
        fault_description: fault || undefined,
        sensor_data: Object.keys(sensor_data).length ? sensor_data : undefined,
        include_rul: true,
        include_spare_parts: true,
      });
      setResult(res);
      toast("success", "Diagnosis complete", res.risk_level?.toUpperCase() ?? "Done");
    } catch (e) {
      toast("error", "Diagnosis failed", e instanceof Error ? e.message : "");
    } finally {
      setLoading(false);
    }
  };

  const submitRating = useCallback(async () => {
    if (!result || rating < 1) return;
    try {
      await api.submitDiagnosisFeedback({
        equipment_id: Number(equipmentId),
        diagnosis_summary: result.diagnosis.slice(0, 500),
        score: rating,
      });
      setFeedbackSent(true);
      toast("success", "Feedback recorded", "Thank you — improves future diagnoses.");
    } catch (e) {
      toast("error", "Feedback failed", e instanceof Error ? e.message : "");
    }
  }, [equipmentId, rating, result, toast]);

  const engineReady = aiStatus?.any_llm_ready
    ? ENGINE_LABELS.api
    : ENGINE_LABELS.rag;

  return (
    <AppShell>
      <div className="space-y-6">
        <SectionHelp
          icon={Microscope}
          title="AI Fault Diagnosis"
          subtitle="9-agent pipeline · real ML + RAG · not fake responses"
          help="Submit symptoms and optional sensor readings. The pipeline uses indexed manuals (RAG), operational logs, C-MAPSS ML, and Agentic AI when configured."
        />

        {/* Engine status + how it works */}
        <div className="grid gap-4 lg:grid-cols-3">
          <AnimatedCard className="lg:col-span-1" delay={0}>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-steel-400" />
              <h3 className="text-sm font-semibold">AI engine status</h3>
            </div>
            <div className={`mt-3 rounded-xl border p-3 ${engineReady.bannerClass}`}>
              <p className="font-semibold">{engineReady.label}</p>
              <p className="mt-1 text-xs opacity-90">{engineReady.hint}</p>
              {aiStatus?.any_llm_ready ? (
                <p className="mt-2 text-xs opacity-75">
                  Agentic AI ready — full multi-agent synthesis active.
                </p>
              ) : (
                <p className="mt-2 text-xs opacity-75">
                  Agentic AI offline — still real ML + RAG + rules via Knowledge Engine.
                </p>
              )}
            </div>
          </AnimatedCard>

          <AnimatedCard className="lg:col-span-2" delay={40}>
            <h3 className="text-sm font-semibold">How diagnosis works</h3>
            <p className="mt-1 text-xs text-gray-500">
              Responses are generated by the orchestrator — not static fake text. Manual citations come
              from the knowledge base.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {PIPELINE_STEPS.map((step) => (
                <div
                  key={step.label}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-3"
                >
                  <step.icon className="mb-2 h-4 w-4 text-steel-400" />
                  <div className="text-xs font-semibold text-gray-200">{step.label}</div>
                  <div className="mt-0.5 text-[10px] text-gray-500">{step.desc}</div>
                </div>
              ))}
            </div>
          </AnimatedCard>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <AnimatedCard className="lg:col-span-1" delay={80}>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-semibold">Sample scenarios</h2>
              <span className="text-[10px] text-gray-500">{HACKATHON_SCENARIOS.length} cases</span>
            </div>
            <div className="mb-2 flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => setScenarioFilter("all")}
                className={`rounded-md px-2 py-0.5 text-[10px] ${
                  scenarioFilter === "all" ? "bg-steel-500/30 text-white" : "text-gray-500 hover:text-gray-300"
                }`}
              >
                All
              </button>
              {SCENARIO_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setScenarioFilter(cat)}
                  className={`rounded-md px-2 py-0.5 text-[10px] ${
                    scenarioFilter === cat ? "bg-steel-500/30 text-white" : "text-gray-500 hover:text-gray-300"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
            <div className="max-h-[280px] space-y-2 overflow-y-auto pr-1">
              {filteredScenarios.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => loadScenario(s.id)}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                    activeScenarioId === s.id
                      ? "border-steel-500/50 bg-steel-500/15"
                      : "border-white/10 bg-white/5 hover:border-steel-500/40 hover:bg-white/10"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-medium text-white">{s.name}</div>
                    <span className="shrink-0 rounded bg-white/10 px-1.5 py-0.5 text-[9px] text-gray-400">
                      {s.category}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">{s.equipment}</div>
                </button>
              ))}
            </div>

            <div className="mt-5 space-y-3">
              <label className="block text-xs text-gray-400">Equipment</label>
              <select
                value={equipmentId}
                onChange={(e) => setEquipmentId(e.target.value ? Number(e.target.value) : "")}
                className="w-full rounded border border-[var(--border)] bg-[var(--background)] px-2 py-2 text-sm"
              >
                <option value="">Select…</option>
                {equipment.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.equipment_code} — {e.name}
                  </option>
                ))}
              </select>

              <label className="block text-xs text-gray-400">Symptoms / query</label>
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                rows={4}
                placeholder="Describe vibration, noise, fault symptoms…"
                className="w-full rounded border border-[var(--border)] bg-[var(--background)] px-2 py-2 text-sm"
              />

              <input
                placeholder="Fault code (e.g. E003)"
                value={fault}
                onChange={(e) => setFault(e.target.value)}
                className="w-full rounded border border-[var(--border)] bg-[var(--background)] px-2 py-2 text-sm"
              />

              <div className="flex items-center justify-between">
                <label className="text-xs text-gray-400">Sensor readings (optional)</label>
                <button
                  type="button"
                  onClick={loadLiveSensors}
                  disabled={!equipmentId || loadingSensors}
                  className="flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300 disabled:opacity-40"
                >
                  {loadingSensors ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Radio className="h-3 w-3" />
                  )}
                  Load live
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input
                  placeholder="Vib mm/s"
                  value={vibration}
                  onChange={(e) => setVibration(e.target.value)}
                  className="rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-xs"
                />
                <input
                  placeholder="Temp °C"
                  value={temperature}
                  onChange={(e) => setTemperature(e.target.value)}
                  className="rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-xs"
                />
                <input
                  placeholder="Current A"
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                  className="rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-xs"
                />
              </div>

              <button
                type="button"
                onClick={runDiagnosis}
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-steel-500 py-2.5 text-sm font-medium text-white transition-opacity hover:bg-steel-600 disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Microscope className="h-4 w-4" />
                )}
                Run AI Diagnosis
              </button>
            </div>
          </AnimatedCard>

          <AnimatedCard className="lg:col-span-2" delay={120}>
            {loading ? (
              <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
                <Loader2 className="h-10 w-10 animate-spin text-steel-400" />
                <div>
                  <p className="font-medium text-gray-200">
                    {aiStatus?.enable_full_agentic
                      ? "Running 9-agent diagnosis pipeline…"
                      : "Running fast AI diagnosis (RAG + ML + 1 LLM call)…"}
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    {aiStatus?.enable_full_agentic
                      ? "RAG · logs · ML · RCA · planner · synthesis — may take 30–60s on free tier"
                      : "Usually 5–15 seconds on cloud deploy"}
                  </p>
                </div>
              </div>
            ) : !result ? (
              <div className="py-8 text-center">
                <Microscope className="mx-auto mb-4 h-12 w-12 text-gray-600" />
                <p className="text-sm text-gray-400">
                  Load a TATA sample scenario or enter symptoms, then run diagnosis.
                </p>
                <p className="mt-2 text-xs text-gray-600">
                  Results include root causes with evidence, RUL, maintenance actions, manual citations
                  (open PDFs inline), and full agent pipeline trace.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {result.equipment_code && (
                  <p className="font-mono text-sm text-steel-400">{result.equipment_code}</p>
                )}
                <DiagnosisResultView
                  result={result}
                  equipmentLabel={
                    selectedEquipment
                      ? `${selectedEquipment.equipment_code} — ${selectedEquipment.name}`
                      : result.equipment_code
                  }
                />

                <div className="flex flex-wrap items-center gap-3 border-t border-white/10 pt-4">
                  <Link
                    href={`/chat?equipment=${encodeURIComponent(result.equipment_code ?? "")}&q=${encodeURIComponent(query.slice(0, 200))}`}
                    className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-gray-300 hover:border-steel-500/40"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    Continue in AI chat
                  </Link>
                </div>

                <div className="border-t border-white/10 pt-4">
                  <p className="mb-2 text-xs text-gray-400">
                    Rate this diagnosis (1–5 stars) — improves future runs
                  </p>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setRating(n)}
                        className={rating >= n ? "text-yellow-400" : "text-gray-600"}
                      >
                        <Star className="h-6 w-6 fill-current" />
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={submitRating}
                      disabled={rating < 1 || feedbackSent}
                      className="ml-2 rounded bg-white/10 px-3 py-1 text-xs disabled:opacity-40"
                    >
                      {feedbackSent ? (
                        <span className="flex items-center gap-1 text-green-400">
                          <CheckCircle2 className="h-3 w-3" /> Saved
                        </span>
                      ) : (
                        "Submit"
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </AnimatedCard>
        </div>
      </div>
    </AppShell>
  );
}
