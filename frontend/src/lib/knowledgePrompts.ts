export type KnowledgePrompt = {
  label: string;
  query: string;
  category: "bearing" | "sop" | "incident" | "equipment";
};

export const KNOWLEDGE_QUICK_PROMPTS: KnowledgePrompt[] = [
  { label: "Bearing failure RCA", query: "bearing failure root cause analysis", category: "bearing" },
  { label: "Bearing replacement SOP", query: "bearing replacement procedure steps", category: "sop" },
  { label: "Vibration limits", query: "vibration ISO zone limits blower motor", category: "equipment" },
  { label: "Motor overheating", query: "motor overheating corrective actions", category: "equipment" },
  { label: "Lubrication schedule", query: "bearing lubrication schedule requirements", category: "sop" },
  { label: "Incident corrective actions", query: "incident report corrective actions bearing seizure", category: "incident" },
  { label: "Emergency shutdown", query: "emergency shutdown procedure blower", category: "sop" },
  { label: "Misalignment checks", query: "shaft misalignment inspection procedure", category: "bearing" },
];

export const KNOWLEDGE_ROLE_HINTS: Record<string, string> = {
  operator: "Short, safety-first steps — what to do on the floor",
  engineer: "Technical RCA, sensor checks, spare parts, and SOP detail",
  manager: "Downtime risk, cost impact, and scheduling priority",
};
