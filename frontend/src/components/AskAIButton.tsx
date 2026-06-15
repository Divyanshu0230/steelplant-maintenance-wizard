"use client";

import Link from "next/link";
import { Bot } from "lucide-react";

interface AskAIButtonProps {
  href: string;
  className?: string;
}

/** Compact AI assistant CTA with animated robot icon */
export default function AskAIButton({ href, className = "" }: AskAIButtonProps) {
  return (
    <Link
      href={href}
      className={`group inline-flex items-center gap-1.5 rounded-lg border border-[var(--accent)]/50 bg-[var(--surface-elevated)] px-2.5 py-1.5 text-xs font-medium text-[var(--foreground)] shadow-sm transition-all hover:scale-[1.03] hover:border-[var(--accent)] hover:shadow-md ${className}`}
    >
      <span className="relative flex h-6 w-6 items-center justify-center rounded-md bg-[var(--btn-bg)] text-[var(--btn-fg)]">
        <span className="absolute inset-0 animate-ping rounded-md bg-[var(--btn-bg)] opacity-40" />
        <Bot className="relative h-3.5 w-3.5" />
      </span>
      Ask AI
    </Link>
  );
}
