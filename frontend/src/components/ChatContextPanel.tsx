"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, Loader2, Thermometer, Vibrate } from "lucide-react";
import { api } from "@/lib/api";
import { normalizeSensorHistory } from "@/lib/sensorNormalize";
import { formatSensorValue, SensorMetricKey } from "@/lib/units";

export interface ChatContext {
  equipment_code?: string;
  equipment_name?: string;
  location?: string;
  criticality?: string;
  sensor_readings?: Record<string, number>;
  data_source?: string;
  anomaly_detected?: boolean;
  ai_engine?: string;
  using_full_llm?: boolean;
}

const METRICS: SensorMetricKey[] = ["temperature", "vibration", "pressure", "motor_current"];

function hasSensorData(readings?: Record<string, number>): boolean {
  if (!readings) return false;
  return METRICS.some((k) => readings[k] != null && !Number.isNaN(readings[k]));
}

export default function ChatContextPanel({ ctx }: { ctx: ChatContext; riskLevel?: string }) {
  const [readings, setReadings] = useState<Record<string, number>>(ctx.sensor_readings ?? {});
  const [dataSource, setDataSource] = useState(ctx.data_source);
  const [loadingSensors, setLoadingSensors] = useState(false);

  useEffect(() => {
    setReadings(ctx.sensor_readings ?? {});
    setDataSource(ctx.data_source);
  }, [ctx.sensor_readings, ctx.data_source]);

  useEffect(() => {
    if (!ctx.equipment_code || hasSensorData(ctx.sensor_readings)) return;

    let cancelled = false;
    setLoadingSensors(true);
    api
      .getSensorHistory(ctx.equipment_code, 5)
      .then((rows) => {
        if (cancelled || !rows.length) return;
        const latest = rows[rows.length - 1];
        const next: Record<string, number> = {};
        for (const k of METRICS) {
          const v = latest[k];
          if (v != null && !Number.isNaN(v)) next[k] = v;
        }
        setReadings(next);
        if (latest.data_source) setDataSource(latest.data_source);
      })
      .catch(() => {
        /* keep empty */
      })
      .finally(() => {
        if (!cancelled) setLoadingSensors(false);
      });

    return () => {
      cancelled = true;
    };
  }, [ctx.equipment_code, ctx.sensor_readings]);

  const displayReadings = useMemo(() => {
    const raw = {
      temperature: readings.temperature,
      vibration: readings.vibration,
      pressure: readings.pressure,
      motor_current: readings.motor_current,
    };
    const { data } = normalizeSensorHistory([raw], dataSource);
    return data[0] ?? raw;
  }, [readings, dataSource]);

  if (!ctx.equipment_code) return null;

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {METRICS.map((key) => {
        const val = displayReadings[key] as number | undefined;
        const Icon = key === "temperature" ? Thermometer : key === "vibration" ? Vibrate : Activity;
        return (
          <div
            key={key}
            className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-2"
          >
            <div className="flex items-center gap-1 text-[10px] capitalize text-[var(--muted)]">
              <Icon className="h-3 w-3" />
              {key.replace("_", " ")}
            </div>
            <div className="mt-0.5 text-sm font-semibold">
              {loadingSensors ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--muted)]" />
              ) : val != null && !Number.isNaN(val) ? (
                formatSensorValue(key, val)
              ) : (
                <span className="text-[var(--muted)]">—</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
