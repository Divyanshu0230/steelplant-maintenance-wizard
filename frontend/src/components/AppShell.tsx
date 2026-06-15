"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Activity,
  BookOpen,
  Bot,
  Brain,
  Database,
  FileText,
  LayoutDashboard,
  ListOrdered,
  LogOut,
  Microscope,
  Package,
  Radio,
  Rocket,
  Settings,
  ShoppingCart,
} from "lucide-react";
import TataBrandLogo from "@/components/TataBrandLogo";
import ThemeToggle from "@/components/ThemeToggle";
import FloatingAIButton from "@/components/FloatingAIButton";
import SiteFooter from "@/components/SiteFooter";
import UserProfileMenu from "@/components/UserProfileMenu";
import { AuthUser, clearAuth, getUser } from "@/lib/auth";
import { api } from "@/lib/api";
import type { LucideIcon } from "lucide-react";

type NavItem = { href: string; label: string; icon: LucideIcon };

const NAV: NavItem[] = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/equipment", label: "Equipment", icon: Settings },
  { href: "/live", label: "Live", icon: Radio },
  { href: "/diagnosis", label: "AI Diagnosis", icon: Microscope },
  { href: "/priority", label: "Priority", icon: ListOrdered },
  { href: "/chat", label: "AI Agentic Assistant", icon: Bot },
  { href: "/knowledge", label: "Knowledge", icon: Database },
  { href: "/logbook", label: "Logbook", icon: BookOpen },
  { href: "/spare-parts", label: "Spares", icon: Package },
  { href: "/procurement", label: "Procurement", icon: ShoppingCart },
  { href: "/agents", label: "AI Pipeline", icon: Brain },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/future-enhancements", label: "Future", icon: Rocket },
];

function NavLink({ href, label, icon: Icon, active }: NavItem & { active: boolean }) {
  return (
    <Link
      href={href}
      className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium whitespace-nowrap transition-colors sm:px-3 sm:text-sm ${
        active
          ? "bg-[var(--nav-active)] text-[var(--foreground)] ring-1 ring-[var(--border)]"
          : "text-[var(--muted)] hover:bg-[var(--surface-elevated)] hover:text-[var(--foreground)]"
      }`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
      {label}
    </Link>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUserState] = useState<AuthUser | null>(null);

  useEffect(() => {
    setUserState(getUser());
  }, [pathname]);

  // One-time wake ping on mount (avoid interval — extra load crashes free-tier during AI)
  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl?.includes("onrender.com")) return;
    api.getEquipment().catch(() => {});
  }, []);

  const logout = () => {
    clearAuth();
    window.location.href = "/login";
  };

  const isActive = (href: string) =>
    pathname === href || (href !== "/" && pathname.startsWith(href));

  return (
    <div className="relative flex min-h-screen w-full flex-col bg-[var(--background)]">
      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--card)]/95 backdrop-blur-md">
        <div className="tata-header-stripe h-0.5 w-full" aria-hidden />
        <div className="flex w-full items-center justify-between gap-4 px-4 py-3 lg:px-8">
          <Link href="/" className="flex shrink-0 items-center gap-3">
            <TataBrandLogo size="sm" />
            <div className="hidden sm:block">
              <h1 className="title-brand text-base font-bold tracking-tight lg:text-lg">
                TATA Steel Maintenance Wizard
              </h1>
              <p className="text-[11px] text-[var(--muted)]">AI Command Center</p>
            </div>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/live"
              className="pill-live hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium sm:flex"
            >
              <Activity className="h-3.5 w-3.5 animate-pulse-soft" />
              Live
            </Link>
            <ThemeToggle />
            {user && (
              <div className="flex items-center gap-2 border-l border-[var(--border)] pl-2 sm:pl-3">
                <UserProfileMenu user={user} />
                <button
                  type="button"
                  onClick={logout}
                  className="rounded-lg p-2 text-[var(--muted)] transition-colors hover:text-[var(--status-critical)]"
                  title="Logout"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        <nav className="flex w-full gap-1 overflow-x-auto border-t border-[var(--border)] px-4 py-2 scrollbar-thin lg:px-8">
          {NAV.map((item) => (
            <NavLink key={item.href} {...item} active={isActive(item.href)} />
          ))}
        </nav>
      </header>

      <main className={`relative z-10 w-full flex-1 ${pathname.startsWith("/chat") ? "overflow-hidden px-4 py-3 lg:px-6" : "px-4 py-6 lg:px-8"}`}>
        {children}
      </main>
      {!pathname.startsWith("/chat") && <SiteFooter />}
      {!pathname.startsWith("/chat") && <FloatingAIButton />}
    </div>
  );
}
