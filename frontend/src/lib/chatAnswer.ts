/** Split assistant markdown into body + clickable follow-up questions. */

export function parseChatAnswer(content: string): { body: string; followUps: string[] } {
  const sectionMatch = content.match(/\n## Follow-up Questions?\s*\n([\s\S]*)$/i);
  if (!sectionMatch || sectionMatch.index == null) {
    return { body: content, followUps: [] };
  }

  const body = content.slice(0, sectionMatch.index).trim();
  const followUps = sectionMatch[1]
    .split("\n")
    .map((line) => line.trim().replace(/^[-=]>\s*/, "").replace(/^[-*•]\s*/, ""))
    .filter((line) => line.length > 2 && !line.startsWith("#"));

  return { body, followUps };
}

export function mergeFollowUps(...lists: (string[] | undefined)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of lists) {
    for (const item of list ?? []) {
      const key = item.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(item.trim());
    }
  }
  return out.slice(0, 6);
}
