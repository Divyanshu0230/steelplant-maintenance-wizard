/**
 * Semantic status palette — green / amber / orange / red
 */
export const RISK_COLORS: Record<string, string> = {
  low: "#4ADE80",
  medium: "#FACC15",
  high: "#FB923C",
  critical: "#EF4444",
  warning: "#FACC15",
  info: "#A1A1AA",
};

export function alertLevelColor(level: string): string {
  const key = level.toLowerCase();
  if (key in RISK_COLORS) return RISK_COLORS[key];
  if (key === "medium") return RISK_COLORS.medium;
  return RISK_COLORS.info;
}

export function alertLevelClass(level: string): string {
  const key = level.toLowerCase();
  if (["critical", "high", "warning", "info", "low", "medium"].includes(key)) {
    return key === "medium" ? "warning" : key;
  }
  return "info";
}

export const STATUS_COLORS = {
  healthy: "#4ADE80",
  warning: "#FACC15",
  critical: "#EF4444",
  high: "#FB923C",
  info: "#A1A1AA",
  neutral: "#A1A1AA",
} as const;

export function healthGaugeColor(score: number, riskLevel?: string): string {
  if (riskLevel) {
    const r = riskLevel.toLowerCase();
    if (r === "critical") return STATUS_COLORS.critical;
    if (r === "high") return STATUS_COLORS.high;
    if (r === "medium") return STATUS_COLORS.warning;
    if (r === "low") return STATUS_COLORS.healthy;
  }
  if (score >= 70) return STATUS_COLORS.healthy;
  if (score >= 40) return STATUS_COLORS.warning;
  return STATUS_COLORS.critical;
}

export const SENSOR_CHART_COLORS = {
  temperature: "#EF4444",
  vibration: "#FB923C",
  pressure: "#A1A1AA",
  motor_current: "#FACC15",
  health: "#4ADE80",
} as const;

export const CHART_UI = {
  tooltipBg: "#141416",
  tooltipBorder: "#2a2a2e",
  grid: "#2a2a2e",
} as const;

export const PLANT_RISK_STYLES = {
  low: {
    ring: RISK_COLORS.low,
    bg: "rgba(74, 222, 128, 0.15)",
    badge: "#166534",
    text: "#bbf7d0",
    label: "NORMAL",
  },
  medium: {
    ring: RISK_COLORS.medium,
    bg: "rgba(250, 204, 21, 0.18)",
    badge: "#854d0e",
    text: "#fef08a",
    label: "WATCH",
  },
  high: {
    ring: RISK_COLORS.high,
    bg: "rgba(251, 146, 60, 0.2)",
    badge: "#9a3412",
    text: "#fed7aa",
    label: "WARNING",
  },
  critical: {
    ring: RISK_COLORS.critical,
    bg: "rgba(239, 68, 68, 0.22)",
    badge: "#991b1b",
    text: "#fecaca",
    label: "CRITICAL",
  },
} as const;
