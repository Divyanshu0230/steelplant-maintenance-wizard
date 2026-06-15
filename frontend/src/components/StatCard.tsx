"use client";

import Link from "next/link";
import { LucideIcon } from "lucide-react";
import clsx from "clsx";

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon?: LucideIcon;
  color?: "default" | "red" | "yellow" | "green" | "steel";
  delay?: number;
  pulse?: boolean;
  href?: string;
  onClick?: () => void;
}

const COLOR_MAP = {
  default: "text-[var(--foreground)]",
  red: "text-status-critical",
  yellow: "text-status-warning",
  green: "text-status-healthy",
  steel: "text-[var(--accent)]",
};

export default function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color = "default",
  delay = 0,
  pulse = false,
  href,
  onClick,
}: StatCardProps) {
  const interactive = Boolean(href || onClick);
  const className = clsx(
    "animate-fade-in-up rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 transition-all duration-200",
    interactive && "cursor-pointer hover:border-[var(--accent)]/35 hover:scale-[1.02] hover:shadow-lg"
  );

  const content = (
    <>
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-[var(--muted)]">{label}</span>
        {Icon && (
          <Icon className={clsx("h-4 w-4", COLOR_MAP[color], pulse && "animate-pulse-soft")} />
        )}
      </div>
      <div className={clsx("mt-2 text-2xl font-bold tabular-nums", COLOR_MAP[color])}>{value}</div>
      {sub && <p className="mt-1 text-xs text-[var(--muted)] line-clamp-2">{sub}</p>}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className} style={{ animationDelay: `${delay}ms` }}>
        {content}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={clsx(className, "w-full text-left")}
        style={{ animationDelay: `${delay}ms` }}
      >
        {content}
      </button>
    );
  }

  return (
    <div className={className} style={{ animationDelay: `${delay}ms` }}>
      {content}
    </div>
  );
}
