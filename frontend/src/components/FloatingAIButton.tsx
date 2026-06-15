"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Bot } from "lucide-react";
import QuickChatOverlay from "@/components/QuickChatOverlay";

const HIDE_ON = ["/login"];

export default function FloatingAIButton() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  if (!pathname || HIDE_ON.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="agent-active animate-float fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-[0_6px_24px_rgba(0,0,0,0.35)] ring-2 ring-white/10 transition-all hover:scale-105 hover:shadow-[0_8px_28px_rgba(0,0,0,0.45)] active:scale-95 sm:bottom-8 sm:right-8"
        style={{ background: "var(--gradient-btn)", color: "var(--btn-fg)" }}
        title="Open AI Agentic Assistant"
        aria-label="Open AI Agentic Assistant quick chat"
        aria-expanded={open}
      >
        <span className="absolute inset-0 animate-ping rounded-full bg-[var(--accent)] opacity-30" />
        <span className="absolute inset-0 rounded-full ring-2 ring-[var(--accent)]/40 ring-offset-2 ring-offset-transparent" />
        <Bot className="relative h-6 w-6" />
        <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-status-healthy ring-2 ring-[var(--card)]" />
      </button>
      <QuickChatOverlay open={open} onClose={() => setOpen(false)} />
    </>
  );
}
