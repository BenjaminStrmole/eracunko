"use client";

import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
} from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

type ToastType = "success" | "error" | "warning" | "info";

type Toast = {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration: number;
};

type ToastInput = {
  title: string;
  description?: string;
  duration?: number;
};

type ToastContextValue = {
  success: (title: string, description?: string, duration?: number) => void;
  error: (title: string, description?: string, duration?: number) => void;
  warning: (title: string, description?: string, duration?: number) => void;
  info: (title: string, description?: string, duration?: number) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const toastStyles: Record<
  ToastType,
  { icon: typeof CheckCircle2; accent: string; bar: string }
> = {
  success: {
    icon: CheckCircle2,
    accent: "text-emerald-500 bg-emerald-500/10",
    bar: "bg-emerald-500",
  },
  error: {
    icon: AlertCircle,
    accent: "text-red-500 bg-red-500/10",
    bar: "bg-red-500",
  },
  warning: {
    icon: AlertTriangle,
    accent: "text-amber-500 bg-amber-500/10",
    bar: "bg-amber-500",
  },
  info: {
    icon: Info,
    accent: "text-[var(--app-primary-strong)] bg-[var(--app-soft)]",
    bar: "bg-[var(--app-primary)]",
  },
};

function makeToast(type: ToastType, input: ToastInput): Toast {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type,
    title: input.title,
    description: input.description,
    duration: input.duration ?? 4800,
  };
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (type: ToastType, title: string, description?: string, duration?: number) => {
      const toast = makeToast(type, { title, description, duration });
      setToasts((current) => [toast, ...current].slice(0, 5));

      window.setTimeout(() => {
        removeToast(toast.id);
      }, toast.duration);
    },
    [removeToast]
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      success: (title, description, duration) =>
        push("success", title, description, duration),
      error: (title, description, duration) =>
        push("error", title, description, duration),
      warning: (title, description, duration) =>
        push("warning", title, description, duration),
      info: (title, description, duration) =>
        push("info", title, description, duration),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-3 top-3 z-[100] flex flex-col gap-3 sm:left-auto sm:right-5 sm:top-5 sm:w-[min(420px,calc(100vw-2.5rem))]"
      >
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onClose={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used inside ToastProvider.");
  }

  return context;
}

function ToastCard({
  toast,
  onClose,
}: {
  toast: Toast;
  onClose: (id: string) => void;
}) {
  const style = toastStyles[toast.type];
  const Icon = style.icon;

  return (
    <div className="pointer-events-auto overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[color-mix(in_srgb,var(--app-surface-strong),transparent_4%)] shadow-[var(--app-shadow)] backdrop-blur-2xl">
      <div className="flex gap-3 p-4">
        <div
          className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${style.accent}`}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-[var(--foreground)]">
            {toast.title}
          </div>
          {toast.description && (
            <div className="app-muted mt-1 text-sm leading-relaxed">
              {toast.description}
            </div>
          )}
        </div>
        <button
          onClick={() => onClose(toast.id)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--app-muted)] hover:bg-[var(--app-soft)] hover:text-[var(--foreground)]"
          aria-label="Zapri obvestilo"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <div className="h-1 bg-[var(--app-soft)]">
        <div
          className={`toast-progress h-full ${style.bar}`}
          style={{ animationDuration: `${toast.duration}ms` }}
        />
      </div>
    </div>
  );
}
