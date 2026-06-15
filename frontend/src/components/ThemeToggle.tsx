"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";

export default function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggle } = useTheme();

  return (
    <button
      type="button"
      onClick={toggle}
      className={`group relative flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--muted)] transition-all hover:border-[var(--accent)]/35 hover:text-[var(--foreground)] hover:shadow-[var(--shadow-glow)] ${className}`}
      title={theme === "dark" ? "Switch to day mode" : "Switch to night mode"}
      aria-label="Toggle day/night theme"
    >
      <Sun
        className={`absolute h-4 w-4 transition-all duration-300 ${
          theme === "dark" ? "rotate-0 scale-100 opacity-100" : "rotate-90 scale-0 opacity-0"
        }`}
      />
      <Moon
        className={`absolute h-4 w-4 transition-all duration-300 ${
          theme === "light" ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0"
        }`}
      />
    </button>
  );
}
