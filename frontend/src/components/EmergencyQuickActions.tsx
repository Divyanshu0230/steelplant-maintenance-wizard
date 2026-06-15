"use client";

import Link from "next/link";
import { Bot, Package, Siren, Wrench } from "lucide-react";
import LiveSectionHeader from "@/components/LiveSectionHeader";

interface QuickActionsProps {
  equipmentCode?: string;
  riskLevel?: string;
}

export default function EmergencyQuickActions({ equipmentCode = "RM-MOTOR-03", riskLevel }: QuickActionsProps) {
  const emergency = riskLevel === "critical" || riskLevel === "high";

  return (
    <div
      className={`rounded-xl border p-4 transition-all ${
        emergency
          ? "animate-glow-pulse border-red-500/50 bg-red-500/10"
          : "border-[var(--border)] bg-[var(--card)]"
      }`}
    >
      <LiveSectionHeader
        icon={Siren}
        title="Emergency Quick Actions"
        subtitle={`Focused on ${equipmentCode}`}
        help="Shortcuts for the currently selected asset. Emergency AI Protocol opens chat with a shutdown checklist. Links update when you click a different machine on the twin or fleet cards."
        badge={emergency ? "Alert" : undefined}
        badgeClass="bg-red-500/15 text-red-400"
      />
      <div className="grid grid-cols-2 gap-2">
        <Link
          href={`/chat?equipment=${equipmentCode}&question=${encodeURIComponent("EMERGENCY: recommend immediate shutdown steps")}`}
          className="flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/20 px-3 py-2 text-xs text-red-200 transition-transform hover:scale-105"
        >
          <Siren className="h-4 w-4" />
          Emergency AI Protocol
        </Link>
        <Link
          href={`/equipment/${equipmentCode}`}
          className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-xs hover:border-steel-500/50"
        >
          <Wrench className="h-4 w-4 text-steel-500" />
          Equipment Detail
        </Link>
        <Link
          href="/spare-parts?low_stock=1"
          className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-xs hover:border-steel-500/50"
        >
          <Package className="h-4 w-4 text-steel-500" />
          Critical Spares
        </Link>
        <Link
          href={`/chat?equipment=${equipmentCode}`}
          className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-xs hover:border-steel-500/50"
        >
          <Bot className="h-4 w-4 text-steel-500" />
          AI Diagnosis
        </Link>
      </div>
    </div>
  );
}
