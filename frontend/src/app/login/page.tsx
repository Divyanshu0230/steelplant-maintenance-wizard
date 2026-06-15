"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  Bot,
  Info,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  Shield,
  Sparkles,
  Wrench,
  Zap,
} from "lucide-react";
import TataBrandLogo from "@/components/TataBrandLogo";
import ThemeToggle from "@/components/ThemeToggle";
import { api } from "@/lib/api";

const DEMO_USERS = [
  {
    id: "engineer",
    email: "engineer1@steelplant.com",
    label: "Maintenance User",
    role: "Engineer",
    password: "password123",
    icon: Wrench,
    accent: "border-steel-500/40 bg-steel-500/10 hover:border-steel-400/60",
    badge: "bg-steel-500/20 text-steel-200",
  },
  {
    id: "supervisor",
    email: "supervisor1@steelplant.com",
    label: "Operations Lead",
    role: "Supervisor",
    password: "password123",
    icon: BadgeCheck,
    accent: "border-status-warning/35 bg-status-warning/10 hover:border-status-warning/55",
    badge: "bg-status-warning/15 text-status-warning",
  },
  {
    id: "admin",
    email: "admin1@steelplant.com",
    label: "Plant Administrator",
    role: "Admin",
    password: "password123",
    icon: Shield,
    accent: "border-status-healthy/35 bg-status-healthy/10 hover:border-status-healthy/55",
    badge: "bg-status-healthy/15 text-status-healthy",
  },
] as const;

const HERO_STATS = [
  { value: "11", label: "AI agents" },
  { value: "FR1–7", label: "Aligned" },
  { value: "Live", label: "ML + sensors" },
];

const FEATURES = [
  { icon: Bot, text: "Agentic AI — autonomous maintenance orchestration" },
  { icon: Zap, text: "C-MAPSS ML + real-time predictive monitoring" },
  { icon: Activity, text: "Tata Steel hackathon command center" },
];

