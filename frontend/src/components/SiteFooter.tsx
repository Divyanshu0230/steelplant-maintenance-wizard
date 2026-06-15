"use client";

import Link from "next/link";
import TataBrandLogo from "@/components/TataBrandLogo";

const FOOTER_LINKS = {
  Platform: [
    { href: "/equipment", label: "Equipment" },
    { href: "/live", label: "Live Monitor" },
    { href: "/diagnosis", label: "AI Diagnosis" },
    { href: "/reports", label: "Reports" },
    { href: "/future-enhancements", label: "Future Enhancements" },
  ],
  Operations: [
    { href: "/priority", label: "Priority Queue" },
    { href: "/logbook", label: "Logbook" },
    { href: "/spare-parts", label: "Spare Parts" },
    { href: "/procurement", label: "Procurement" },
  ],
  Intelligence: [
    { href: "/chat", label: "AI Agentic Assistant" },
    { href: "/knowledge", label: "Knowledge Base" },
    { href: "/agents", label: "AI Pipeline" },
  ],
};

export default function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-[var(--border)] bg-[var(--card)]">
      <div className="w-full px-4 py-10 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-1">
            <TataBrandLogo size="sm" />
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-[var(--muted)]">
              Predictive maintenance and AI-assisted operations for Tata Steel manufacturing assets.
            </p>
          </div>
          {Object.entries(FOOTER_LINKS).map(([title, links]) => (
            <div key={title}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--foreground)]">
                {title}
              </h3>
              <ul className="mt-3 space-y-2">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-col gap-2 border-t border-[var(--border)] pt-6 text-xs text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} Tata Steel · Maintenance Wizard</span>
          <span>AI Hackathon Round 2 · NASA C-MAPSS FD001 dataset</span>
        </div>
      </div>
    </footer>
  );
}
