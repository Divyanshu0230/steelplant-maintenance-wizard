"use client";

import Link from "next/link";

interface Props {
  content: string;
  className?: string;
}

const LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/g;

const METRIC_RE =
  /failure\s+probability|remaining\s+useful\s+life|rul\b|risk\s+level|engine:/i;

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  const re = new RegExp(LINK_RE);
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(...renderBold(text.slice(last, match.index), `${keyPrefix}-t${last}`));
    }
    const href = match[2];
    const isInternal = href.startsWith("/");
    parts.push(
      isInternal ? (
        <Link
          key={`${keyPrefix}-l${match.index}`}
          href={href}
          className="font-medium text-[var(--status-healthy)] underline underline-offset-2 hover:text-white"
        >
          {match[1]}
        </Link>
      ) : (
        <a
          key={`${keyPrefix}-l${match.index}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-[var(--status-healthy)] underline underline-offset-2"
        >
          {match[1]}
        </a>
      )
    );
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    parts.push(...renderBold(text.slice(last), `${keyPrefix}-end`));
  }
  return parts.length ? parts : renderBold(text, keyPrefix);
}

function renderBold(text: string, keyPrefix: string): React.ReactNode[] {
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return parts.map((part, idx) =>
    idx % 2 === 1 ? (
      <strong key={`${keyPrefix}-b${idx}`} className="font-semibold text-[var(--foreground)]">
        {part}
      </strong>
    ) : (
      <span key={`${keyPrefix}-s${idx}`}>{part}</span>
    )
  );
}

function metricLabel(item: string): string {
  const lower = item.toLowerCase();
  if (lower.includes("failure probability")) return "Failure probability";
  if (lower.includes("remaining useful") || lower.includes("rul")) return "Remaining useful life";
  if (lower.includes("risk level")) return "Risk level";
  if (lower.includes("engine")) return "Engine";
  return item.split(":")[0]?.trim() || item;
}

function metricValue(item: string): string {
  const colon = item.indexOf(":");
  if (colon >= 0) return item.slice(colon + 1).trim().replace(/\*\*/g, "");
  return item.replace(/^[-*•]\s*/, "");
}

function MetricGrid({ items }: { items: string[] }) {
  return (
    <div className="my-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
      {items.map((item, idx) => {
        const label = metricLabel(item);
        const value = metricValue(item);
        const isRisk = label.toLowerCase().includes("risk");
        const isFailure = label.toLowerCase().includes("failure");
        return (
          <div
            key={idx}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2.5"
          >
            <div className="text-[10px] font-medium uppercase tracking-wide text-[var(--muted)]">
              {label}
            </div>
            <div
              className={`mt-1 text-sm font-bold leading-snug ${
                isRisk && /critical|high/i.test(value)
                  ? "text-status-critical"
                  : isFailure
                    ? "text-status-warning"
                    : "text-[var(--foreground)]"
              }`}
            >
              {renderInline(value, `metric-${idx}`)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="my-2 space-y-2">
      {items.map((item, idx) => (
        <li key={idx} className="flex items-baseline gap-2.5 text-sm leading-snug text-[var(--foreground)]">
          <span className="mt-[0.45rem] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
          <span className="flex-1">{renderInline(item, `ul-${idx}`)}</span>
        </li>
      ))}
    </ul>
  );
}

export default function MarkdownRenderer({ content, className = "" }: Props) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) {
      i++;
      continue;
    }
    if (/^## (.+)/.test(line)) {
      const heading = line.replace(/^## /, "");
      elements.push(
        <h3
          key={`h-${i}`}
          className="mt-4 border-b border-[var(--border)] pb-1.5 text-sm font-bold text-[var(--accent)] first:mt-0"
        >
          {heading}
        </h3>
      );
      i++;

      if (/key findings|key metrics/i.test(heading)) {
        const metrics: string[] = [];
        const other: string[] = [];
        while (i < lines.length && /^[-*•]\s/.test(lines[i].trim())) {
          const item = lines[i].trim().replace(/^[-*•]\s/, "");
          if (METRIC_RE.test(item)) metrics.push(item);
          else other.push(item);
          i++;
        }
        if (metrics.length) elements.push(<MetricGrid key={`metrics-${i}`} items={metrics} />);
        if (other.length) elements.push(<BulletList key={`kf-${i}`} items={other} />);
        continue;
      }
      continue;
    }
    if (/^\d+[.)]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+[.)]\s/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+[.)]\s/, ""));
        i++;
      }
      elements.push(
        <ol key={`ol-${i}`} className="my-2 space-y-2">
          {items.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2 text-sm text-[var(--foreground)]">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[var(--surface-elevated)] text-xs font-bold text-[var(--accent)]">
                {idx + 1}
              </span>
              <span className="pt-0.5">{renderInline(item, `ol-${idx}`)}</span>
            </li>
          ))}
        </ol>
      );
      continue;
    }
    if (/^[-*•]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*•]\s/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*•]\s/, ""));
        i++;
      }
      elements.push(<BulletList key={`ul-${i}`} items={items} />);
      continue;
    }
    if (/^[-=]>\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-=]>\s/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-=]>\s/, ""));
        i++;
      }
      elements.push(
        <ul key={`arr-${i}`} className="my-2 space-y-1.5">
          {items.map((item, idx) => (
            <li key={idx} className="flex items-baseline gap-2 text-sm text-[var(--foreground)]">
              <span className="shrink-0 font-medium text-[var(--accent)]">›</span>
              <span>{renderInline(item, `arr-${idx}`)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }
    if (line.startsWith("_") && line.endsWith("_")) {
      elements.push(
        <p key={i} className="text-xs italic text-[var(--muted)]">
          {line.replace(/^_|_$/g, "")}
        </p>
      );
      i++;
      continue;
    }
    elements.push(
      <p key={i} className="text-sm leading-relaxed text-[var(--foreground)]">
        {renderInline(line, `p-${i}`)}
      </p>
    );
    i++;
  }

  return <div className={`space-y-1 ${className}`}>{elements}</div>;
}