export default function LoginPage() {
  const [email, setEmail] = useState<string>(DEMO_USERS[0].email);
  const [password, setPassword] = useState<string>("password123");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [waking, setWaking] = useState(false);

  // Wake Render free-tier backend while user reads the login page
  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl?.includes("onrender.com")) return;
    setWaking(true);
    fetch(`${apiUrl}/equipment/health`, { method: "GET" })
      .catch(() => {})
      .finally(() => setWaking(false));
  }, []);

  const doLogin = async (demoEmail: string, demoPassword: string) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setLoading(true);
    setError("");
    try {
      await api.login(demoEmail, demoPassword);
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    await doLogin(email, password);
  };

  return (
    <div className="login-page relative min-h-screen overflow-hidden">
      <div className="login-orb login-orb-1" aria-hidden />
      <div className="login-orb login-orb-2" aria-hidden />

      <div className="absolute right-4 top-4 z-30 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid w-full max-w-6xl items-center gap-8 lg:grid-cols-2 lg:gap-10 xl:max-w-[1100px] xl:gap-12">
          {/* Hero — desktop */}
          <div className="login-hero-panel relative hidden overflow-hidden rounded-2xl p-8 lg:block xl:p-10">
            <div className="login-hero-grid absolute inset-0 rounded-2xl" aria-hidden />
            <div className="hero-forge-glow absolute inset-0 rounded-2xl" />

            <div className="relative z-10">
              <TataBrandLogo size="lg" showSubtitle />

              <div className="mt-8 inline-flex items-center gap-2 rounded-full login-stat-pill px-3 py-1.5 text-[11px] font-medium text-white/90">
                <Sparkles className="h-3.5 w-3.5 text-status-healthy" />
                Tata Steel · AI Hackathon Round 2
              </div>

              <h1 className="mt-5 text-3xl font-bold tracking-tight text-white xl:text-4xl">
                Maintenance
                <span className="block bg-gradient-to-r from-white via-zinc-300 to-zinc-500 bg-clip-text text-transparent">
                  Wizard
                </span>
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-white/70 xl:text-base">
                AI-powered command center for predictive maintenance, diagnosis, and plant operations.
              </p>

              <div className="mt-6 flex flex-wrap gap-2.5">
                {HERO_STATS.map((s) => (
                  <div key={s.label} className="login-stat-pill rounded-xl px-3.5 py-2.5 text-center">
                    <div className="text-lg font-bold text-white">{s.value}</div>
                    <div className="text-[9px] uppercase tracking-wider text-white/55">{s.label}</div>
                  </div>
                ))}
              </div>

              <ul className="mt-8 space-y-3">
                {FEATURES.map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-center gap-3 text-sm text-white/90">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/10">
                      <Icon className="h-4 w-4 text-white" />
                    </span>
                    <span className="leading-snug">{text}</span>
                  </li>
                ))}
              </ul>

              <p className="mt-8 text-[10px] text-white/40">
                NASA C-MAPSS FD001 · LangGraph agents · Real-time WebSocket monitoring
              </p>
            </div>
          </div>

          {/* Login form */}
          <div className="w-full">
            <div className="mb-6 flex flex-col items-center text-center lg:hidden">
              <TataBrandLogo size="md" showSubtitle />
              <p className="mt-3 text-sm font-medium text-[var(--muted)]">Maintenance Wizard</p>
            </div>

            <div className="login-glass-card overflow-hidden rounded-2xl">
              <div className="login-card-accent mx-6 mt-5" />
              <div className="p-6 pt-4 sm:p-7">
                <div className="mb-5">
                  <h2 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">
                    Welcome back
                  </h2>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    Sign in to your maintenance command center
                  </p>
                  {waking && (
                    <p className="mt-2 text-xs text-status-warning">
                      Waking up backend server (free tier) — first login may take up to 60 seconds…
                    </p>
                  )}
                </div>

                <form onSubmit={submit} className="space-y-3.5">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                      User ID
                    </label>
                    <div className="login-input-wrap">
                      <Mail />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="input-field w-full"
                        placeholder="engineer1@steelplant.com"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                      Password
                    </label>
                    <div className="login-input-wrap">
                      <Lock />
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="input-field w-full"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>

                  {error && (
                    <p className="rounded-xl border border-status-critical/35 bg-status-critical/10 px-3 py-2 text-sm text-status-critical">
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary group flex w-full items-center justify-center gap-2 py-2.5 text-sm font-semibold disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Signing in…
                      </>
                    ) : (
                      <>
                        Sign in to dashboard
                        <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                      </>
                    )}
                  </button>
                </form>

                <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--background)]/60 px-3 py-2.5">
                  <div className="flex gap-2 text-[11px] leading-relaxed text-[var(--muted)]">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-steel-400" />
                    <p>
                      Demo auth only. Production will use a central user database with profile storage,
                      clerk validations, and enterprise SSO.
                    </p>
                  </div>
                </div>

                <div className="mt-5">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="h-px flex-1 bg-[var(--border)]" />
                    <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">
                      <KeyRound className="h-3 w-3" />
                      Quick access
                    </span>
                    <div className="h-px flex-1 bg-[var(--border)]" />
                  </div>
                  <p className="mb-3 text-center text-[11px] text-[var(--muted)]">
                    One click — opens the main dashboard
                  </p>

                  <div className="space-y-2">
                    {DEMO_USERS.map((u) => {
                      const Icon = u.icon;
                      const busy = loading;
                      return (
                        <button
                          key={u.id}
                          type="button"
                          disabled={busy}
                          onClick={() => doLogin(u.email, u.password)}
                          className={`login-demo-card group flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left disabled:opacity-50 ${u.accent}`}
                        >
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/10">
                            <Icon className="h-4 w-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-bold">{u.label}</span>
                              <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${u.badge}`}>
                                {u.role}
                              </span>
                            </div>
                            <div className="mt-0.5 text-[11px] text-steel-400 group-hover:text-steel-300">
                              {busy ? "Opening dashboard…" : "Enter dashboard →"}
                            </div>
                          </div>
                          {busy ? (
                            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[var(--muted)]" />
                          ) : (
                            <ArrowRight className="h-4 w-4 shrink-0 text-[var(--muted)] transition group-hover:translate-x-0.5 group-hover:text-steel-300" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <p className="mt-4 text-center text-[10px] text-[var(--muted)]">
              © Tata Steel Maintenance Wizard · Secure plant operations platform
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
