export interface CitationLike {
  source: string;
  document_type: string;
  excerpt: string;
  relevance_score: number;
}

/** Turn `tata_blast_furnace_motor_manual.pdf` into a readable title. */
export function formatCitationTitle(source: string): string {
  const base = source
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/^tata_/i, "")
    .replace(/_/g, " ")
    .trim();
  if (!base) return "Knowledge document";
  return base.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** One chip per document — keep best-scoring chunk, merge excerpts when needed. */
export function dedupeCitations<T extends CitationLike>(citations: T[]): T[] {
  const bySource = new Map<string, T>();

  for (const c of citations) {
    const key = c.source.trim().toLowerCase();
    const existing = bySource.get(key);
    if (!existing) {
      bySource.set(key, { ...c });
      continue;
    }
    if (c.relevance_score > existing.relevance_score) {
      bySource.set(key, { ...c, excerpt: mergeExcerpts(existing.excerpt, c.excerpt) });
    } else if (c.excerpt && c.excerpt.slice(0, 40) !== existing.excerpt.slice(0, 40)) {
      existing.excerpt = mergeExcerpts(existing.excerpt, c.excerpt);
    }
  }

  return Array.from(bySource.values()).sort((a, b) => b.relevance_score - a.relevance_score);
}

function mergeExcerpts(a: string, b: string): string {
  const combined = `${a} … ${b}`.trim();
  return combined.length > 320 ? `${combined.slice(0, 317)}…` : combined;
}

export function excerptPreview(excerpt: string, max = 72): string {
  const clean = excerpt.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1)}…`;
}
