"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FlaskConical, Loader2, Play } from "lucide-react";
import AnimatedCard from "./AnimatedCard";
import { api } from "@/lib/api";
import { useToast } from "./ToastProvider";

const SCENARIOS = [
  {
    id: "bearing",
    name: "Bearing failure investigation",
    equipment: "RM-MOTOR-03",
    query:
      "Equipment has increasing vibration over 2 weeks. Latest reading 8.7 mm/s. Grinding noise from bearing housing.",
    sensor_data: { vibration_mm_s: 8.7, temperature_c: 84.0, current_a: 98.0 },
    fault: "E003 - Vibration High Alarm",
  },
  {
    id: "motor-heat",
    name: "Motor overheating",
    equipment: "BF-BLOWER-01",
    query:
      "Main drive motor temperature rose from 65°C to 92°C over 3 days. Cooling fan appears running.",
    sensor_data: { temperature_c: 92.0, vibration_mm_s: 3.2, current_a: 112.0 },
    fault: "E031 - Temperature High Alarm",
  },
  {
    id: "hydraulic",
    name: "Hydraulic pressure drop",
    equipment: "BF-PUMP-05",
    query:
      "Hydraulic pressure dropping from 280 bar to 190 bar. No visible external leaks.",
    sensor_data: { pressure_bar: 190.0, temperature_c: 72.0 },
    fault: "E010 - Hydraulic Pressure Deviation",
  },
  {
    id: "rul",
    name: "Predict remaining useful life",
    equipment: "RM-MOTOR-03",
    query:
      "Estimate remaining useful life based on current sensor trends and maintenance history.",
    sensor_data: {},
    fault: undefined,
  },
];

export default function DemoScenariosPanel() {
  const router = useRouter();
  const { toast } = useToast();
  const [running, setRunning] = useState<string | null>(null);

  const runScenario = async (s: (typeof SCENARIOS)[0], mode: "chat" | "diagnosis") => {
    setRunning(s.id);
    try {
      if (mode === "diagnosis") {
        const eq = await api.getEquipment();
        const equipment = eq.find((e) => e.equipment_code === s.equipment);
        if (!equipment) throw new Error("Equipment not found");
        const result = await api.diagnose({
          equipment_id: equipment.id,
          query: s.query,
          sensor_data: Object.keys(s.sensor_data).length ? s.sensor_data as Record<string, number> : undefined,
          fault_description: s.fault,
        });
        toast("success", `Diagnosis: ${s.name}`, result.diagnosis.slice(0, 120) + "…");
      } else {
        const q = s.fault ? `${s.query} [${s.fault}]` : s.query;
        router.push(`/chat?equipment=${s.equipment}&question=${encodeURIComponent(q)}`);
      }
    } catch (e) {
      toast("error", "Scenario failed", e instanceof Error ? e.message : "");
    } finally {
      setRunning(null);
    }
  };

  return (
    <AnimatedCard delay={310}>
      <div className="mb-3 flex items-center gap-2">
        <FlaskConical className="h-5 w-5 text-steel-500" />
        <h2 className="font-semibold">Scenario-Based Troubleshooting</h2>
        <span className="text-[11px] text-gray-500">TATA hackathon sample scenarios</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {SCENARIOS.map((s) => (
          <div
            key={s.id}
            className="rounded-lg border border-[var(--border)] p-3 text-xs"
          >
            <div className="font-medium text-gray-200">{s.name}</div>
            <div className="mt-0.5 font-mono text-[10px] text-steel-500">{s.equipment}</div>
            <p className="mt-1 line-clamp-2 text-gray-500">{s.query}</p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                disabled={running === s.id}
                onClick={() => runScenario(s, "chat")}
                className="flex items-center gap-1 rounded bg-steel-500/20 px-2 py-1 text-[11px] text-steel-300 hover:bg-steel-500/30 disabled:opacity-50"
              >
                {running === s.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                Chat
              </button>
              <button
                type="button"
                disabled={running === s.id}
                onClick={() => runScenario(s, "diagnosis")}
                className="rounded border border-[var(--border)] px-2 py-1 text-[11px] text-gray-400 hover:text-white disabled:opacity-50"
              >
                API Diagnosis
              </button>
            </div>
          </div>
        ))}
      </div>
    </AnimatedCard>
  );
}
