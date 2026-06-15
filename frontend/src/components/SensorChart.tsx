"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SENSOR_CHART_COLORS } from "@/lib/design-tokens";
import { SENSOR_METRICS, SensorMetricKey, formatSensorAxis, formatSensorValue } from "@/lib/units";

interface SensorChartProps {
  data: Array<Record<string, number | undefined>>;
  selectedMetric: SensorMetricKey;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; dataKey: string; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 text-xs shadow-xl">
      <p className="mb-2 font-medium text-gray-300">Cycle {label}</p>
      {payload.map((p) => {
        const key = p.dataKey as SensorMetricKey | "health";
        const display =
          key === "health"
            ? `${Number(p.value).toFixed(1)}%`
            : key in { temperature: 1, vibration: 1, pressure: 1, motor_current: 1 }
              ? formatSensorValue(key as SensorMetricKey, p.value)
              : String(p.value);
        return (
          <p key={p.dataKey} style={{ color: p.color }}>
            {p.name}: <strong>{display}</strong>
          </p>
        );
      })}
    </div>
  );
}

export default function SensorChart({ data, selectedMetric }: SensorChartProps) {
  const metric = SENSOR_METRICS.find((m) => m.key === selectedMetric)!;

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2d3a4f" />
          <XAxis
            dataKey="cycle"
            stroke="#94a3b8"
            fontSize={11}
            label={{ value: "Cycle", position: "insideBottom", offset: -5, fill: "#94a3b8" }}
          />
          <YAxis
            stroke="#94a3b8"
            fontSize={11}
            tickFormatter={(v) =>
              selectedMetric === "temperature" ? `${v}°C` : String(v)
            }
            label={{
              value: formatSensorAxis(selectedMetric),
              angle: -90,
              position: "insideLeft",
              fill: "#94a3b8",
              fontSize: 10,
            }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Line
            type="monotone"
            dataKey={selectedMetric}
            name={`${metric.label} (${metric.unit})`}
            stroke={metric.color}
            dot={false}
            strokeWidth={2}
            animationDuration={800}
          />
          <Line
            type="monotone"
            dataKey="health"
            name="Health %"
            stroke={SENSOR_CHART_COLORS.health}
            dot={false}
            strokeWidth={1}
            strokeDasharray="4 4"
            animationDuration={800}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
