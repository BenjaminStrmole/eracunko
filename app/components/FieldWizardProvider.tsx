"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useEffect,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import type {
  FieldWizardAdapter,
  FieldWizardCallbacks,
  FieldWizardSession,
  InvoiceFieldWizardFlow,
} from "../../lib/onboarding/types";

const SESSION_KEY = "eracunko-field-wizard-session";

type PendingStart = {
  flow: InvoiceFieldWizardFlow;
  callbacks: FieldWizardCallbacks;
};

type FieldWizardContextValue = {
  session: FieldWizardSession | null;
  register: (adapter: FieldWizardAdapter) => () => void;
  start: (flow: InvoiceFieldWizardFlow, callbacks: FieldWizardCallbacks) => void;
  updateSession: (patch: Partial<FieldWizardSession>) => void;
  pauseSession: () => void;
  dismissSession: () => void;
  completeSession: () => void;
};

const FieldWizardContext = createContext<FieldWizardContextValue | null>(null);

export function FieldWizardProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [session, setSession] = useState<FieldWizardSession | null>(null);
  const sessionRef = useRef<FieldWizardSession | null>(null);
  const adapterRef = useRef<FieldWizardAdapter | null>(null);
  const pendingRef = useRef<PendingStart | null>(null);
  const callbacksRef = useRef<FieldWizardCallbacks | null>(null);

  const persist = useCallback((next: FieldWizardSession | null) => {
    sessionRef.current = next;
    setSession(next);
    if (next) localStorage.setItem(SESSION_KEY, JSON.stringify(next));
    else localStorage.removeItem(SESSION_KEY);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem(SESSION_KEY);
    if (!saved) return;

    try {
      const restored = JSON.parse(saved) as FieldWizardSession;
      sessionRef.current = restored;
      window.setTimeout(() => {
        setSession(restored);
        if (restored.status === "active") {
          adapterRef.current?.start(
            restored.flow,
            callbacksRef.current || { onCompleted: () => {}, onPaused: () => {} },
            restored
          );
        }
      }, 0);
    } catch {
      localStorage.removeItem(SESSION_KEY);
    }
  }, []);

  const updateSession = useCallback(
    (patch: Partial<FieldWizardSession>) => {
      const current = sessionRef.current;
      if (!current) return;
      persist({
        ...current,
        ...patch,
        updatedAt: new Date().toISOString(),
      });
    },
    [persist]
  );

  useEffect(() => {
    if (sessionRef.current?.status === "active" && sessionRef.current.route !== pathname) {
      updateSession({ route: pathname });
    }
  }, [pathname, updateSession]);

  const register = useCallback((adapter: FieldWizardAdapter) => {
    adapterRef.current = adapter;
    const pending = pendingRef.current;
    if (pending) {
      pendingRef.current = null;
      window.setTimeout(
        () => adapter.start(pending.flow, pending.callbacks, sessionRef.current || undefined),
        0
      );
    } else {
      const activeSession = sessionRef.current;
      if (activeSession?.status === "active") {
        window.setTimeout(
          () =>
            adapter.start(
              activeSession.flow,
              callbacksRef.current || { onCompleted: () => {}, onPaused: () => {} },
              activeSession
            ),
          0
        );
      }
    }

    return () => {
      if (adapterRef.current === adapter) adapterRef.current = null;
      adapter.stop();
    };
  }, []);

  const start = useCallback(
    (flow: InvoiceFieldWizardFlow, callbacks: FieldWizardCallbacks) => {
      callbacksRef.current = callbacks;
      const now = new Date().toISOString();
      const nextSession: FieldWizardSession = {
        id: `${Date.now()}`,
        flow,
        profile: flow === "invoice" ? undefined : flow,
        status: "active",
        phase: "invoice",
        route: "/invoices/new",
        pendingSellerFields: [],
        startedAt: now,
        updatedAt: now,
      };
      persist(nextSession);
      const adapter = adapterRef.current;
      if (adapter) {
        adapter.start(flow, callbacks, nextSession);
      } else {
        pendingRef.current = { flow, callbacks };
      }
    },
    [persist]
  );

  const pauseSession = useCallback(() => {
    updateSession({ status: "paused" });
    callbacksRef.current?.onPaused();
  }, [updateSession]);

  const dismissSession = useCallback(() => {
    updateSession({ status: "dismissed" });
    callbacksRef.current?.onPaused();
  }, [updateSession]);

  const completeSession = useCallback(() => {
    const current = sessionRef.current;
    if (!current) return;
    updateSession({ status: "completed", phase: "send" });
    callbacksRef.current?.onCompleted();
  }, [updateSession]);

  const value = useMemo(
    () => ({
      session,
      register,
      start,
      updateSession,
      pauseSession,
      dismissSession,
      completeSession,
    }),
    [
      completeSession,
      dismissSession,
      pauseSession,
      register,
      session,
      start,
      updateSession,
    ]
  );

  return (
    <FieldWizardContext.Provider value={value}>
      {children}
    </FieldWizardContext.Provider>
  );
}

export function useFieldWizard() {
  const value = useContext(FieldWizardContext);
  if (!value) throw new Error("useFieldWizard must be used inside FieldWizardProvider");
  return value;
}
