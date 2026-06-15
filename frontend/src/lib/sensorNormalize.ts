import { SENSOR_METRICS, SensorMetricKey } from "./units";

/** Plausible steel-plant display ranges */
export const DISPLAY_RANGES: Record<SensorMetricKey, { min: number; max: number }> = {
  temperature: { min: 42, max: 98 },
  vibration: { min: 2.0, max: 11.5 },
  pressure: { min: 7.5, max: 17.5 },
  motor_current: { min: 85, max: 245 },
};

/** Fixed NASA C-MAPSS FD001 raw sensor bounds (not dataset-relative) */
const CMAPSS_RAW_RANGES: Record<SensorMetricKey, { min: number; max: number }> = {
  temperature: { min: 518, max: 660 },
  vibration: { min: 0.0, max: 1.6 },
  pressure: { min: 98, max: 110 },
  motor_current: { min: 12, max: 28 },
};

export type SensorPoint = Record<string, number | undefined>;

function scaleValue(
  raw: number,
  rawMin: number,
  rawMax: number,
  displayMin: number,
  displayMax: number
): number {
  if (rawMax <= rawMin) return (displayMin + displayMax) / 2;
  const t = Math.max(0, Math.min(1, (raw - rawMin) / (rawMax - rawMin)));
  return displayMin + t * (displayMax - displayMin);
}

function metricKeys(): SensorMetricKey[] {
  return SENSOR_METRICS.map((m) => m.key);
}

/** Map C-MAPSS magnitudes to plant display units using fixed physical bounds */
export function normalizeSensorHistory(
  data: SensorPoint[],
  dataSource?: string
): { data: SensorPoint[]; normalized: boolean; source: string } {
  const source = dataSource ?? "plant_sensors";
  const isCmapss = source.includes("CMAPSS") || source.includes("NASA");

  if (!isCmapss || data.length === 0) {
    return { data, normalized: false, source };
  }

  const normalized = data.map((point) => {
    const out: SensorPoint = { ...point };
    for (const key of metricKeys()) {
      const raw = point[key];
      const rawRange = CMAPSS_RAW_RANGES[key];
      const range = DISPLAY_RANGES[key];
      if (raw != null && rawRange && range) {
        out[key] = Math.round(scaleValue(raw, rawRange.min, rawRange.max, range.min, range.max) * 100) / 100;
      }
    }
    return out;
  });

  return { data: normalized, normalized: true, source };
}

export function sensorSourceLabel(source: string): string {
  if (source.includes("CMAPSS") || source.includes("NASA")) {
    return "NASA C-MAPSS FD001 (scaled for display)";
  }
  if (source === "synthetic_seed") return "Synthetic seed data";
  return "Plant sensor database";
}
