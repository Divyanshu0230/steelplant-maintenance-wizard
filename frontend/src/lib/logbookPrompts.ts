export type LogbookTemplate = {
  label: string;
  maintenance_type: string;
  description: string;
};

export const MAINTENANCE_TYPES = [
  { value: "inspection", label: "Inspection" },
  { value: "repair", label: "Repair" },
  { value: "preventive", label: "Preventive" },
  { value: "corrective", label: "Corrective" },
  { value: "ai_assisted_diagnosis", label: "AI Diagnosis" },
  { value: "emergency", label: "Emergency" },
] as const;

export const OUTCOME_OPTIONS = [
  { value: "completed", label: "Completed" },
  { value: "in_progress", label: "In progress" },
  { value: "deferred", label: "Deferred" },
  { value: "monitoring", label: "Monitoring" },
] as const;

export function logbookTemplates(equipmentCode: string): LogbookTemplate[] {
  return [
    {
      label: "Bearing inspection",
      maintenance_type: "inspection",
      description: `Visual and vibration inspection on ${equipmentCode}. Bearing condition checked, lubrication verified per SOP.`,
    },
    {
      label: "Bearing replacement",
      maintenance_type: "repair",
      description: `Replaced bearing assembly on ${equipmentCode}. Post-repair vibration within normal limits. Test run completed.`,
    },
    {
      label: "Lubrication service",
      maintenance_type: "preventive",
      description: `Scheduled lubrication on ${equipmentCode}. Grease grade and quantity per maintenance manual.`,
    },
    {
      label: "Vibration follow-up",
      maintenance_type: "corrective",
      description: `Follow-up after elevated vibration alarm on ${equipmentCode}. Root cause documented, corrective actions applied.`,
    },
    {
      label: "AI diagnosis review",
      maintenance_type: "ai_assisted_diagnosis",
      description: `Reviewed AI agentic diagnosis for ${equipmentCode}. Findings validated on floor; actions logged.`,
    },
    {
      label: "Emergency shutdown",
      maintenance_type: "emergency",
      description: `Emergency stop and inspection on ${equipmentCode}. Equipment isolated per safety procedure before restart.`,
    },
  ];
}

export function typeBadgeClass(type: string): string {
  const t = type.toLowerCase();
  if (t.includes("emergency")) return "bg-status-critical/15 text-status-critical";
  if (t.includes("ai")) return "bg-amber-500/15 text-amber-200";
  if (t.includes("repair") || t.includes("corrective")) return "bg-status-warning/15 text-status-warning";
  if (t.includes("preventive")) return "bg-status-healthy/15 text-status-healthy";
  return "bg-steel-500/15 text-steel-300";
}

export function formatTypeLabel(type: string): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function groupEntriesByDate<T extends { performed_at: string }>(
  entries: T[]
): { label: string; items: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const entry of entries) {
    const d = new Date(entry.performed_at);
    const key = d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const list = groups.get(key) || [];
    list.push(entry);
    groups.set(key, list);
  }
  return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
}
