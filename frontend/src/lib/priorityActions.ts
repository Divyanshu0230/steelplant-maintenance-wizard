export type PriorityActionStatus = {
  equipment_code: string;
  recommended_action: string;
  status: "completed" | "deferred";
  updated_at: string;
  note?: string;
  logbook_saved?: boolean;
  priority_score?: number;
};

const STORAGE_KEY = "steelplant-priority-actions";

function readAll(): Record<string, PriorityActionStatus> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, PriorityActionStatus>) : {};
  } catch {
    return {};
  }
}

function writeAll(data: Record<string, PriorityActionStatus>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function getPriorityActionStatuses(): Record<string, PriorityActionStatus> {
  return readAll();
}

export function getPriorityActionStatus(
  equipmentCode: string,
  recommendedAction: string
): PriorityActionStatus | null {
  const entry = readAll()[equipmentCode];
  if (!entry || entry.recommended_action !== recommendedAction) return null;
  return entry;
}

export function isPriorityActionDone(equipmentCode: string, recommendedAction: string): boolean {
  const entry = getPriorityActionStatus(equipmentCode, recommendedAction);
  return entry?.status === "completed";
}

export function isPriorityActionDeferred(equipmentCode: string, recommendedAction: string): boolean {
  const entry = getPriorityActionStatus(equipmentCode, recommendedAction);
  return entry?.status === "deferred";
}

export function setPriorityActionStatus(
  equipmentCode: string,
  recommendedAction: string,
  status: PriorityActionStatus["status"],
  options?: { note?: string; logbook_saved?: boolean; priority_score?: number }
) {
  const all = readAll();
  all[equipmentCode] = {
    equipment_code: equipmentCode,
    recommended_action: recommendedAction,
    status,
    updated_at: new Date().toISOString(),
    note: options?.note,
    logbook_saved: options?.logbook_saved,
    priority_score: options?.priority_score,
  };
  writeAll(all);
  return all[equipmentCode];
}

export function clearPriorityActionStatus(equipmentCode: string) {
  const all = readAll();
  delete all[equipmentCode];
  writeAll(all);
}

/** Clear all done/deferred marks — restores full pending queue for demo. */
export function clearAllPriorityActionStatuses() {
  writeAll({});
}

export function countCompletedActions(recommendedActions: { equipment_code: string; recommended_action: string }[]) {
  return recommendedActions.filter((r) =>
    isPriorityActionDone(r.equipment_code, r.recommended_action)
  ).length;
}
