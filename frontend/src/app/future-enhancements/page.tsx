"use client";

import { Rocket } from "lucide-react";
import AppShell from "@/components/AppShell";
import AnimatedCard from "@/components/AnimatedCard";
import { FUTURE_ENHANCEMENTS } from "@/lib/futureEnhancements";

export default function FutureEnhancementsPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="flex items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] px-5 py-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-steel-500/15">
            <Rocket className="h-5 w-5 text-steel-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">Future Enhancements</h1>
            <p className="mt-0.5 text-sm text-[var(--muted)]">
              Planned extensions for production rollout of Maintenance Wizard
            </p>
          </div>
        </div>

        <AnimatedCard glow delay={0}>
          <ul className="space-y-2.5">
            {FUTURE_ENHANCEMENTS.map((item, i) => (
              <li
                key={item}
                className="flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--background)]/40 px-4 py-3"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-steel-500/15 text-xs font-bold text-steel-400">
                  {i + 1}
                </span>
                <span className="text-sm font-medium">{item}</span>
              </li>
            ))}
          </ul>
        </AnimatedCard>
      </div>
    </AppShell>
  );
}
