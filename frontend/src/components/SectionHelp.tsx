"use client";

import { useState } from "react";
import { ChevronDown, HelpCircle, LucideIcon } from "lucide-react";

export interface SectionHelpProps {
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
  help: string;
  badge?: string;
  badgeClass?: string;
  compact?: boolean;
}

/** Reusable "What is this?" header for any page section across the project. */
export default function SectionHelp({
  icon: Icon,
  title,
  subtitle,
  help,
  badge,
  badgeClass = "bg-white/5 text-gray-400",
  compact = false,
}: SectionHelpProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className={compact ? "mb-2" : "mb-3"}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          {Icon && <Icon className="mt-0.5 h-5 w-5 shrink-0 text-steel-400" />}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className={compact ? "text-sm font-semibold" : "font-semibold"}>{title}</h2>
              {badge && (
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${badgeClass}`}>
                  {badge}
                </span>
              )}
            </div>
            {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="section-help-trigger flex shrink-0 items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[10px] text-gray-400 transition-colors hover:border-steel-500/40 hover:text-steel-300"
          aria-expanded={open}
        >
          <HelpCircle className="h-3 w-3" />
          What is this?
          <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>
      {open && (
        <p className="mt-2 rounded-lg border border-steel-500/20 bg-steel-500/5 px-3 py-2 text-xs leading-relaxed text-gray-400">
          {help}
        </p>
      )}
    </div>
  );
}
