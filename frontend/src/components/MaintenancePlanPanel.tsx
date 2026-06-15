"use client";

import { useEffect, useState } from "react";
import { ClipboardList, Eye, Package, Zap } from "lucide-react";
import AnimatedCard from "./AnimatedCard";
import { api, MaintenancePlan } from "@/lib/api";

export default function MaintenancePlanPanel({ equipmentCode }: { equipmentCode: string }) {
  const [plan, setPlan] = useState<MaintenancePlan | null>(null);

  useEffect(() => {
    if (!equipmentCode) return;
    api.getMaintenancePlan(equipmentCode).then(setPlan).catch(() => setPlan(null));
  }, [equipmentCode]);

  if (!plan) return null;

  return (
    <AnimatedCard delay={180}>
      <div className="mb-3 flex items-center gap-2">
        <ClipboardList className="h-5 w-5 text-steel-500" />
        <h2 className="font-semibold">Maintenance Plan — {equipmentCode}</h2>
        <span
          className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
            plan.urgency === "immediate"
              ? "bg-red-500/20 text-red-300"
              : plan.urgency === "high"
                ? "bg-orange-500/20 text-orange-300"
                : "bg-green-500/20 text-green-300"
          }`}
        >
          {plan.urgency}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Section
          icon={Zap}
          title="Immediate actions"
          items={plan.immediate_actions}
          color="text-red-300"
        />
        <Section
          icon={ClipboardList}
          title="Optimized plan"
          items={plan.optimized_maintenance_plan}
          color="text-steel-300"
        />
        <Section
          icon={Eye}
          title="Long-term monitoring"
          items={plan.long_term_monitoring}
          color="text-green-300"
        />
        <Section
          icon={Package}
          title="Spare procurement"
          items={plan.spare_procurement_strategy}
          color="text-yellow-300"
        />
      </div>

      {plan.process_defects.length > 0 && (
        <div className="mt-3 rounded-lg border border-orange-500/30 bg-orange-500/5 p-3">
          <div className="mb-2 text-xs font-semibold text-orange-300">Process-related defects</div>
          <ul className="space-y-1 text-xs text-gray-400">
            {plan.process_defects.map((d) => (
              <li key={d.defect}>
                <strong className="text-gray-300">{d.defect}</strong> ({Math.round(d.confidence * 100)}%) — {d.action}
              </li>
            ))}
          </ul>
        </div>
      )}
    </AnimatedCard>
  );
}

function Section({
  icon: Icon,
  title,
  items,
  color,
}: {
  icon: typeof Zap;
  title: string;
  items: string[];
  color: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] p-3">
      <div className={`mb-2 flex items-center gap-1.5 text-xs font-semibold ${color}`}>
        <Icon className="h-3.5 w-3.5" />
        {title}
      </div>
      <ul className="space-y-1 text-xs text-gray-400">
        {items.map((item) => (
          <li key={item} className="flex gap-1.5">
            <span className="text-steel-500">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
