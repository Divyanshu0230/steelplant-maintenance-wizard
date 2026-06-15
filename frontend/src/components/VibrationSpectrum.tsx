"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, TrendingDown, TrendingUp } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import LiveSectionHeader from "@/components/LiveSectionHeader";
import { api } from "@/lib/api";
import { CHART_UI, RISK_COLORS } from "@/lib/design-tokens";
import { normalizeSensorHistory } from "@/lib/sensorNormalize";

const ISO_ZONES = [
  { y: 2.8, label: "Zone B", color: RISK_COLORS.medium },
  { y: 7.1, label: "Zone C", color: RISK_COLORS.high },
];

interface VibrationSpectrumProps {
  active?: boolean;
  equipmentCode?: string;
  className?: string;
}

export default function VibrationSpectrum({
  active = true,
  equipmentCode,
  className = "",
}: VibrationSpectrumProps) {
  const [points, setPoints] = useState<{ cycle: number; vibration: number }[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!equipmentCode) {
      setPoints([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const raw = await api.getSensorHistory(equipmentCode, 40);
      const source = raw[0]?.data_source ?? "plant_sensors";
      const mapped = raw.map((s) => ({
        cycle: s.cycle ?? 0,
        vibration: s.vibration,
      }));
      const { data: norm } = normalizeSensorHistory(mapped, source);
      const vibs = norm
        .filter((p) => p.vibration != null)
        .map((p) => ({ cycle: p.cycle as number, vibration: p.vibration as number }))
        .slice(-24);
      setPoints(vibs);
    } catch {
      setPoints([]);
    } finally {
      setLoading(false);
    }
  }, [equipmentCode]);

  useEffect(() => {
    load();
    if (!active) return;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load, active]);

  const latest = points[points.length - 1];
  const trend = useMemo(() => {
    if (points.length < 2) return null;
    const first = points[0].vibration;
    const last = points[points.length - 1].vibration;
    const delta = last - first;
    return { delta, rising: delta > 0.15 };
  }, [points]);

  const zoneStatus = useMemo(() => {
    if (!latest) return "—";
    const v = latest.vibration;
    if (v < 2.8) return "Normal (Zone A)";
    if (v < 7.1) return "Watch (Zone B)";
    if (v < 11.5) return "Warning (Zone C)";
    return "Critical (Zone D)";
  }, [latest]);

  return (
    <div className={`flex h-full flex-col rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 ${className}`}>
      <LiveSectionHeader
        icon={Activity}
        title="Vibration Trend"
        subtitle={equipmentCode ? `${equipmentCode} · last 24 cycles` : "Select equipment on twin"}
        help="Real C-MAPSS sensor history from the database, display-scaled to mm/s with ISO 10816 zone lines. This is a trend chart — not an FFT frequency spectrum. Updates when Live Stream runs or you change selected equipment."
        badge={latest ? `${latest.vibration.toFixed(2)} mm/s` : undefined}
        badgeClass="bg-orange-500/15 text-orange-400"
      />

      {latest && (
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[10px]">
          <span className="text-gray-500">{zoneStatus}</span>
          {trend && (
            <span className={`flex items-center gap-1 ${trend.rising ? "text-orange-400" : "text-emerald-400"}`}>
              {trend.rising ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {trend.rising ? "Rising" : "Stable"} ({trend.delta >= 0 ? "+" : ""}
              {trend.delta.toFixed(2)} mm/s)
            </span>
          )}
        </div>
      )}

      <div className="min-h-[11rem] flex-1">
        {loading ? (
          <div className="flex h-full items-center justify-center text-xs text-gray-500">Loading sensor history…</div>
        ) : points.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-gray-500">
            Select equipment on the digital twin
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
              <defs>
                <linearGradient id="vibGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={RISK_COLORS.high} stopOpacity={0.45} />
                  <stop offset="100%" stopColor={RISK_COLORS.high} stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_UI.grid} vertical={false} />
              <XAxis
                dataKey="cycle"
                stroke="#64748b"
                fontSize={9}
                tickLine={false}
                label={{ value: "Cycle", position: "insideBottom", offset: -2, fontSize: 9, fill: "#64748b" }}
              />
              <YAxis stroke="#64748b" fontSize={9} tickLine={false} domain={[0, "auto"]} width={32} />
              <Tooltip
                contentStyle={{ background: CHART_UI.tooltipBg, border: `1px solid ${CHART_UI.tooltipBorder}`, fontSize: 11 }}
                formatter={(v: number) => [`${v.toFixed(2)} mm/s`, "Vibration"]}
                labelFormatter={(c) => `Cycle ${c}`}
              />
              {ISO_ZONES.map((z) => (
                <ReferenceLine
                  key={z.label}
                  y={z.y}
                  stroke={z.color}
                  strokeDasharray="4 4"
                  strokeOpacity={0.6}
                  label={{ value: z.label, fontSize: 8, fill: z.color, position: "insideTopRight" }}
                />
              ))}
              <Area
                type="monotone"
                dataKey="vibration"
                stroke={RISK_COLORS.high}
                strokeWidth={2}
                fill="url(#vibGrad)"
                dot={{ r: 2, fill: RISK_COLORS.high }}
                activeDot={{ r: 4 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="mt-2 flex justify-between text-[9px] text-gray-600">
        <span>Older ← cycles → Latest</span>
        <span>ISO 10816 thresholds</span>
      </div>
    </div>
  );
}
