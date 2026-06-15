export type ManualDebtEntry = {
  id: string;
  equipment_code: string;
  debt_inr: number;
  note: string;
  created_at: string;
};

export type CalendarOverride = {
  equipment_code: string;
  estimated_service_date: string;
  note?: string;
  updated_at: string;
};

const DEBT_KEY = "steelplant-live-manual-debt";
const CAL_KEY = "steelplant-live-calendar-overrides";

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function getManualDebtEntries(): ManualDebtEntry[] {
  return readJson<ManualDebtEntry[]>(DEBT_KEY, []);
}

export function addManualDebtEntry(entry: Omit<ManualDebtEntry, "id" | "created_at">) {
  const items = getManualDebtEntries();
  const next: ManualDebtEntry = {
    ...entry,
    id: `md-${Date.now()}`,
    created_at: new Date().toISOString(),
  };
  writeJson(DEBT_KEY, [...items, next]);
  return next;
}

export function removeManualDebtEntry(id: string) {
  writeJson(
    DEBT_KEY,
    getManualDebtEntries().filter((e) => e.id !== id)
  );
}

export function getCalendarOverrides(): Record<string, CalendarOverride> {
  return readJson<Record<string, CalendarOverride>>(CAL_KEY, {});
}

export function setCalendarOverride(override: Omit<CalendarOverride, "updated_at">) {
  const all = getCalendarOverrides();
  all[override.equipment_code] = { ...override, updated_at: new Date().toISOString() };
  writeJson(CAL_KEY, all);
}

export function clearCalendarOverride(equipmentCode: string) {
  const all = getCalendarOverrides();
  delete all[equipmentCode];
  writeJson(CAL_KEY, all);
}
