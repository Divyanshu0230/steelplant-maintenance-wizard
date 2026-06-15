import { SENSOR_CHART_COLORS } from "./design-tokens";

export type SensorMetricKey = "temperature" | "vibration" | "pressure" | "motor_current";

export interface MetricConfig {
  key: SensorMetricKey;
  label: string;
  unit: string;
  color: string;
  shortLabel: string;
}

export const SENSOR_METRICS: MetricConfig[] = [
  { key: "temperature", label: "Temperature", unit: "°C", color: SENSOR_CHART_COLORS.temperature, shortLabel: "Temp" },
  { key: "vibration", label: "Vibration", unit: "mm/s", color: SENSOR_CHART_COLORS.vibration, shortLabel: "Vib" },
  { key: "pressure", label: "Pressure", unit: "bar", color: SENSOR_CHART_COLORS.pressure, shortLabel: "Press" },
  { key: "motor_current", label: "Motor Current", unit: "A", color: SENSOR_CHART_COLORS.motor_current, shortLabel: "Current" },
];

export function getMetric(key: SensorMetricKey): MetricConfig {
  return SENSOR_METRICS.find((m) => m.key === key) ?? SENSOR_METRICS[0];
}

export function formatSensorValue(key: SensorMetricKey, value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  const m = getMetric(key);
  return `${Number(value).toFixed(2)} ${m.unit}`;
}

export function formatSensorAxis(key: SensorMetricKey): string {
  return `${getMetric(key).label} (${getMetric(key).unit})`;
}
