"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  Building2,
  ChevronDown,
  Clock,
  Mail,
  Shield,
  Wrench,
} from "lucide-react";
import { AuthUser } from "@/lib/auth";

const ROLE_META: Record<string, { dept: string; badge: string; shift: string }> = {
  engineer: { dept: "Maintenance Engineering", badge: "ENG-001", shift: "Day shift · Bay 3" },
  supervisor: { dept: "Plant Maintenance Ops", badge: "SUP-001", shift: "Shift supervisor" },
  admin: { dept: "Digital Systems", badge: "ADM-001", shift: "Platform admin" },
};

function roleIcon(role?: string) {
  if (role === "admin") return Shield;
  if (role === "supervisor") return BadgeCheck;
  return Wrench;
}

export default function UserProfileMenu({ user }: { user: AuthUser }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const meta = ROLE_META[user.role_name || "engineer"] || ROLE_META.engineer;
  const RoleIcon = roleIcon(user.role_name);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const displayId = user.email.split("@")[0] || "user1";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg border border-transparent px-1 py-1 transition hover:border-[var(--border)] hover:bg-[var(--surface-elevated)]"
        aria-expanded={open}
      >
        <div className="hidden text-right md:block">
          <div className="text-xs font-medium">{user.full_name}</div>
          <div className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
            {user.role_name || "engineer"}
          </div>
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--btn-bg)] text-xs font-bold text-[var(--btn-fg)]">
          {displayId.charAt(0).toUpperCase()}
        </div>
        <ChevronDown className={`hidden h-3.5 w-3.5 text-[var(--muted)] sm:block ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-xl">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-steel-500/20 text-sm font-bold text-steel-300">
              {displayId.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="font-semibold">{user.full_name}</div>
              <div className="text-[11px] capitalize text-[var(--muted)]">{user.role_name || "engineer"}</div>
              <div className="mt-0.5 truncate text-[10px] text-steel-400">{user.email}</div>
            </div>
          </div>

          <div className="mt-4 space-y-2 rounded-lg border border-[var(--border)] bg-[var(--background)]/50 p-3 text-[11px]">
            <div className="flex items-center gap-2 text-[var(--muted)]">
              <RoleIcon className="h-3.5 w-3.5 shrink-0 text-steel-400" />
              <span>{meta.dept}</span>
            </div>
            <div className="flex items-center gap-2 text-[var(--muted)]">
              <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-steel-400" />
              <span>Badge {meta.badge}</span>
            </div>
            <div className="flex items-center gap-2 text-[var(--muted)]">
              <Building2 className="h-3.5 w-3.5 shrink-0 text-steel-400" />
              <span>Tata Steel · Jamshedpur plant</span>
            </div>
            <div className="flex items-center gap-2 text-[var(--muted)]">
              <Clock className="h-3.5 w-3.5 shrink-0 text-steel-400" />
              <span>{meta.shift}</span>
            </div>
            <div className="flex items-center gap-2 text-[var(--muted)]">
              <Mail className="h-3.5 w-3.5 shrink-0 text-steel-400" />
              <span>User ID: {displayId}</span>
            </div>
          </div>

          {user.role_name === "engineer" && (
            <p className="mt-3 text-[10px] leading-relaxed text-[var(--muted)]">
              Maintenance engineer profile — equipment access, logbook, diagnosis & spare workflows enabled.
            </p>
          )}

          <div className="mt-3 flex gap-2">
            <Link
              href="/logbook"
              onClick={() => setOpen(false)}
              className="flex-1 rounded-lg border border-[var(--border)] px-2 py-1.5 text-center text-[10px] font-medium hover:border-steel-500/40"
            >
              My logbook
            </Link>
            <Link
              href="/equipment"
              onClick={() => setOpen(false)}
              className="flex-1 rounded-lg border border-[var(--border)] px-2 py-1.5 text-center text-[10px] font-medium hover:border-steel-500/40"
            >
              Equipment
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
