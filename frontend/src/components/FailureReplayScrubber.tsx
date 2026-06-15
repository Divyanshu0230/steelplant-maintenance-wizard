"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FastForward, History, Pause, Play, Rewind } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "@/lib/api";
import LiveSectionHeader from "@/components/LiveSectionHeader";
import { CHART_UI, RISK_COLORS, SENSOR_CHART_COLORS } from "@/lib/design-tokens";
import { normalizeSensorHistory } from "@/lib/sensorNormalize";

interface FailureReplayScrubberProps {
  equipmentCodes: string[];
  defaultCode?: string;
  className?: string;
}

export default function FailureReplayScrubber({
  equipmentCodes,
  defaultCode = "RM-MOTOR-03",
  className = "",
}: FailureReplayScrubberProps) {
  const [code, setCode] = useState(defaultCode);
  const [data, setData] = useState<Array<Record<string, number | undefined>>>([]);
  const [cycleIdx, setCycleIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [metric, setMetric] = useState<"vibration" | "health" | "temperature">("vibration");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    const raw = await api.getSensorHistory(code, 120);
    const source = raw[0]?.data_source ?? "plant_sensors";
    const points = raw.map((s) => ({
      cycle: s.cycle ?? 0,
      temperature: s.temperature,
      vibration: s.vibration,
      pressure: s.pressure,
      motor_current: s.motor_current,
      health: s.health_indicator != null ? s.health_indicator * 100 : undefined,
    }));
    const { data: norm } = normalizeSensorHistory(points, source);
    setData(norm);
    setCycleIdx(Math.max(0, norm.length - 1));
  }, [code]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (defaultCode) setCode(defaultCode);
  }, [defaultCode]);

  useEffect(() => {
    if (!playing || data.length === 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      setCycleIdx((i) => (i >= data.length - 1 ? 0 : i + 1));
    }, 400);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [playing, data.length]);

  const point = data[cycleIdx];
  const chartSlice = data.slice(0, cycleIdx + 1);

  return (
    <div className={`flex h-full flex-col rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 ${className}`}>
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <LiveSectionHeader
          icon={History}
          title="Failure Replay Timeline"
          subtitle="Step through stored sensor cycles like a DVR rewind"
          help="Replay real C-MAPSS history from the database for any asset. Choose vibration, health, or temperature, then Play or scrub the slider to see when degradation started. Not a live SCADA feed — use Start Live Stream for simulated real-time ticks."
        />
        <select
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs"
        >
          {equipmentCodes.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <div className="mb-3 flex gap-1">
        {(["vibration", "health", "temperature"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMetric(m)}
            className={`rounded px-2 py-0.5 text-xs capitalize ${
              metric === m ? "bg-steel-500 text-white" : "text-gray-500"
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartSlice}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_UI.grid} />
            <XAxis dataKey="cycle" stroke="#918a80" fontSize={10} />
            <YAxis stroke="#918a80" fontSize={10} />
            <Tooltip contentStyle={{ background: CHART_UI.tooltipBg, border: `1px solid ${CHART_UI.tooltipBorder}` }} />
            <Line
              type="monotone"
              dataKey={metric}
              stroke={
                metric === "health"
                  ? SENSOR_CHART_COLORS.health
                  : metric === "vibration"
                    ? SENSOR_CHART_COLORS.vibration
                    : SENSOR_CHART_COLORS.temperature
              }
              dot={false}
              strokeWidth={2}
              animationDuration={200}
            />
            {point && (
              <ReferenceLine x={point.cycle} stroke={RISK_COLORS.medium} strokeDasharray="4 4" />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setCycleIdx((i) => Math.max(0, i - 1))}
          className="rounded border border-[var(--border)] p-1.5 text-gray-400 hover:text-white"
        >
          <Rewind className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setPlaying(!playing)}
          className="rounded-lg bg-steel-500 px-3 py-1.5 text-xs font-medium"
        >
          {playing ? <Pause className="inline h-3 w-3" /> : <Play className="inline h-3 w-3" />}
          {playing ? " Pause" : " Play"}
        </button>
        <button
          type="button"
          onClick={() => setCycleIdx((i) => Math.min(data.length - 1, i + 1))}
          className="rounded border border-[var(--border)] p-1.5 text-gray-400 hover:text-white"
        >
          <FastForward className="h-4 w-4" />
        </button>
        <input
          type="range"
          min={0}
          max={Math.max(0, data.length - 1)}
          value={cycleIdx}
          onChange={(e) => setCycleIdx(Number(e.target.value))}
          className="flex-1"
        />
        <span className="text-xs tabular-nums text-steel-500">
          Cycle {point?.cycle ?? 0}/{data[data.length - 1]?.cycle ?? 0}
        </span>
      </div>

      {point && (
        <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
          <div className="rounded border border-[var(--border)] p-2">
            <div className="text-gray-500">Vib</div>
            <div className="font-bold text-orange-400">{point.vibration?.toFixed(2) ?? "—"}</div>
          </div>
          <div className="rounded border border-[var(--border)] p-2">
            <div className="text-gray-500">Temp</div>
            <div className="font-bold text-red-400">{point.temperature?.toFixed(1) ?? "—"}</div>
          </div>
          <div className="rounded border border-[var(--border)] p-2">
            <div className="text-gray-500">Health</div>
            <div className="font-bold text-green-400">{point.health?.toFixed(0) ?? "—"}%</div>
          </div>
          <div className="rounded border border-[var(--border)] p-2">
            <div className="text-gray-500">Status</div>
            <div className={`font-bold ${(point.health ?? 100) < 40 ? "text-red-400" : "text-yellow-400"}`}>
              {(point.health ?? 100) < 40 ? "FAILURE ZONE" : (point.health ?? 100) < 60 ? "DEGRADING" : "NORMAL"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
