"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Circle, ExternalLink } from "lucide-react";
import AnimatedCard from "@/components/AnimatedCard";
import {
  alignmentStats,
  PROJECT_ALIGNMENT,
  statusDotClass,
  statusLabel,
  type AlignmentCategory,
  type AlignmentStatus,
} from "@/lib/projectAlignment";

function StatusDot({ status }: { status: AlignmentStatus }) {
  return (
    <span
      className={`relative mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${statusDotClass(status)}`}
      title={statusLabel(status)}
    >
      {status === "done" && (
        <span className="absolute inset-0 animate-ping rounded-full bg-status-healthy opacity-40" />
      )}
    </span>
  );
}

export default function ProjectAlignmentPanel() {
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const stats = useMemo(() => alignmentStats(), []);

  const categories: AlignmentCategory[] = useMemo(() => {
    if (activeCategory === "all") return PROJECT_ALIGNMENT;
    return PROJECT_ALIGNMENT.filter((c) => c.id === activeCategory);
  }, [activeCategory]);

  const toggle = (id: string) => setExpanded((e) => ({ ...e, [id]: !e[id] }));

  return (
    <AnimatedCard delay={50} glow>
      <div className="mb-4 flex flex-wrap items-start justify-end gap-4">
        <div className="flex items-center gap-4 rounded-xl border border-status-healthy/30 bg-status-healthy/10 px-4 py-3">
          <div className="text-center">
            <div className="text-3xl font-bold text-status-healthy">{stats.pct}%</div>
            <div className="text-[10px] uppercase tracking-wide text-[var(--muted)]">Aligned</div>
          </div>
          <div className="h-10 w-px bg-[var(--border)]" />
          <div className="space-y-1 text-xs">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${statusDotClass("done")}`} />
              <span>
                <strong className="text-status-healthy">{stats.done}</strong> implemented
              </span>
            </div>
            {stats.partial > 0 && (
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${statusDotClass("partial")}`} />
                <span>{stats.partial} partial</span>
              </div>
            )}
            {stats.pending > 0 && (
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${statusDotClass("pending")}`} />
                <span className="text-status-critical">{stats.pending} pending</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setActiveCategory("all")}
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            activeCategory === "all" ? "bg-steel-500 text-white" : "border border-[var(--border)] text-[var(--muted)]"
          }`}
        >
          All ({stats.total})
        </button>
        {PROJECT_ALIGNMENT.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setActiveCategory(cat.id)}
            className={`rounded-full px-3 py-1 text-xs ${
              activeCategory === cat.id
                ? "bg-steel-500 text-white"
                : "border border-[var(--border)] text-[var(--muted)]"
            }`}
          >
            {cat.title}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {categories.map((cat) => {
          const catOpen = expanded[cat.id] !== false;
          const catDone = cat.items.filter((i) => i.status === "done").length;
          return (
            <div key={cat.id} className="rounded-xl border border-[var(--border)] bg-[var(--background)]/40">
              <button
                type="button"
                onClick={() => toggle(cat.id)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
              >
                <div className="flex items-center gap-3">
                  {catOpen ? (
                    <ChevronDown className="h-4 w-4 text-[var(--muted)]" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-[var(--muted)]" />
                  )}
                  <div>
                    <div className="text-sm font-semibold">{cat.title}</div>
                    <div className="text-[11px] text-[var(--muted)]">{cat.subtitle}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="flex items-center gap-1 text-status-healthy">
                    <Circle className="h-2 w-2 fill-status-healthy text-status-healthy" />
                    {catDone} complete
                  </span>
                </div>
              </button>
              {catOpen && (
                <div className="border-t border-[var(--border)] px-2 py-2">
                  {cat.items.map((item, index) => (
                    <div
                      key={item.id}
                      className="flex items-start gap-3 rounded-lg px-2 py-2.5 transition hover:bg-steel-500/5"
                    >
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-steel-500/15 text-[10px] font-bold text-steel-400">
                        {index + 1}
                      </span>
                      <StatusDot status={item.status} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium">{item.label}</span>
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase ${
                              item.status === "done"
                                ? "bg-status-healthy/15 text-status-healthy"
                                : item.status === "partial"
                                  ? "bg-status-warning/15 text-status-warning"
                                  : "bg-status-critical/15 text-status-critical"
                            }`}
                          >
                            {statusLabel(item.status)}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--muted)]">{item.detail}</p>
                        {item.api && (
                          <code className="mt-1 block text-[10px] text-steel-400">{item.api}</code>
                        )}
                      </div>
                      {item.href && (
                        <Link
                          href={item.href}
                          className="flex shrink-0 items-center gap-0.5 rounded-md border border-[var(--border)] px-2 py-1 text-[10px] text-steel-400 hover:border-steel-500/40 hover:text-steel-200"
                        >
                          Demo
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </AnimatedCard>
  );
}
