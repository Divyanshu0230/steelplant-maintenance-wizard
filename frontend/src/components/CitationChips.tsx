"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import {
  dedupeCitations,
  excerptPreview,
  formatCitationTitle,
} from "@/lib/citationDisplay";

interface Citation {
  source: string;
  document_type: string;
  excerpt: string;
  relevance_score: number;
}

export default function CitationChips({ citations }: { citations: Citation[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const unique = useMemo(() => dedupeCitations(citations), [citations]);

  if (!unique.length) return null;

  return (
    <div className="mt-3 space-y-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
        Manual references ({unique.length})
      </div>
      <div className="space-y-2">
        {unique.map((c) => {
          const title = formatCitationTitle(c.source);
          const key = c.source;
          const preview = excerptPreview(c.excerpt);
          return (
            <div
              key={key}
              className="rounded-lg border border-[var(--border)] bg-[var(--background)]/80 p-2.5"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setExpanded(expanded === key ? null : key)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="flex items-center gap-1.5">
                    <BookOpen className="h-3.5 w-3.5 shrink-0 text-steel-400" />
                    <span className="text-xs font-semibold text-[var(--foreground)]">{title}</span>
                    <span className="rounded-full bg-status-healthy/15 px-1.5 py-0.5 text-[10px] font-medium text-status-healthy">
                      {(c.relevance_score * 100).toFixed(0)}%
                    </span>
                    {expanded === key ? (
                      <ChevronUp className="h-3 w-3 text-[var(--muted)]" />
                    ) : (
                      <ChevronDown className="h-3 w-3 text-[var(--muted)]" />
                    )}
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-[var(--muted)]">{preview}</p>
                </button>
                <Link
                  href={`/knowledge?open=${encodeURIComponent(c.source)}`}
                  className="flex shrink-0 items-center gap-0.5 rounded-md border border-[var(--border)] px-2 py-1 text-[10px] text-[var(--muted)] hover:border-steel-500/40 hover:text-steel-300"
                >
                  <ExternalLink className="h-3 w-3" />
                  Open
                </Link>
              </div>
              {expanded === key && (
                <div className="mt-2 border-t border-[var(--border)] pt-2 text-[11px] leading-relaxed text-[var(--muted)]">
                  {c.excerpt}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
