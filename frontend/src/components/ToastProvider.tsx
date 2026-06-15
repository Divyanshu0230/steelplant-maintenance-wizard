"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { AlertTriangle, CheckCircle, Info, X } from "lucide-react";

type ToastType = "info" | "success" | "warning" | "error";

interface Toast {
  id: number;
  type: ToastType;
  title: string;
  message?: string;
}

const ToastContext = createContext<{
  toast: (type: ToastType, title: string, message?: string) => void;
} | null>(null);

const ICONS = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: AlertTriangle,
};

const STYLES: Record<ToastType, string> = {
  info: "border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--muted)]",
  success: "border-status-healthy bg-status-healthy text-status-healthy",
  warning: "border-status-warning bg-status-warning text-status-warning",
  error: "border-status-critical bg-status-critical text-status-critical",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((type: ToastType, title: string, message?: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, type, title, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  }, []);

  const dismiss = (id: number) => setToasts((t) => t.filter((x) => x.id !== id));

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex max-w-sm flex-col gap-2">
        {toasts.map((t, i) => {
          const Icon = ICONS[t.type];
          return (
            <div
              key={t.id}
              className={`animate-slide-in-right flex items-start gap-3 rounded-xl border p-4 shadow-2xl backdrop-blur-md ${STYLES[t.type]}`}
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <Icon className="mt-0.5 h-5 w-5 shrink-0" />
              <div className="flex-1 text-sm">
                <div className="font-semibold">{t.title}</div>
                {t.message && <div className="mt-0.5 opacity-80">{t.message}</div>}
              </div>
              <button onClick={() => dismiss(t.id)} className="opacity-60 hover:opacity-100">
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
