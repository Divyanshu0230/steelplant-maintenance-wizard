export type AlignmentStatus = "done" | "partial" | "pending";

export type AlignmentItem = {
  id: string;
  label: string;
  detail: string;
  status: AlignmentStatus;
  href?: string;
  api?: string;
};

export type AlignmentCategory = {
  id: string;
  title: string;
  subtitle: string;
  items: AlignmentItem[];
};

/** Tata Steel Hackathon Round 2 + project deliverables — all implemented in this repo. */
export const PROJECT_ALIGNMENT: AlignmentCategory[] = [
  {
    id: "objectives",
    title: "Core objectives",
    subtitle: "All 7 problem statement goals",
    items: [
      { id: "obj-1", label: "Faster, accurate diagnosis", detail: "AI Diagnosis + Chat agentic pipeline", status: "done", href: "/diagnosis" },
      { id: "obj-2", label: "Probable root causes", detail: "RCA agent + confidence + evidence", status: "done", href: "/chat" },
      { id: "obj-3", label: "Degradation & RUL prediction", detail: "Gradient Boosting on C-MAPSS", status: "done", href: "/live" },
      { id: "obj-4", label: "Proactive catastrophic risk", detail: "Anomaly + ISO 10816 + alerts", status: "done", href: "/live" },
      { id: "obj-5", label: "Prioritize ops + procurement", detail: "Priority queue + spares + procurement", status: "done", href: "/priority" },
      { id: "obj-6", label: "Structured insights & reports", detail: "PDF reports + shift briefing", status: "done", href: "/reports" },
      { id: "obj-7", label: "Reactive + proactive support", detail: "Chat + 60s monitoring scan", status: "done", href: "/chat" },
    ],
  },
  {
    id: "inputs",
    title: "Expected inputs",
    subtitle: "Operational, sensors, knowledge, user",
    items: [
      { id: "in-1", label: "Equipment delay logs", detail: "delay_logs.csv + TATA samples", status: "done", href: "/live", api: "GET /operational/delay-logs" },
      { id: "in-2", label: "Fault / error messages", detail: "fault_messages.csv + fault codes", status: "done", api: "GET /operational/fault-messages" },
      { id: "in-3", label: "Failure analysis reports", detail: "Incident markdown in RAG", status: "done", href: "/knowledge" },
      { id: "in-4", label: "Sensor summaries (C-MAPSS)", detail: "NASA FD001 → SensorData", status: "done", href: "/live", api: "POST /sensors/ingest" },
      { id: "in-5", label: "Anomaly alerts", detail: "Isolation Forest + ISO thresholds", status: "done", href: "/live" },
      { id: "in-6", label: "Manuals & SOPs", detail: "RAG over data/documents/", status: "done", href: "/knowledge" },
      { id: "in-7", label: "Maintenance history", detail: "Digital logbook", status: "done", href: "/logbook" },
      { id: "in-8", label: "Spare parts + lead time", detail: "Inventory + procurement workflow", status: "done", href: "/spare-parts" },
      { id: "in-9", label: "Natural language queries", detail: "Multi-turn chat", status: "done", href: "/chat" },
      { id: "in-10", label: "Scenario troubleshooting", detail: "Diagnosis demo scenarios", status: "done", href: "/diagnosis" },
      { id: "in-11", label: "Multi-turn follow-up", detail: "Conversation DB + history", status: "done", href: "/chat" },
    ],
  },
  {
    id: "outputs",
    title: "Expected outputs",
    subtitle: "Diagnostic, risk, maintenance, reporting",
    items: [
      { id: "out-1", label: "Probable fault diagnosis", detail: "POST /diagnosis + /chat", status: "done", href: "/diagnosis", api: "POST /diagnosis" },
      { id: "out-2", label: "Root cause analysis", detail: "probable_causes + citations", status: "done", href: "/diagnosis" },
      { id: "out-3", label: "RUL prediction", detail: "rul_cycles on every diagnosis", status: "done", href: "/equipment/RM-MOTOR-03" },
      { id: "out-4", label: "Early catastrophic warning", detail: "Critical/high alerts", status: "done", href: "/live" },
      { id: "out-5", label: "Process-related defects", detail: "Operational intel agent", status: "done", api: "GET /operational/process-defects" },
      { id: "out-6", label: "Risk classification", detail: "low → critical", status: "done", href: "/priority" },
      { id: "out-7", label: "Plant bottleneck ranking", detail: "Priority page + command center", status: "done", href: "/priority", api: "GET /plant/priority-ranking" },
      { id: "out-8", label: "Spares in priority score", detail: "Low-stock per equipment", status: "done", href: "/priority" },
      { id: "out-9", label: "Maintenance action plan", detail: "Ranked maintenance_actions", status: "done", href: "/chat" },
      { id: "out-10", label: "Spare procurement strategy", detail: "AI recommendations + procurement", status: "done", href: "/spare-parts" },
      { id: "out-11", label: "PDF maintenance reports", detail: "Chat + diagnosis export", status: "done", href: "/reports", api: "POST /reports/export-pdf" },
      { id: "out-12", label: "Digital logbook", detail: "Auto + manual entries", status: "done", href: "/logbook" },
    ],
  },
  {
    id: "fr",
    title: "Functional requirements",
    subtitle: "FR1–FR7 mandatory",
    items: [
      { id: "fr1", label: "FR1 — LLM contextual reasoning", detail: "Agentic AI + Knowledge Engine fallback", status: "done", href: "/chat" },
      { id: "fr1b", label: "FR1 Bonus — Domain steel SLM", detail: "steel_domain_slm before LLM", status: "done", api: "GET /domain/profile" },
      { id: "fr2", label: "FR2 — Knowledge integration", detail: "RAG: manuals, SOPs, logs, ops context", status: "done", href: "/knowledge" },
      { id: "fr3", label: "FR3 — Natural language multi-turn", detail: "Conversation persistence", status: "done", href: "/chat" },
      { id: "fr4", label: "FR4 — Explainable recommendations", detail: "Citations, sensor context, risk factors", status: "done", href: "/diagnosis" },
      { id: "fr5", label: "FR5 — Abnormality + failure prediction", detail: "IF + GBR RUL + ISO 10816", status: "done", href: "/live" },
      { id: "fr6", label: "FR6 — Feedback-driven learning", detail: "Thumbs + star ratings → adapter retrain", status: "done", api: "POST /diagnosis/feedback" },
      { id: "fr7", label: "FR7 — Real-time alerting", detail: "60s scan + WebSocket + ingest", status: "done", href: "/live" },
    ],
  },
  {
    id: "optional",
    title: "Optional enhancements",
    subtitle: "All 6 implemented",
    items: [
      { id: "opt-1", label: "Conversational interface", detail: "AI Agentic Assistant", status: "done", href: "/chat" },
      { id: "opt-2", label: "Visualization dashboard", detail: "Overview + Live Monitor", status: "done", href: "/live" },
      { id: "opt-3", label: "Simulated IoT monitoring", detail: "WS stream + sensor ingest", status: "done", href: "/live" },
      { id: "opt-4", label: "Dynamic KB per equipment", detail: "RAG equipment_type filter", status: "done", href: "/knowledge" },
      { id: "opt-5", label: "Automatic digital logbook", detail: "Chat + priority auto-log", status: "done", href: "/logbook" },
      { id: "opt-6", label: "Role-based alerts", detail: "operator / engineer / manager", status: "done", api: "GET /alerts?role_filter=true" },
    ],
  },
  {
    id: "agentic",
    title: "Agentic AI pipeline",
    subtitle: "LangGraph supervisor + 11 specialists",
    items: [
      { id: "ag-1", label: "Supervisor Agent", detail: "Autonomous ReAct routing", status: "done" },
      { id: "ag-2", label: "Domain SLM Agent", detail: "Steel fault patterns first", status: "done" },
      { id: "ag-3", label: "Document Intelligence", detail: "RAG tool", status: "done", href: "/knowledge" },
      { id: "ag-4", label: "Operational Agent", detail: "Delays + SCADA faults", status: "done" },
      { id: "ag-5", label: "Predictive Maintenance", detail: "ML anomaly + RUL", status: "done" },
      { id: "ag-6", label: "RCA Agent", detail: "Causes + evidence", status: "done" },
      { id: "ag-7", label: "Maintenance Planner", detail: "Prioritized actions", status: "done" },
      { id: "ag-8", label: "Spare Parts Agent", detail: "Inventory scan", status: "done", href: "/spare-parts" },
      { id: "ag-9", label: "Alert Agent", detail: "Risk-based alerts", status: "done" },
      { id: "ag-10", label: "Feedback Learning", detail: "Confidence adjustment", status: "done" },
      { id: "ag-11", label: "Synthesizer Agent", detail: "Final answer composition", status: "done" },
    ],
  },
  {
    id: "tata",
    title: "TATA Round 2 parity",
    subtitle: "Reference hackathon APIs & pages",
    items: [
      { id: "tata-1", label: "POST /diagnosis", detail: "Full agent orchestrator", status: "done", href: "/diagnosis", api: "POST /diagnosis" },
      { id: "tata-2", label: "POST /diagnosis/feedback", detail: "Star ratings 1–5", status: "done", href: "/diagnosis" },
      { id: "tata-3", label: "POST /sensors/ingest", detail: "Live plant ingest + ISO", status: "done", api: "POST /sensors/ingest" },
      { id: "tata-4", label: "Priority ranking page", detail: "Bottleneck table", status: "done", href: "/priority" },
      { id: "tata-5", label: "Knowledge AI answer", detail: "Role-aware RAG answer", status: "done", href: "/knowledge", api: "POST /knowledge/ai-answer" },
      { id: "tata-6", label: "TATA sample data import", detail: "Sensors, delays, RUL CSV", status: "done" },
      { id: "tata-7", label: "C-MAPSS ML models", detail: "train_models.py", status: "done" },
    ],
  },
];

export function alignmentStats(categories: AlignmentCategory[] = PROJECT_ALIGNMENT) {
  const items = categories.flatMap((c) => c.items);
  const done = items.filter((i) => i.status === "done").length;
  const partial = items.filter((i) => i.status === "partial").length;
  const pending = items.filter((i) => i.status === "pending").length;
  const total = items.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  return { done, partial, pending, total, pct };
}

export function statusDotClass(status: AlignmentStatus): string {
  if (status === "done") return "bg-status-healthy shadow-[0_0_8px_rgba(34,197,94,0.6)]";
  if (status === "partial") return "bg-status-warning shadow-[0_0_6px_rgba(234,179,8,0.5)]";
  return "bg-status-critical";
}

export function statusLabel(status: AlignmentStatus): string {
  if (status === "done") return "Implemented";
  if (status === "partial") return "Partial";
  return "Pending";
}
