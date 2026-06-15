export type PriorityOverride = {
  equipment_code: string;
  score_adjustment: number;
  pinned: boolean;
  custom_action?: string;
  note?: string;
  updated_at: string;
};

const STORAGE_KEY = "steelplant-priority-overrides";

function readAll(): Record<string, PriorityOverride> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, PriorityOverride>;
  } catch {
    return {};
  }
}

function writeAll(data: Record<string, PriorityOverride>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function getPriorityOverrides(): Record<string, PriorityOverride> {
  return readAll();
}

export function getPriorityOverride(equipmentCode: string): PriorityOverride | null {
  return readAll()[equipmentCode] ?? null;
}

export function setPriorityOverride(
  equipmentCode: string,
  patch: Partial<Omit<PriorityOverride, "equipment_code" | "updated_at">>
) {
  const all = readAll();
  const existing = all[equipmentCode];
  all[equipmentCode] = {
    equipment_code: equipmentCode,
    score_adjustment: patch.score_adjustment ?? existing?.score_adjustment ?? 0,
    pinned: patch.pinned ?? existing?.pinned ?? false,
    custom_action: patch.custom_action !== undefined ? patch.custom_action : existing?.custom_action,
    note: patch.note !== undefined ? patch.note : existing?.note,
    updated_at: new Date().toISOString(),
  };
  writeAll(all);
  return all[equipmentCode];
}

export function clearPriorityOverride(equipmentCode: string) {
  const all = readAll();
  delete all[equipmentCode];
  writeAll(all);
}

export function clearAllPriorityOverrides() {
  writeAll({});
}

export const MANUAL_ACTION_OPTIONS = [
  "Immediate Shutdown",
  "Urgent — within 24h",
  "Plan maintenance — 1 week",
  "Monitor",
] as const;
