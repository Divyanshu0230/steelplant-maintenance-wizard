"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  FileText,
  Gauge,
  Package,
  RefreshCw,
  Thermometer,
  Zap,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import AnimatedCard from "@/components/AnimatedCard";
import SensorChart from "@/components/SensorChart";
import StatCard from "@/components/StatCard";
import MaintenancePlanPanel from "@/components/MaintenancePlanPanel";
import ResolveAlertModal from "@/components/ResolveAlertModal";
import { api, Alert, Equipment, EquipmentHealth, PredictionResult } from "@/lib/api";
import {
  SENSOR_METRICS,
  SensorMetricKey,
  formatSensorValue,
} from "@/lib/units";
import AskAIButton from "@/components/AskAIButton";
import { alertLevelClass } from "@/lib/design-tokens";
import { normalizeSensorHistory } from "@/lib/sensorNormalize";
import { useToast } from "@/components/ToastProvider";

export default function EquipmentDetailPage() {
  const params = useParams();
  const code = decodeURIComponent(params.code as string);
  const { toast } = useToast();

  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [health, setHealth] = useState<EquipmentHealth | null>(null);
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [sensorData, setSensorData] = useState<Array<Record<string, number | undefined>>>([]);
  const [selectedMetric, setSelectedMetric] = useState<SensorMetricKey>("temperature");
  const [loading, setLoading] = useState(true);
  const [predicting, setPredicting] = useState(false);
  const [resolveTarget, setResolveTarget] = useState<Alert | null>(null);

  const load = useCallback(async () => {
    try {
      const [eqList, healthList, alertList, sensors] = await Promise.all([
        api.getEquipment(),
        api.getHealth(),
        api.getAlerts(),
        api.getSensorHistory(code),
      ]);
      const eq = eqList.find((e) => e.equipment_code === code) ?? null;
      setEquipment(eq);
      setHealth(healthList.find((h) => h.equipment_code === code) ?? null);
      setAlerts(
        alertList.filter((a) => a.equipment_id === eq?.id && !a.is_resolved).slice(0, 5)
      );
      const rawPoints = sensors.map((s) => ({
        cycle: s.cycle ?? 0,
        temperature: s.temperature,
        vibration: s.vibration,
        pressure: s.pressure,
        motor_current: s.motor_current,
        health: s.health_indicator != null ? s.health_indicator * 100 : undefined,
      }));
      const source = sensors[0]?.data_source ?? "plant_sensors";
      setSensorData(normalizeSensorHistory(rawPoints, source).data);
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => { load(); }, [load]);

  const runPredict = async () => {
    if (!health?.equipment_id) return;
    setPredicting(true);
    try {
      const pred = await api.predictEquipment(health.equipment_id);
      setPrediction(pred);
      toast("success", "ML prediction complete", `RUL ${pred.rul_cycles} cycles · Risk ${pred.risk_level}`);
      load();
    } catch (e) {
      toast("error", "Prediction failed", e instanceof Error ? e.message : "");
    } finally {
      setPredicting(false);
    }
  };

  const latest = sensorData[sensorData.length - 1];

  if (loading) {
    return (
      <AppShell>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-32 rounded-xl" />
          ))}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="animate-fade-in flex flex-wrap items-center gap-4">
          <Link
            href="/equipment"
            className="flex items-center gap-1 text-sm text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
          >
            <ArrowLeft className="h-4 w-4" />
            Equipment Fleet
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{equipment?.name ?? code}</h1>
            <p className="text-sm text-gray-400">
              {code} · {equipment?.equipment_type} · {equipment?.location} · Criticality: {equipment?.criticality}
            </p>
          </div>
          <Link
            href={`/chat?equipment=${code}&question=${encodeURIComponent(`Diagnose ${code} and recommend maintenance actions`)}`}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-steel-500 to-steel-700 px-4 py-2 text-sm font-medium transition-transform hover:scale-105"
          >
            <Bot className="h-4 w-4" />
            Diagnose with AI
          </Link>
          <Link
            href="/spare-parts"
            className="flex items-center gap-2 rounded-lg border border-steel-500/50 px-4 py-2 text-sm text-steel-400 transition-colors hover:bg-steel-500/10"
          >
            <Package className="h-4 w-4" />
            Spare Parts
          </Link>
          <button
            onClick={async () => {
              try {
                const report = await api.generateReport(code);
                toast("success", "Report generated", (report as { title?: string }).title ?? "Maintenance summary ready");
              } catch (e) {
                toast("error", "Report failed", e instanceof Error ? e.message : "");
              }
            }}
            className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-gray-400 hover:text-white"
          >
            <FileText className="h-4 w-4" />
            Generate Report
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Health Score"
            value={`${health?.health_score.toFixed(0) ?? "—"}%`}
            icon={Gauge}
            color={health && health.health_score < 30 ? "red" : "green"}
            delay={0}
            pulse={health != null && health.health_score < 20}
          />
          <StatCard
            label="Temperature"
            value={latest?.temperature != null ? formatSensorValue("temperature", latest.temperature) : "—"}
            icon={Thermometer}
            color="red"
            delay={80}
          />
          <StatCard
            label="RUL Cycles"
            value={prediction?.rul_cycles ?? health?.rul_cycles ?? "—"}
            sub={`Failure prob ${((prediction?.failure_probability ?? health?.failure_probability ?? 0) * 100).toFixed(0)}%`}
            icon={Zap}
            color="yellow"
            delay={160}
          />
          <StatCard
            label="Risk Level"
            value={health?.risk_level?.toUpperCase() ?? "—"}
            icon={AlertTriangle}
            color={health?.risk_level === "critical" || health?.risk_level === "high" ? "red" : "default"}
            delay={240}
            pulse={health?.risk_level === "critical"}
          />
        </div>

        <AnimatedCard delay={100}>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <h2 className="font-semibold">Sensor Trends</h2>
            <div className="flex gap-1">
              {SENSOR_METRICS.map((m) => (
                <button
                  key={m.key}
                  onClick={() => setSelectedMetric(m.key)}
                  className={`rounded px-2 py-1 text-xs transition-all ${
                    selectedMetric === m.key
                      ? "bg-steel-500 text-white"
                      : "bg-[var(--background)] text-gray-400 hover:text-white"
                  }`}
                >
                  {m.shortLabel} ({m.unit})
                </button>
              ))}
            </div>
            <button
              onClick={runPredict}
              disabled={predicting}
              className="ml-auto flex items-center gap-2 rounded-lg border border-steel-500/50 px-3 py-1 text-xs text-steel-500 hover:bg-steel-500/10 disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${predicting ? "animate-spin" : ""}`} />
              Run ML Prediction
            </button>
          </div>
          {sensorData.length > 0 ? (
            <>
              <SensorChart data={sensorData} selectedMetric={selectedMetric} />
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {SENSOR_METRICS.map((m, i) => (
                  <div
                    key={m.key}
                    className="animate-fade-in-up rounded-lg border border-[var(--border)] p-3"
                    style={{ animationDelay: `${i * 60}ms` }}
                  >
                    <div className="text-xs text-gray-500">{m.label}</div>
                    <div className="text-lg font-bold tabular-nums">
                      {latest?.[m.key] != null ? formatSensorValue(m.key, latest[m.key] as number) : "—"}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-400">No sensor data available.</p>
          )}
        </AnimatedCard>

        <MaintenancePlanPanel equipmentCode={code} />

        {alerts.length > 0 && (
          <AnimatedCard delay={200}>
            <h2 className="mb-3 font-semibold">Active Alerts</h2>
            <div className="space-y-2">
              {alerts.map((a, i) => (
                <div
                  key={a.id}
                  className={`alert-card alert-card-${alertLevelClass(a.alert_level)} animate-slide-in-right rounded-lg border p-3`}
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  <span className={`text-[10px] font-bold uppercase risk-${alertLevelClass(a.alert_level)}`}>
                    {a.alert_level}
                  </span>
                  <div className="mt-1 text-sm font-medium">{a.title}</div>
                  <div className="text-xs text-gray-400">{a.message}</div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <AskAIButton
                      href={`/chat?equipment=${code}&question=${encodeURIComponent(`Explain alert: ${a.title}`)}`}
                    />
                    {!a.is_acknowledged && (
                      <button
                        onClick={() =>
                          api.acknowledgeAlert(a.id).then(() => {
                            toast("success", "Alert acknowledged");
                            load();
                          })
                        }
                        className="text-xs text-green-500 hover:underline"
                      >
                        Acknowledge
                      </button>
                    )}
                    {!a.is_resolved && (
                      <button
                        onClick={() => setResolveTarget(a)}
                        className="text-xs text-[var(--accent)] hover:underline"
                      >
                        Resolve
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </AnimatedCard>
        )}
      </div>

      {resolveTarget && (
        <ResolveAlertModal
          alert={resolveTarget}
          onClose={() => setResolveTarget(null)}
          onResolved={() => {
            toast("success", "Alert resolved");
            load();
          }}
        />
      )}
    </AppShell>
  );
}
